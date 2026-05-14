import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Users, CalendarClock, Wallet, Sparkles, CreditCard, UserPlus, UserMinus, Bot } from "lucide-react";
import { getMySubscriptions } from "@/lib/engagement.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const fetchSubs = useServerFn(getMySubscriptions);

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

  const activeSubs = ((subsQ.data ?? []) as any[]).filter((s) => s.status === "active");
  const monthlyTotal = activeSubs.reduce(
    (sum, s) => sum + Number(s.plan?.price_brl ?? 0),
    0,
  );
  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards = [
    { label: "Mensalidade atual", value: fmtBRL(monthlyTotal), icon: CreditCard },
    { label: "Créditos", value: stats.data?.credits ?? 0, icon: Wallet },
    { label: "Contas Telegram", value: stats.data?.accounts ?? 0, icon: Send },
    { label: "Bots ativos", value: stats.data?.activeBots ?? 0, icon: Bot },
    { label: "Grupos", value: stats.data?.rooms ?? 0, icon: Users },
    { label: "Entradas hoje", value: stats.data?.joinsToday ?? 0, icon: UserPlus },
    { label: "Saídas hoje", value: stats.data?.leavesToday ?? 0, icon: UserMinus },
    { label: "Saldo de membros", value: stats.data?.netTotal ?? 0, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá{stats.data?.name ? `, ${stats.data.name}` : ""}</h1>
        <p className="text-muted-foreground text-sm">Visão geral da sua sala de sinais.</p>
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