import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getCurrentMemberCounts, getMemberStats } from "@/lib/telegram-tracking.functions";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, UserMinus, TrendingUp, Users, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/membros")({
  component: MembrosPage,
});

function MembrosPage() {
  const fetchStats = useServerFn(getMemberStats);
  const fetchCurrentCounts = useServerFn(getCurrentMemberCounts);
  const q = useQuery({ queryKey: ["member-stats"], queryFn: () => fetchStats() });
  const countsQ = useQuery({ queryKey: ["member-current-counts"], queryFn: () => fetchCurrentCounts() });
  const data = q.data;
  const currentCounts = countsQ.data;

  const [tab, setTab] = useState<"group" | "channel">("group");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  const typeByChatId = useMemo(() => {
    const m = new Map<string, "group" | "channel" | "unknown">();
    for (const c of currentCounts?.chats ?? []) m.set(String(c.chatId), c.chatType);
    return m;
  }, [currentCounts]);

  const groups = (currentCounts?.chats ?? []).filter((c) => c.chatType === "group" || c.chatType === "unknown");
  const channels = (currentCounts?.chats ?? []).filter((c) => c.chatType === "channel");

  // Auto-switch to the tab that actually has chats
  useEffect(() => {
    if (!currentCounts) return;
    if (groups.length === 0 && channels.length > 0 && tab === "group") setTab("channel");
    else if (channels.length === 0 && groups.length > 0 && tab === "channel") setTab("group");
  }, [currentCounts, groups.length, channels.length, tab]);

  const selectedId = tab === "group" ? selectedGroup : selectedChannel;
  const visibleChats = (tab === "group" ? groups : channels).filter(
    (c) => selectedId === "all" || String(c.chatId) === selectedId,
  );
  const visiblePerChat = (data?.perChat ?? []).filter((c) => {
    const chatId = String(c.chat_id);
    const t = typeByChatId.get(chatId) ?? "unknown";
    const inTab = tab === "group" ? t !== "channel" : t === "channel";
    return inTab && (selectedId === "all" || chatId === selectedId);
  });
  const visibleRecent = (data?.recent ?? []).filter((e) => {
    const chatId = String(e.chat_id);
    const t = typeByChatId.get(chatId) ?? "unknown";
    const inTab = tab === "group" ? t !== "channel" : t === "channel";
    return inTab && (selectedId === "all" || chatId === selectedId);
  });

  const totalMembers = visibleChats.reduce((s, c) => s + (c.count ?? 0), 0);
  const totalJoins = visiblePerChat.reduce((s, c) => s + c.joins, 0);
  const totalLeaves = visiblePerChat.reduce((s, c) => s + c.leaves, 0);

  const cards = [
    { label: "Entradas (30d)", value: totalJoins, icon: UserPlus, color: "text-emerald-500" },
    { label: "Saídas (30d)", value: totalLeaves, icon: UserMinus, color: "text-rose-500" },
    { label: "Saldo (30d)", value: totalJoins - totalLeaves, icon: TrendingUp, color: "text-primary" },
    { label: "Membros atuais", value: totalMembers, icon: Users, color: "text-foreground" },
  ];

  const maxBar = Math.max(1, ...(data?.daily ?? []).flatMap((d) => [d.joins, d.leaves]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Membros dos grupos</h1>
        <p className="text-muted-foreground text-sm">
          Entradas e saídas detectadas pelos bots. Ative o rastreamento em <span className="font-medium">Contas Telegram</span> para começar a coletar dados.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "group" | "channel")}>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <TabsList>
            <TabsTrigger value="group">Grupos ({groups.length})</TabsTrigger>
            <TabsTrigger value="channel">Canais ({channels.length})</TabsTrigger>
          </TabsList>

          {tab === "group" ? (
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
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
              <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione um canal" /></SelectTrigger>
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

        <TabsContent value={tab} className="mt-4 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={`size-4 ${color}`} />
            </div>
            <div className="mt-3 text-3xl font-bold">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Últimos 30 dias</h2>
        {!data?.daily.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem eventos ainda.</p>
        ) : (
          <div className="space-y-1">
            {data.daily.slice(-30).map((d) => (
              <div key={d.day} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-muted-foreground tabular-nums">{d.day}</span>
                <div className="flex-1 flex items-center gap-1">
                  <div
                    className="h-3 bg-emerald-500/70 rounded"
                    style={{ width: `${(d.joins / maxBar) * 100}%` }}
                    title={`+${d.joins}`}
                  />
                  <span className="tabular-nums w-8 text-emerald-600">+{d.joins}</span>
                </div>
                <div className="flex-1 flex items-center gap-1">
                  <div
                    className="h-3 bg-rose-500/70 rounded"
                    style={{ width: `${(d.leaves / maxBar) * 100}%` }}
                    title={`-${d.leaves}`}
                  />
                  <span className="tabular-nums w-8 text-rose-600">-{d.leaves}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold">Contagem atual {tab === "group" ? "por grupo" : "por canal"}</h2>
          {countsQ.isFetching && <RefreshCw className="size-4 text-muted-foreground animate-spin" />}
        </div>
        {!visibleChats.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum {tab === "group" ? "grupo" : "canal"} vinculado às salas.</p>
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
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Entradas e saídas {tab === "group" ? "por grupo" : "por canal"}</h2>
        {!visiblePerChat.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento registrado.</p>
        ) : (
          <div className="space-y-2">
            {visiblePerChat.map((c) => (
              <div key={c.chat_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.chat_title || `Chat ${c.chat_id}`}</p>
                  <p className="text-xs text-muted-foreground">ID: {c.chat_id}</p>
                </div>
                <div className="flex gap-3 text-sm tabular-nums">
                  <span className="text-emerald-500">+{c.joins}</span>
                  <span className="text-rose-500">-{c.leaves}</span>
                  <span className="font-semibold">= {c.joins - c.leaves}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Eventos recentes (entradas e saídas)</h2>
        {!visibleRecent.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento para a seleção.</p>
        ) : (
          <div className="space-y-1">
            {visibleRecent.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {e.event_type === "join" ? (
                    <UserPlus className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <UserMinus className="size-3.5 text-rose-500 shrink-0" />
                  )}
                  <span className="truncate">
                    {e.tg_first_name || e.tg_username || "Usuário"}{" "}
                    <span className="text-muted-foreground">
                      {e.event_type === "join" ? "entrou em" : e.event_type === "kicked" ? "foi removido de" : "saiu de"}
                    </span>{" "}
                    {e.chat_title || e.chat_id}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                  {new Date(e.occurred_at).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}