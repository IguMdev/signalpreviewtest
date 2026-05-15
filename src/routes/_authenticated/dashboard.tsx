import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, CalendarClock, Wallet, Sparkles, CreditCard, UserPlus, UserMinus, Bot, RefreshCw } from "lucide-react";
import { getMySubscriptions } from "@/lib/engagement.functions";
import { getCurrentMemberCounts, getMemberStats } from "@/lib/telegram-tracking.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const fetchSubs = useServerFn(getMySubscriptions);
  const fetchCurrentCounts = useServerFn(getCurrentMemberCounts);
  const fetchStats = useServerFn(getMemberStats);

  const stats = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [accounts, activeBots, rooms, scheduled, profile, joinsToday, leavesToday, totalJoins, totalLeaves] = await Promise.all([
        supabase.from("telegram_accounts").select("id", { count: "exact", head: true }),
        supabase
          .from("telegram_accounts")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("status", "ok"),
        supabase.from("rooms").select("id", { count: "exact", head: true }),
        supabase
          .from("scheduled_messages")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("profiles").select("credits, display_name").eq("id", user!.id).maybeSingle(),
        supabase
          .from("telegram_member_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "join")
          .gte("occurred_at", todayStart.toISOString()),
        supabase
          .from("telegram_member_events")
          .select("id", { count: "exact", head: true })
          .in("event_type", ["leave", "kicked"])
          .gte("occurred_at", todayStart.toISOString()),
        supabase
          .from("telegram_member_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "join"),
        supabase
          .from("telegram_member_events")
          .select("id", { count: "exact", head: true })
          .in("event_type", ["leave", "kicked"]),
      ]);
      return {
        accounts: accounts.count ?? 0,
        activeBots: activeBots.count ?? 0,
        rooms: rooms.count ?? 0,
        pending: scheduled.count ?? 0,
        credits: profile.data?.credits ?? 0,
        name: profile.data?.display_name ?? "",
        joinsToday: joinsToday.count ?? 0,
        leavesToday: leavesToday.count ?? 0,
        netTotal: (totalJoins.count ?? 0) - (totalLeaves.count ?? 0),
      };
    },
  });

  const upcoming = useQuery({
    queryKey: ["upcoming", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduled_messages")
        .select("id, content, scheduled_at, status, room_id")
        .eq("status", "pending")
        .order("scheduled_at")
        .limit(5);
      return data ?? [];
    },
  });

  const subsQ = useQuery({
    queryKey: ["dashboard-subs", user?.id],
    enabled: !!user,
    queryFn: () => fetchSubs(),
  });

  const countsQ = useQuery({
    queryKey: ["dashboard-current-counts", user?.id],
    enabled: !!user,
    queryFn: () => fetchCurrentCounts(),
  });
  const statsQ = useQuery({
    queryKey: ["dashboard-member-stats", user?.id],
    enabled: !!user,
    queryFn: () => fetchStats(),
  });

  const [tab, setTab] = useState<"group" | "channel">("group");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  const allChats = countsQ.data?.chats ?? [];
  const groups = allChats.filter((c) => c.chatType === "group" || c.chatType === "unknown");
  const channels = allChats.filter((c) => c.chatType === "channel");
  useEffect(() => {
    if (!countsQ.data) return;
    if (groups.length === 0 && channels.length > 0 && tab === "group") setTab("channel");
    else if (channels.length === 0 && groups.length > 0 && tab === "channel") setTab("group");
  }, [countsQ.data, groups.length, channels.length, tab]);

  const typeByChatId = useMemo(() => {
    const m = new Map<string, "group" | "channel" | "unknown">();
    for (const c of allChats) m.set(String(c.chatId), c.chatType);
    return m;
  }, [allChats]);

  const selectedId = tab === "group" ? selectedGroup : selectedChannel;
  const visibleChats = (tab === "group" ? groups : channels).filter(
    (c) => selectedId === "all" || String(c.chatId) === selectedId,
  );
  const visiblePerChat = (statsQ.data?.perChat ?? []).filter((c) => {
    const chatId = String(c.chat_id);
    const t = typeByChatId.get(chatId) ?? "unknown";
    const inTab = tab === "group" ? t !== "channel" : t === "channel";
    return inTab && (selectedId === "all" || chatId === selectedId);
  });
  const perChatById = useMemo(
    () => new Map(visiblePerChat.map((c) => [String(c.chat_id), c])),
    [visiblePerChat],
  );
  const visibleChatActivity = visibleChats.map((chat) => {
    const stats = perChatById.get(String(chat.chatId));
    return {
      chat_id: chat.chatId,
      chat_title: stats?.chat_title || chat.chatTitle || chat.roomName || null,
      joins: stats?.joins ?? 0,
      leaves: stats?.leaves ?? 0,
    };
  });
  const visibleRecent = (statsQ.data?.recent ?? []).filter((e) => {
    const chatId = String(e.chat_id);
    const t = typeByChatId.get(chatId) ?? "unknown";
    const inTab = tab === "group" ? t !== "channel" : t === "channel";
    return inTab && (selectedId === "all" || chatId === selectedId);
  });
  const totalMembers = visibleChats.reduce((s, c) => s + (c.count ?? 0), 0);
  const totalJoins = visiblePerChat.reduce((s, c) => s + c.joins, 0);
  const totalLeaves = visiblePerChat.reduce((s, c) => s + c.leaves, 0);

  const activeSubs = ((subsQ.data ?? []) as any[]).filter((s) => s.status === "active");
  const monthlyTotal = activeSubs.reduce(
    (sum, s) => sum + Number(s.plan?.price_brl ?? 0),
    0,
  );
  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards = [
    { label: "Mensalidade atual", value: fmtBRL(monthlyTotal), icon: CreditCard },
    { label: "Contas Telegram", value: stats.data?.accounts ?? 0, icon: Send },
    { label: "Bots ativos", value: stats.data?.activeBots ?? 0, icon: Bot },
    { label: "Grupos", value: stats.data?.rooms ?? 0, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá{stats.data?.name ? `, ${stats.data.name}` : ""}</h1>
        <p className="text-muted-foreground text-sm">Visão geral da sua automação Telegram.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="size-4 text-primary" />
            </div>
            <div className="mt-3 text-3xl font-bold">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Planos ativos</h2>
            <p className="text-xs text-muted-foreground">
              Total mensal: <span className="font-semibold text-foreground">{fmtBRL(monthlyTotal)}</span>
            </p>
          </div>
          <Link to="/recarga" className="text-sm text-primary hover:underline">
            Gerenciar
          </Link>
        </div>
        {activeSubs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <CreditCard className="size-8 mx-auto mb-2 opacity-50" />
            Você ainda não tem planos ativos.
          </div>
        ) : (
          <div className="space-y-2">
            {activeSubs.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.plan?.name ?? "Plano"}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {s.plan?.bot_type ?? ""}
                  </p>
                </div>
                <Badge variant="secondary">{fmtBRL(Number(s.plan?.price_brl ?? 0))}/mês</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="font-semibold">Membros por grupo / canal</h2>
            <p className="text-xs text-muted-foreground">Selecione um chat para ver entradas, saídas e total atual.</p>
          </div>
          <Link to="/membros" className="text-sm text-primary hover:underline shrink-0">Ver detalhes</Link>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "group" | "channel")}>
          <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
            <TabsList>
              <TabsTrigger value="group">Grupos ({groups.length})</TabsTrigger>
              <TabsTrigger value="channel">Canais ({channels.length})</TabsTrigger>
            </TabsList>
            {tab === "group" ? (
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {groups.map((c) => (
                    <SelectItem key={c.chatId} value={String(c.chatId)}>
                      {c.chatTitle || c.roomName || `Chat ${c.chatId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="Selecione um canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.chatId} value={String(c.chatId)}>
                      {c.chatTitle || c.roomName || `Chat ${c.chatId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value={tab} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Membros atuais</span>
                  <Users className="size-3.5" />
                </div>
                <div className="text-2xl font-bold mt-1">{totalMembers.toLocaleString("pt-BR")}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Entradas (30d)</span>
                  <UserPlus className="size-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">+{totalJoins}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Saídas (30d)</span>
                  <UserMinus className="size-3.5 text-rose-500" />
                </div>
                <div className="text-2xl font-bold mt-1 text-rose-600">-{totalLeaves}</div>
              </div>
            </div>

            {countsQ.isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                <RefreshCw className="size-4 animate-spin" /> Carregando…
              </div>
            ) : visibleChats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum {tab === "group" ? "grupo" : "canal"} encontrado.
              </p>
            ) : (
              <div className="space-y-2">
                {visibleChats.map((c) => (
                  <div key={`${c.roomId}-${c.chatId}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.chatTitle || c.roomName || `Chat ${c.chatId}`}</p>
                      <p className="text-xs text-muted-foreground truncate">ID: {c.chatId}{c.accountLabel ? ` • ${c.accountLabel}` : ""}</p>
                      {c.error && <p className="text-xs text-destructive mt-1">{c.error}</p>}
                    </div>
                    <span className="text-lg font-semibold tabular-nums shrink-0">{c.count?.toLocaleString("pt-BR") ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}

            {visibleRecent.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Últimos eventos</h3>
                <div className="space-y-1">
                  {visibleRecent.slice(0, 8).map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-1.5 text-xs border-b border-border last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {e.event_type === "join" ? (
                          <UserPlus className="size-3 text-emerald-500 shrink-0" />
                        ) : (
                          <UserMinus className="size-3 text-rose-500 shrink-0" />
                        )}
                        <span className="truncate">
                          {e.tg_first_name || e.tg_username || "Usuário"}{" "}
                          <span className="text-muted-foreground">
                            {e.event_type === "join" ? "entrou em" : e.event_type === "kicked" ? "foi removido de" : "saiu de"}
                          </span>{" "}
                          {e.chat_title || e.chat_id}
                        </span>
                      </div>
                      <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                        {new Date(e.occurred_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visibleChatActivity.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Entradas e saídas {tab === "group" ? "por grupo" : "por canal"}</h3>
                <div className="space-y-2">
                  {visibleChatActivity.map((c) => (
                    <div key={c.chat_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.chat_title || `Chat ${c.chat_id}`}</p>
                        <p className="text-xs text-muted-foreground">ID: {c.chat_id}</p>
                      </div>
                      <div className="flex gap-3 text-sm tabular-nums shrink-0">
                        <span className="text-emerald-500">+{c.joins}</span>
                        <span className="text-rose-500">-{c.leaves}</span>
                        <span className="font-semibold">= {c.joins - c.leaves}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Próximos agendamentos</h2>
          <Link to="/mensagens" className="text-sm text-primary hover:underline">
            Ver todos
          </Link>
        </div>
        {upcoming.data?.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
            Nenhum agendamento por enquanto.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.data?.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{(m.content ?? "🎬 Vídeo").slice(0, 80)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.scheduled_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}