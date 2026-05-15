import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Forward, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { getForwarderConfig, upsertForwarderConfig, listAccountChats } from "@/lib/engagement.functions";

export const Route = createFileRoute("/_authenticated/bots/encaminhador")({
  component: EncaminhadorPage,
});

function EncaminhadorPage() {
  const qc = useQueryClient();
  const get = useServerFn(getForwarderConfig);
  const upsert = useServerFn(upsertForwarderConfig);
  const listChats = useServerFn(listAccountChats);

  const roomsQ = useQuery({
    queryKey: ["rooms-pick"],
    queryFn: async () => (await supabase.from("rooms").select("id, name, photo_url").order("created_at", { ascending: false })).data ?? [],
  });
  const chatsQ = useQuery({ queryKey: ["account-chats"], queryFn: () => listChats() });

  const [roomId, setRoomId] = useState("");
  useEffect(() => { if (!roomId && roomsQ.data?.[0]?.id) setRoomId(roomsQ.data[0].id); }, [roomsQ.data, roomId]);

  const selectedRoom = (roomsQ.data ?? []).find((r: any) => r.id === roomId);
  const [roomPhotoError, setRoomPhotoError] = useState(false);
  useEffect(() => { setRoomPhotoError(false); }, [roomId]);

  const cfgQ = useQuery({ queryKey: ["fwd-cfg", roomId], enabled: !!roomId, queryFn: () => get({ data: { roomId } }) });

  const [enabled, setEnabled] = useState(false);
  const [source, setSource] = useState<string>("");
  const [targets, setTargets] = useState<number[]>([]);

  useEffect(() => {
    const c = cfgQ.data;
    if (!c) return;
    setEnabled(c.forwarder_enabled ?? false);
    setSource(c.forwarder_source_chat_id ? String(c.forwarder_source_chat_id) : "");
    setTargets((c.forwarder_target_chat_ids ?? []) as number[]);
  }, [cfgQ.data]);

  const save = useMutation({
    mutationFn: () => upsert({
      data: {
        roomId,
        enabled,
        sourceChatId: source ? Number(source) : null,
        targetChatIds: targets,
      },
    }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["fwd-cfg", roomId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const chats = (chatsQ.data ?? []) as any[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Forward className="size-6 text-primary" /> BotEncaminhador</h1>
        <p className="text-sm text-muted-foreground">Copia mensagens de um canal/grupo para outros automaticamente. O bot precisa estar como administrador no canal de origem.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Sala</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {selectedRoom?.photo_url && !roomPhotoError ? (
              <img
                src={selectedRoom.photo_url}
                alt={selectedRoom.name}
                className="size-14 rounded-md object-cover border border-border/60 shrink-0"
                onError={() => setRoomPhotoError(true)}
              />
            ) : (
              <div className="size-14 rounded-md border border-border/60 bg-muted shrink-0 flex items-center justify-center">
                <ImageIcon className="size-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {selectedRoom && (
                <p className="text-sm font-medium truncate mb-1">{selectedRoom.name}</p>
              )}
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(roomsQ.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {roomId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Configuração
              <div className="flex items-center gap-2 text-xs">Ativado <Switch checked={enabled} onCheckedChange={setEnabled} /></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Canal de origem</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                <SelectContent>
                  {chats.map((c) => <SelectItem key={c.chat_id} value={String(c.chat_id)}>{c.title ?? c.username ?? c.chat_id}</SelectItem>)}
                </SelectContent>
              </Select>
              {chats.length === 0 && <p className="text-xs text-muted-foreground">Nenhum chat detectado. Adicione o bot como admin em um canal e envie qualquer mensagem para ele aparecer aqui.</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Canais de destino</Label>
              <div className="space-y-2 border rounded-md p-3 max-h-72 overflow-auto">
                {chats.filter((c) => String(c.chat_id) !== source).map((c) => {
                  const checked = targets.includes(c.chat_id);
                  return (
                    <label key={c.chat_id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(v) => {
                        setTargets((prev) => v ? [...prev, c.chat_id] : prev.filter((x) => x !== c.chat_id));
                      }} />
                      <span>{c.title ?? c.username ?? c.chat_id}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}