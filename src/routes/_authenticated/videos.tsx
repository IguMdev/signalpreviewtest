import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { sendVideoNoteNow, deleteVideo } from "@/lib/videos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Trash2, Send, Video as VideoIcon, Loader2, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/videos")({
  component: VideosPage,
});

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_DURATION = 60;

async function validateVideoFile(file: File): Promise<{ duration: number }> {
  if (file.size > MAX_BYTES) {
    throw new Error("O vídeo deve ter no máximo 50 MB (limite do Telegram).");
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    v.onloadedmetadata = () => {
      const dur = v.duration;
      const w = v.videoWidth;
      const h = v.videoHeight;
      URL.revokeObjectURL(url);
      if (!w || !h || w !== h) {
        reject(
          new Error(
            `Para virar redondo no Telegram o vídeo precisa ser quadrado (atual: ${w}x${h}). Recorte para 1:1 antes de enviar.`,
          ),
        );
        return;
      }
      if (dur > MAX_DURATION + 0.5) {
        reject(new Error(`Duração máxima de 60s (atual: ${Math.round(dur)}s).`));
        return;
      }
      resolve({ duration: Math.round(dur) });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler o vídeo."));
    };
  });
}

function VideosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sendNow = useServerFn(sendVideoNoteNow);
  const delFn = useServerFn(deleteVideo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [pendingFile, setPendingFile] = useState<{ file: File; duration: number } | null>(null);

  const [sendDialog, setSendDialog] = useState<{ videoId: string; title: string } | null>(null);
  const [accountId, setAccountId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [sending, setSending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const videos = useQuery({
    queryKey: ["videos"],
    queryFn: async () =>
      (
        await supabase
          .from("videos")
          .select("id, title, storage_path, file_size, duration_seconds, created_at")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const accounts = useQuery({
    queryKey: ["accounts-min"],
    queryFn: async () => (await supabase.from("telegram_accounts").select("id, label")).data ?? [],
  });

  const rooms = useQuery({
    queryKey: ["rooms-min"],
    queryFn: async () => (await supabase.from("rooms").select("id, name, default_account_id")).data ?? [],
  });

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { duration } = await validateVideoFile(f);
      setPendingFile({ file: f, duration });
      setTitle(f.name.replace(/\.mp4$/i, ""));
    } catch (err) {
      toast.error((err as Error).message);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const upload = async () => {
    if (!pendingFile || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.mp4`;
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(path, pendingFile.file, { contentType: "video/mp4", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("videos").insert({
        user_id: user.id,
        title: title.trim() || "Vídeo",
        storage_path: path,
        file_size: pendingFile.file.size,
        duration_seconds: pendingFile.duration,
        mime_type: "video/mp4",
      });
      if (insErr) throw insErr;
      toast.success("Vídeo enviado");
      setPendingFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["videos"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      await delFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Vídeo removido");
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitSend = async () => {
    if (!sendDialog || !accountId || !roomId) return;
    setSending(true);
    try {
      const { data: chats } = await supabase
        .from("room_chats")
        .select("chat_id")
        .eq("room_id", roomId);
      const chatIds = (chats ?? []).map((c) => c.chat_id);
      if (!chatIds.length) {
        toast.error("Esse grupo não tem chats vinculados.");
        return;
      }
      const res = await sendNow({
        data: { videoId: sendDialog.videoId, accountId, chatIds },
      });
      const okCount = res.results.filter((r) => r.ok).length;
      const failCount = res.results.length - okCount;
      if (failCount === 0) toast.success(`Enviado para ${okCount} chat(s)`);
      else toast.warning(`Enviado: ${okCount} · Falhas: ${failCount}`);
      setSendDialog(null);
      setAccountId("");
      setRoomId("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Vídeos redondos</h1>
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="size-4" />
            Como deixar 1:1
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Envie vídeos no formato "video note" (redondo) do Telegram. Exigências: vídeo quadrado
          (1:1), MP4/H.264, até 60s e 50 MB. Fora desse formato o Telegram rejeita ou envia como
          vídeo normal.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Vídeo quadrado MP4/H.264 (≤ 60s, ≤ 50 MB)</Label>
            <Input ref={fileRef} type="file" accept="video/*" onChange={onPickFile} />
          </div>
          <div className="flex-1 space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do vídeo" />
          </div>
          <Button onClick={upload} disabled={!pendingFile || uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Enviar
          </Button>
        </div>
        {pendingFile && (
          <p className="text-xs text-muted-foreground">
            Pronto: {pendingFile.file.name} · {pendingFile.duration}s ·{" "}
            {(pendingFile.file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {videos.data?.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground text-sm md:col-span-2 lg:col-span-3">
            <VideoIcon className="size-8 mx-auto mb-2 opacity-50" />
            Nenhum vídeo ainda.
          </Card>
        )}
        {videos.data?.map((v) => (
          <Card key={v.id} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                <VideoIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{v.title}</p>
                <p className="text-xs text-muted-foreground">
                  {v.duration_seconds ?? "?"}s ·{" "}
                  {v.file_size ? (v.file_size / 1024 / 1024).toFixed(2) + " MB" : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setSendDialog({ videoId: v.id, title: v.title })}
              >
                <Send className="size-4" />
                Enviar agora
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm("Excluir este vídeo?")) delMut.mutate(v.id);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!sendDialog} onOpenChange={(o) => !o && setSendDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar "{sendDialog?.title}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select
                value={roomId}
                onValueChange={(v) => {
                  setRoomId(v);
                  const r = rooms.data?.find((x) => x.id === v);
                  if (r?.default_account_id) setAccountId(r.default_account_id);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.data?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta Telegram</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.data?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={submitSend} disabled={!accountId || !roomId || sending}>
              {sending && <Loader2 className="size-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Como deixar o vídeo 1:1 (redondo)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">Requisitos do Telegram</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Proporção <b>1:1</b> (quadrado, ex.: 480×480 ou 640×640)</li>
                <li>Formato <b>MP4</b> com codec <b>H.264</b> + áudio AAC</li>
                <li>Duração <b>até 60s</b></li>
                <li>Tamanho <b>até 50 MB</b></li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-1">📱 No celular (mais fácil)</p>
              <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
                <li>Abra o <b>CapCut</b> ou <b>InShot</b> (grátis)</li>
                <li>Importe o vídeo</li>
                <li>Em "Proporção / Canvas", escolha <b>1:1</b></li>
                <li>Arraste o vídeo para enquadrar a parte que quer mostrar</li>
                <li>Corte para no máximo 60 segundos</li>
                <li>Exporte em <b>720p</b> ou <b>480p</b> (mantém abaixo de 50 MB)</li>
              </ol>
            </div>

            <div>
              <p className="font-medium mb-1">💻 No computador (ffmpeg)</p>
              <p className="text-muted-foreground mb-1">
                Recorta para o quadrado central, redimensiona para 480×480 e comprime:
              </p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`ffmpeg -i entrada.mp4 \\
  -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=480:480" \\
  -t 60 -c:v libx264 -crf 28 -preset medium \\
  -c:a aac -b:a 64k -movflags +faststart \\
  saida.mp4`}
              </pre>
            </div>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              ⚠️ Se o arquivo final passar de 50 MB, diminua a resolução (ex.: 360×360) ou aumente
              o <code>-crf</code> para 30. O Telegram rejeita arquivos maiores.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setHelpOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}