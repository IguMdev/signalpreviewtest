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
import { MessageCircle, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { getWelcomeBotConfig, upsertWelcomeBotConfig } from "@/lib/engagement.functions";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}
function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export const Route = createFileRoute("/_authenticated/bots/boasvindas")({
  component: BoasVindasPage,
});

function BoasVindasPage() {
  const qc = useQueryClient();
  const get = useServerFn(getWelcomeBotConfig);
  const upsert = useServerFn(upsertWelcomeBotConfig);

  const roomsQ = useQuery({
    queryKey: ["rooms-pick"],
    queryFn: async () => (await supabase.from("rooms").select("id, name").order("created_at", { ascending: false })).data ?? [],
  });
  const videosQ = useQuery({
    queryKey: ["videos-pick"],
    queryFn: async () => (await supabase.from("videos").select("id, title, kind, storage_path").order("created_at", { ascending: false })).data ?? [],
  });

  const [roomId, setRoomId] = useState<string>("");
  useEffect(() => { if (!roomId && roomsQ.data?.[0]?.id) setRoomId(roomsQ.data[0].id); }, [roomsQ.data, roomId]);

  const cfgQ = useQuery({
    queryKey: ["welcome-cfg", roomId],
    enabled: !!roomId,
    queryFn: () => get({ data: { roomId } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("Seja bem-vindo(a), {name}! 🎉");
  const [imagePath, setImagePath] = useState<string>("");
  const [videoId, setVideoId] = useState<string>("");
  const [btnText, setBtnText] = useState("");
  const [btnUrl, setBtnUrl] = useState("");

  useEffect(() => {
    const c = cfgQ.data;
    if (!c) return;
    setEnabled(c.welcome_bot_enabled ?? false);
    setMessage(c.welcome_message ?? "Seja bem-vindo(a), {name}! 🎉");
    setImagePath(c.welcome_image_path ?? "");
    setVideoId(c.welcome_video_id ?? "");
    setBtnText(c.welcome_button_text ?? "");
    setBtnUrl(c.welcome_button_url ?? "");
  }, [cfgQ.data]);

  async function uploadImage(file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `welcome/${roomId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("room-images").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    setImagePath(path);
    toast.success("Imagem enviada");
  }

  const save = useMutation({
    mutationFn: () => upsert({
      data: {
        roomId,
        enabled,
        message: message || null,
        imagePath: imagePath || null,
        videoId: videoId || null,
        buttonText: btnText || null,
        buttonUrl: btnUrl || null,
      },
    }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["welcome-cfg", roomId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle className="size-6 text-primary" /> BotBoasVindas</h1>
        <p className="text-sm text-muted-foreground">Mensagem automática para novos membros do seu grupo.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Sala</CardTitle></CardHeader>
        <CardContent>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
            <SelectContent>
              {(roomsQ.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
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
            <div className="space-y-1.5">
              <Label>Mensagem (use <code>{"{name}"}</code> para mencionar o membro)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} />
            </div>

            <div className="space-y-1.5">
              <Label>Imagem (opcional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              {imagePath && <p className="text-xs text-muted-foreground">Atual: {imagePath} <button onClick={() => setImagePath("")} className="underline ml-2">remover</button></p>}
            </div>

            <div className="space-y-1.5">
              <Label>Vídeo (opcional, prioridade sobre imagem)</Label>
              <Select value={videoId || "none"} onValueChange={(v) => setVideoId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem vídeo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vídeo</SelectItem>
                  {(videosQ.data ?? []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.title} {v.kind === "round" ? "(redondo)" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Texto do botão (opcional)</Label>
                <Input value={btnText} onChange={(e) => setBtnText(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>URL do botão</Label>
                <Input value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </CardContent>
        </Card>
      )}

      {roomId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pré-visualização</CardTitle></CardHeader>
          <CardContent>
            <div className="max-w-md rounded-2xl border border-border/60 bg-muted/30 p-3 space-y-2">
              {(() => {
                const selectedVideo = (videosQ.data ?? []).find((v: any) => v.id === videoId) as any;
                if (selectedVideo?.storage_path) {
                  const url = publicUrl("videos", selectedVideo.storage_path);
                  return selectedVideo.kind === "round" ? (
                    <video src={url} controls className="size-48 rounded-full object-cover mx-auto" />
                  ) : (
                    <video src={url} controls className="w-full rounded-lg" />
                  );
                }
                if (imagePath) {
                  return <img src={publicUrl("room-images", imagePath)} alt="prévia" className="w-full rounded-lg" />;
                }
                return null;
              })()}
              <div
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: renderTemplate(message || "", {
                    name: '<a class="text-primary underline">Novo Membro</a>',
                    first_name: "Novo Membro",
                    username: "novomembro",
                  }),
                }}
              />
              {btnText && btnUrl && (
                <a
                  href={btnUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-sm font-medium rounded-lg bg-primary text-primary-foreground py-2"
                >
                  {btnText}
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Aproximação visual — o Telegram pode renderizar com pequenas diferenças.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}