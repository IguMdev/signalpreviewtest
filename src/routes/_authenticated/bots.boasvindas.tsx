import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { MessageCircle, Plus, Trash2, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { getWelcomeBotConfig, upsertWelcomeBotConfig } from "@/lib/engagement.functions";
import { PremiumEmojiPicker } from "@/components/PremiumEmojiPicker";

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
    queryFn: async () => (await supabase.from("rooms").select("id, name, photo_url").order("created_at", { ascending: false })).data ?? [],
  });
  const videosQ = useQuery({
    queryKey: ["videos-pick"],
    queryFn: async () => (await supabase.from("videos").select("id, title, kind, storage_path").order("created_at", { ascending: false })).data ?? [],
  });

  const premiumAccountsQ = useQuery({
    queryKey: ["premium-accounts-pick"],
    queryFn: async () => (await supabase.from("telegram_accounts").select("id, label, status, bot_username, phone, bot_first_name").eq("account_type", "premium").eq("is_active", true).order("label")).data ?? [],
  });

  const [roomId, setRoomId] = useState<string>("");
  useEffect(() => { if (!roomId && roomsQ.data?.[0]?.id) setRoomId(roomsQ.data[0].id); }, [roomsQ.data, roomId]);

  const selectedRoom = (roomsQ.data ?? []).find((r: any) => r.id === roomId);

  const cfgQ = useQuery({
    queryKey: ["welcome-cfg", roomId],
    enabled: !!roomId,
    queryFn: () => get({ data: { roomId } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("Seja bem-vindo(a), {name}! 🎉");
  const [imagePath, setImagePath] = useState<string>("");
  const [videoId, setVideoId] = useState<string>("");
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [premiumAccountId, setPremiumAccountId] = useState<string>("");
  const [roomPhotoError, setRoomPhotoError] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setRoomPhotoError(false); }, [roomId]);

  useEffect(() => {
    const c = cfgQ.data;
    if (!c) return;
    setEnabled(c.welcome_bot_enabled ?? false);
    setMessage(c.welcome_message ?? "Seja bem-vindo(a), {name}! 🎉");
    setImagePath(c.welcome_image_path ?? "");
    setVideoId(c.welcome_video_id ?? "");
    setPremiumEnabled((c as any).welcome_premium_enabled ?? false);
    setPremiumAccountId((c as any).welcome_premium_account_id ?? "");
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
        premiumEnabled,
        premiumAccountId: premiumAccountId || null,
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
                <SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
                <SelectContent>
                  {(roomsQ.data ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
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
              <div className="flex items-center gap-2 text-xs">
                Ativado <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Mensagem (use <code>{"{name}"}</code> para mencionar o membro)</Label>
                <PremiumEmojiPicker value={message} onChange={setMessage} targetRef={messageRef} />
              </div>
              <Textarea ref={messageRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} />
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

            <div className="rounded-lg border border-border/60 p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Enviar via conta Premium (emojis animados)</Label>
                  <p className="text-[11px] text-muted-foreground">Necessário para que os emojis premium <code>{"{NOME}"}</code> sejam renderizados.</p>
                </div>
                <Switch checked={premiumEnabled} onCheckedChange={setPremiumEnabled} />
              </div>
              {premiumEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Conta Premium</Label>
                  <Select value={premiumAccountId || "none"} onValueChange={(v) => setPremiumAccountId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma conta premium" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione...</SelectItem>
                       {(premiumAccountsQ.data ?? []).map((a: any) => {
                         const handle = a.bot_username ? `@${a.bot_username}` : a.phone || "";
                         return (
                           <SelectItem key={a.id} value={a.id}>
                             {a.label}{handle ? ` — ${handle}` : ""}{a.status !== "ok" ? ` (${a.status})` : ""}
                           </SelectItem>
                         );
                       })}
                    </SelectContent>
                  </Select>
                   {premiumAccountId && (() => {
                     const acc = (premiumAccountsQ.data ?? []).find((a: any) => a.id === premiumAccountId) as any;
                     if (!acc) return null;
                     const handle = acc.bot_username ? `@${acc.bot_username}` : acc.phone || "";
                     return (
                       <p className="text-[11px] text-muted-foreground">
                         Conectada como <span className="font-medium text-foreground">{acc.label}</span>{handle ? ` (${handle})` : ""}.
                       </p>
                     );
                   })()}
                   {(premiumAccountsQ.data ?? []).length === 0 && (
                    <p className="text-[11px] text-amber-500">Nenhuma conta Premium conectada. Conecte uma em "Contas Telegram".</p>
                  )}
                </div>
              )}
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
            </div>
            <p className="text-xs text-muted-foreground mt-2">Aproximação visual — o Telegram pode renderizar com pequenas diferenças.</p>
          </CardContent>
        </Card>
      )}

      {roomId && <ExtrasSection roomId={roomId} videos={videosQ.data ?? []} premiumAccounts={premiumAccountsQ.data ?? []} />}
    </div>
  );
}

type ExtraRow = {
  id: string;
  room_id: string;
  user_id: string;
  sort_order: number;
  content: string | null;
  image_path: string | null;
  video_id: string | null;
  premium_enabled: boolean;
  premium_account_id: string | null;
  delay_seconds: number;
  parse_mode: string;
};

function ExtrasSection({ roomId, videos, premiumAccounts }: { roomId: string; videos: any[]; premiumAccounts: any[] }) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ["welcome-extras", roomId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("welcome_extra_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ExtraRow[];
    },
  });

  async function addExtra() {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return;
    const nextOrder = (listQ.data?.length ?? 0) + 1;
    const { error } = await (supabase as any).from("welcome_extra_messages").insert({
      user_id: userId,
      room_id: roomId,
      sort_order: nextOrder,
      content: "",
      delay_seconds: 2,
      parse_mode: "HTML",
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["welcome-extras", roomId] });
  }

  async function removeExtra(id: string) {
    const { error } = await (supabase as any).from("welcome_extra_messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["welcome-extras", roomId] });
  }

  async function move(id: string, dir: -1 | 1) {
    const list = listQ.data ?? [];
    const idx = list.findIndex((r) => r.id === id);
    const swap = list[idx + dir];
    if (!swap) return;
    await (supabase as any).from("welcome_extra_messages").update({ sort_order: swap.sort_order }).eq("id", id);
    await (supabase as any).from("welcome_extra_messages").update({ sort_order: list[idx].sort_order }).eq("id", swap.id);
    qc.invalidateQueries({ queryKey: ["welcome-extras", roomId] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Sequência de mensagens
          <Button size="sm" variant="outline" onClick={addExtra}>
            <Plus className="size-4 mr-1" /> Adicionar mensagem
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(listQ.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem extra. A mensagem principal acima é enviada sozinha. Clique em "Adicionar mensagem" para criar uma sequência.</p>
        )}
        {(listQ.data ?? []).map((row, i) => (
          <ExtraEditor
            key={row.id}
            row={row}
            index={i}
            total={(listQ.data ?? []).length}
            videos={videos}
            premiumAccounts={premiumAccounts}
            roomId={roomId}
            onChanged={() => qc.invalidateQueries({ queryKey: ["welcome-extras", roomId] })}
            onRemove={() => removeExtra(row.id)}
            onMoveUp={() => move(row.id, -1)}
            onMoveDown={() => move(row.id, 1)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ExtraEditor({
  row, index, total, videos, premiumAccounts, roomId, onChanged, onRemove, onMoveUp, onMoveDown,
}: {
  row: ExtraRow;
  index: number;
  total: number;
  videos: any[];
  premiumAccounts: any[];
  roomId: string;
  onChanged: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [content, setContent] = useState(row.content ?? "");
  const [imagePath, setImagePath] = useState(row.image_path ?? "");
  const [videoId, setVideoId] = useState(row.video_id ?? "");
  const [premiumEnabled, setPremiumEnabled] = useState(row.premium_enabled ?? false);
  const [premiumAccountId, setPremiumAccountId] = useState(row.premium_account_id ?? "");
  const [delay, setDelay] = useState(row.delay_seconds ?? 2);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  async function uploadImage(file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `welcome/${roomId}/extra-${row.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("room-images").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    setImagePath(path);
    toast.success("Imagem enviada");
  }

  async function save() {
    setSaving(true);
    const { error } = await (supabase as any).from("welcome_extra_messages").update({
      content: content || null,
      image_path: imagePath || null,
      video_id: videoId || null,
      premium_enabled: premiumEnabled,
      premium_account_id: premiumAccountId || null,
      delay_seconds: Math.max(0, Math.min(300, Number(delay) || 0)),
    }).eq("id", row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    onChanged();
  }

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Mensagem #{index + 2}</div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onMoveUp} disabled={index === 0}><ArrowUp className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onMoveDown} disabled={index === total - 1}><ArrowDown className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-3 items-end">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Texto</Label>
            <PremiumEmojiPicker value={content} onChange={setContent} targetRef={contentRef} />
          </div>
          <Textarea ref={contentRef} value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={4000} />
        </div>
        <div className="space-y-1.5">
          <Label>Esperar (s)</Label>
          <Input type="number" min={0} max={300} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Imagem (opcional)</Label>
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          {imagePath && <p className="text-xs text-muted-foreground truncate">{imagePath} <button onClick={() => setImagePath("")} className="underline ml-2">remover</button></p>}
        </div>
        <div className="space-y-1.5">
          <Label>Vídeo (opcional)</Label>
          <Select value={videoId || "none"} onValueChange={(v) => setVideoId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Sem vídeo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem vídeo</SelectItem>
              {videos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.title} {v.kind === "round" ? "(redondo)" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 p-3 space-y-3 bg-background/50">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Enviar via conta Premium</Label>
          <Switch checked={premiumEnabled} onCheckedChange={setPremiumEnabled} />
        </div>
        {premiumEnabled && (
          <Select value={premiumAccountId || "none"} onValueChange={(v) => setPremiumAccountId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione uma conta premium" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione...</SelectItem>
              {premiumAccounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.label} {a.status !== "ok" ? `(${a.status})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <Button size="sm" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar mensagem"}</Button>
    </div>
  );
}