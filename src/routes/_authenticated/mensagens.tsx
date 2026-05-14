import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { scheduleMessage, cancelMessage } from "@/lib/messages.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, CalendarClock, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: MensagensPage,
});

function MensagensPage() {
  const qc = useQueryClient();
  const schedule = useServerFn(scheduleMessage);
  const cancel = useServerFn(cancelMessage);
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [content, setContent] = useState("");
  const [when, setWhen] = useState("");

  const rooms = useQuery({ queryKey: ["rooms-min"], queryFn: async () => (await supabase.from("rooms").select("id, name, default_account_id")).data ?? [] });
  const accounts = useQuery({ queryKey: ["accounts-min"], queryFn: async () => (await supabase.from("telegram_accounts").select("id, label")).data ?? [] });
  const list = useQuery({
    queryKey: ["scheduled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduled_messages")
        .select("id, content, scheduled_at, status, last_error, room_id")
        .order("scheduled_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      await schedule({ data: { roomId, accountId, content, scheduledAt: new Date(when).toISOString() } });
    },
    onSuccess: () => {
      toast.success("Agendamento criado");
      setOpen(false);
      setContent("");
      setWhen("");
      qc.invalidateQueries({ queryKey: ["scheduled"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Programe envios de sinais para seus grupos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Novo agendamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={roomId} onValueChange={(v) => { setRoomId(v); const r = rooms.data?.find((x) => x.id === v); if (r?.default_account_id) setAccountId(r.default_account_id); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{rooms.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mensagem (HTML permitido)</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
              </div>
              <div className="space-y-2">
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => submitMut.mutate()} disabled={!roomId || !accountId || !content || !when}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2">
        {list.data?.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground text-sm">
            <CalendarClock className="size-8 mx-auto mb-2 opacity-50" />
            Nenhum agendamento ainda.
          </Card>
        )}
        {list.data?.map((m) => (
          <Card key={m.id} className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm whitespace-pre-wrap">{(m.content ?? "🎬 Vídeo").slice(0, 200)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(m.scheduled_at).toLocaleString("pt-BR")} · <span className="capitalize">{m.status}</span>
                {m.last_error && ` · ${m.last_error}`}
              </p>
            </div>
            {m.status === "pending" && (
              <Button size="sm" variant="ghost" onClick={async () => { await cancel({ data: { id: m.id } }); qc.invalidateQueries({ queryKey: ["scheduled"] }); }}>
                <X className="size-4" />
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}