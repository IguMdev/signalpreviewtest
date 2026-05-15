import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/bots/logs")({
  component: BotLogsPage,
});

const eventColor: Record<string, string> = {
  received: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  sent: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  skipped: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  failed: "bg-rose-500/15 text-rose-500 border-rose-500/30",
};

function BotLogsPage() {
  const [bot, setBot] = useState<string>("all");
  const [event, setEvent] = useState<string>("all");

  const q = useQuery({
    queryKey: ["bot-logs", bot, event],
    queryFn: async () => {
      let query = supabase
        .from("bot_execution_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (bot !== "all") query = query.eq("bot_type", bot);
      if (event !== "all") query = query.eq("event", event);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 8000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="size-6 text-primary" /> Logs dos Bots
          </h1>
          <p className="text-sm text-muted-foreground">Eventos recebidos e envios feitos por BoasVindas e Encaminhador.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={bot} onValueChange={setBot}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os bots</SelectItem>
              <SelectItem value="boasvindas">BotBoasVindas</SelectItem>
              <SelectItem value="encaminhador">BotEncaminhador</SelectItem>
            </SelectContent>
          </Select>
          <Select value={event} onValueChange={setEvent}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos eventos</SelectItem>
              <SelectItem value="received">Recebidos</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="skipped">Ignorados</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => q.refetch()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos 200 eventos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {(q.data ?? []).map((row: any) => (
              <div key={row.id} className="px-4 py-3 grid gap-1 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={eventColor[row.event] ?? ""}>{row.event}</Badge>
                  <Badge variant="outline">{row.bot_type}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("pt-BR")}</span>
                  {row.chat_id && <span className="text-xs text-muted-foreground">chat: <code>{row.chat_id}</code></span>}
                  {row.target_chat_id && <span className="text-xs text-muted-foreground">→ <code>{row.target_chat_id}</code></span>}
                  {row.tg_first_name && <span className="text-xs">👤 {row.tg_first_name}{row.tg_username ? ` (@${row.tg_username})` : ""}</span>}
                </div>
                {row.message && <div className="text-xs text-foreground/80 line-clamp-2 whitespace-pre-wrap">{row.message}</div>}
                {row.error && <div className="text-xs text-rose-500">erro: {row.error}</div>}
              </div>
            ))}
            {q.data?.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum evento ainda. Adicione o bot a um canal/grupo e aguarde.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
