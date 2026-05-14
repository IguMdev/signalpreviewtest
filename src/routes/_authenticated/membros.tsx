import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentMemberCounts, getMemberStats } from "@/lib/telegram-tracking.functions";
import { Card } from "@/components/ui/card";
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

  const cards = [
    { label: "Entradas hoje", value: data?.joinsToday ?? 0, icon: UserPlus, color: "text-emerald-500" },
    { label: "Saídas hoje", value: data?.leavesToday ?? 0, icon: UserMinus, color: "text-rose-500" },
    { label: "Saldo (30d)", value: data?.net30 ?? 0, icon: TrendingUp, color: "text-primary" },
    { label: "Membros atuais", value: currentCounts?.total ?? 0, icon: Users, color: "text-foreground" },
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
          <h2 className="font-semibold">Contagem atual por grupo</h2>
          {countsQ.isFetching && <RefreshCw className="size-4 text-muted-foreground animate-spin" />}
        </div>
        {!currentCounts?.chats.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum chat vinculado às salas.</p>
        ) : (
          <div className="space-y-2">
            {currentCounts.chats.map((c) => (
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
        <h2 className="font-semibold mb-4">Por grupo</h2>
        {!data?.perChat.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum grupo com eventos.</p>
        ) : (
          <div className="space-y-2">
            {data.perChat.map((c) => (
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
        <h2 className="font-semibold mb-4">Eventos recentes</h2>
        {!data?.recent.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento.</p>
        ) : (
          <div className="space-y-1">
            {data.recent.map((e) => (
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
    </div>
  );
}