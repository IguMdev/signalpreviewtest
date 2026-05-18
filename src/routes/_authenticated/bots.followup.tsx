import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getFollowupSettings,
  upsertFollowupSettings,
  listFollowupMessages,
  upsertFollowupMessage,
  deleteFollowupMessage,
  listFollowupLeads,
  setFollowupLeadStatus,
  testFollowupMessage,
  type FollowupMessageRow,
} from "@/lib/followup.functions";

export const Route = createFileRoute("/_authenticated/bots/followup")({
  component: FollowUpPage,
});

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}

function FollowUpPage() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getFollowupSettings);
  const upsertSettings = useServerFn(upsertFollowupSettings);
  const listMsgs = useServerFn(listFollowupMessages);
  const upsertMsg = useServerFn(upsertFollowupMessage);
  const delMsg = useServerFn(deleteFollowupMessage);
  const listLeads = useServerFn(listFollowupLeads);
  const setLeadStatus = useServerFn(setFollowupLeadStatus);
  const testMsg = useServerFn(testFollowupMessage);

  const roomsQ = useQuery({
    queryKey: ["rooms-pick"],
    queryFn: async () =>
      (await supabase.from("rooms").select("id, name").order("created_at", { ascending: false })).data ?? [],
  });

  const videosQ = useQuery({
    queryKey: ["videos-pick-fu"],
    queryFn: async () =>
      (await supabase.from("videos").select("id, title, kind, storage_path").order("created_at", { ascending: false })).data ?? [],
  });

  const [roomId, setRoomId] = useState<string>("");
  useEffect(() => {
    if (!roomId && roomsQ.data?.[0]?.id) setRoomId(roomsQ.data[0].id);
  }, [roomsQ.data, roomId]);

  const settingsQ = useQuery({
    queryKey: ["followup-settings", roomId],
    enabled: !!roomId,
    queryFn: () => getSettings({ data: { roomId } }),
  });
  const msgsQ = useQuery({
    queryKey: ["followup-messages", roomId],
    enabled: !!roomId,
    queryFn: () => listMsgs({ data: { roomId } }),
  });
  const leadsQ = useQuery({
    queryKey: ["followup-leads", roomId],
    enabled: !!roomId,
    queryFn: () => listLeads({ data: { roomId } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [ctaEnabled, setCtaEnabled] = useState(true);
  const [ctaText, setCtaText] = useState("Iniciar conversa privada 💬");

  useEffect(() => {
    const s = settingsQ.data?.settings;
    const c = settingsQ.data?.cta;
    if (s) setEnabled(s.enabled);
    if (c) {
      setCtaEnabled(c.followup_cta_enabled);
      setCtaText(c.followup_cta_button_text || "Iniciar conversa privada 💬");
    }
  }, [settingsQ.data]);

  const saveSettings = useMutation({
    mutationFn: () =>
      upsertSettings({
        data: { roomId, enabled, timezone: "America/Sao_Paulo", ctaEnabled, ctaButtonText: ctaText },
      }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["followup-settings", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<Partial<FollowupMessageRow> | null>(null);

  const saveMsg = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Sem dados");
      return upsertMsg({
        data: {
          id: editing.id,
          roomId,
          dayNumber: Number(editing.day_number ?? 1),
          sendTime: editing.send_time?.slice(0, 5) || "09:00",
          content: editing.content || null,
          imagePath: editing.image_path || null,
          imageMime: editing.image_mime || null,
          videoId: editing.video_id || null,
          parseMode: "HTML",
          premiumEnabled: false,
          buttonText: editing.button_text || null,
          buttonUrl: editing.button_url || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Mensagem salva");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["followup-messages", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadImage(file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `followup/${roomId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("room-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing((prev) => (prev ? { ...prev, image_path: path, image_mime: file.type } : prev));
    toast.success("Imagem enviada");
  }

  const removeMsg = useMutation({
    mutationFn: (id: string) => delMsg({ data: { id } }),
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["followup-messages", roomId] });
    },
  });

  const counts = leadsQ.data?.counts ?? { active: 0, stopped: 0, completed: 0 };
  const messages = msgsQ.data ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="size-6 text-primary" /> Bot Follow-Up
        </h1>
        <p className="text-sm text-muted-foreground">
          Sequência diária de mensagens enviadas no privado dos leads que iniciaram seu bot.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sala</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a sala" />
            </SelectTrigger>
            <SelectContent>
              {(roomsQ.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {roomId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Configuração
              <div className="flex items-center gap-2 text-xs">
                Ativado <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Botão "Iniciar" no Boas-Vindas</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Anexa um botão na mensagem do Bot Boas-Vindas que leva o lead ao privado e o inscreve no follow-up.
                  </p>
                </div>
                <Switch checked={ctaEnabled} onCheckedChange={setCtaEnabled} />
              </div>
              {ctaEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto do botão</Label>
                  <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} maxLength={64} />
                </div>
              )}
            </div>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              {saveSettings.isPending ? "Salvando..." : "Salvar configurações"}
            </Button>
          </CardContent>
        </Card>
      )}

      {roomId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Sequência de mensagens
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditing({
                    day_number: (messages[messages.length - 1]?.day_number ?? 0) + 1,
                    send_time: "09:00",
                    content: "",
                  })
                }
              >
                <Plus className="size-4 mr-1" /> Adicionar dia
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem cadastrada ainda.</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Dia {m.day_number} · {m.send_time?.slice(0, 5)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.content || "(sem texto)"}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover mensagem?")) removeMsg.mutate(m.id);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editing.id ? "Editar mensagem" : "Nova mensagem"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dia</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={editing.day_number ?? 1}
                  onChange={(e) => setEditing({ ...editing, day_number: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
              <div>
                <Label className="text-xs">Horário (HH:MM)</Label>
                <Input
                  type="time"
                  value={editing.send_time?.slice(0, 5) || "09:00"}
                  onChange={(e) => setEditing({ ...editing, send_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Texto (use {"{name}"} para mencionar o lead)</Label>
              <Textarea
                rows={5}
                value={editing.content ?? ""}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                maxLength={4000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Imagem (opcional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
                {editing.image_path && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={publicUrl("room-images", editing.image_path)}
                      alt="prévia"
                      className="size-16 rounded object-cover"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing({ ...editing, image_path: null, image_mime: null })}
                    >
                      Remover
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Vídeo (opcional)</Label>
                <Select
                  value={editing.video_id || "none"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, video_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(videosQ.data ?? []).map((v: { id: string; title: string; kind: string }) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.title} {v.kind === "round" ? "(redondo)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Texto do botão (opcional)</Label>
                <Input
                  value={editing.button_text ?? ""}
                  onChange={(e) => setEditing({ ...editing, button_text: e.target.value })}
                  maxLength={64}
                />
              </div>
              <div>
                <Label className="text-xs">URL do botão (opcional)</Label>
                <Input
                  value={editing.button_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, button_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => saveMsg.mutate()} disabled={saveMsg.isPending}>
                {saveMsg.isPending ? "Salvando..." : "Salvar"}
              </Button>
              {editing.id && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const raw = prompt("Chat ID do Telegram para teste (seu user_id ou de um lead):");
                    if (!raw) return;
                    const chatId = parseInt(raw, 10);
                    if (!Number.isFinite(chatId)) {
                      toast.error("Chat ID inválido");
                      return;
                    }
                    try {
                      await testMsg({ data: { id: editing.id!, chatId } });
                      toast.success("Enviado");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Testar agora
                </Button>
              )}
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {roomId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span>
                Ativos: <b>{counts.active}</b>
              </span>
              <span>
                Parados: <b>{counts.stopped}</b>
              </span>
              <span>
                Completos: <b>{counts.completed}</b>
              </span>
            </div>
            <div className="space-y-1 max-h-96 overflow-auto">
              {(leadsQ.data?.leads ?? []).map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 text-xs border-b py-1"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{l.first_name ?? "—"}</span>
                    {l.username ? <span className="text-muted-foreground"> @{l.username}</span> : null}
                    <span className="ml-2 text-muted-foreground">
                      dia {l.last_sent_day ?? 0} · {l.status}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setLeadStatus({ data: { id: l.id, status: l.status === "active" ? "stopped" : "active" } })
                        .then(() => qc.invalidateQueries({ queryKey: ["followup-leads", roomId] }))
                    }
                  >
                    {l.status === "active" ? "Pausar" : "Reativar"}
                  </Button>
                </div>
              ))}
              {(leadsQ.data?.leads ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum lead ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}