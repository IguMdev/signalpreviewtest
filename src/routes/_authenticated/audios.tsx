import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { sendAudioNow, deleteAudio } from "@/lib/audios.functions";
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
import { Upload, Trash2, Send, Mic, Loader2, HelpCircle } from "lucide-react";

function AudioPreview({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ["audio-signed", path],
    queryFn: async () => {
      const { data } = await supabase.storage.from("audio-files").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });

  return (
    <div className="w-full h-12 bg-muted/50 rounded-md flex items-center px-3">
      {url ? (
        <audio
          src={url}
          className="w-full h-8"
          controls
          preload="metadata"
        />
      ) : (
        <Loader2 className="size-5 animate-spin text-muted-foreground mx-auto" />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/audios")({
  component: AudiosPage,
});

const MAX_BYTES_AUDIO = 50 * 1024 * 1024;

async function validateAudioFile(file: File): Promise<{ duration: number }> {
  if (file.size > MAX_BYTES_AUDIO) {
    throw new Error("O áudio deve ter no máximo 50 MB.");
  }
  if (!file.name.toLowerCase().endsWith(".ogg")) {
    throw new Error("O áudio deve estar no formato .ogg para ser enviado como nota de voz no Telegram.");
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.src = url;
    a.onloadedmetadata = () => {
      const dur = a.duration;
      URL.revokeObjectURL(url);
      resolve({ duration: Math.round(dur) });
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler o arquivo de áudio. Certifique-se de que é um formato válido."));
    };
  });
}

function AudiosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sendNow = useServerFn(sendAudioNow);
  const delFn = useServerFn(deleteAudio);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [pendingFile, setPendingFile] = useState<{ file: File; duration: number } | null>(null);

  const [sendDialog, setSendDialog] = useState<{ audioId: string; title: string } | null>(null);
  const [accountId, setAccountId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [sending, setSending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const audios = useQuery({
    queryKey: ["audios"],
    queryFn: async () =>
      (
        await supabase
          .from("audios")
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
      const { duration } = await validateAudioFile(f);
      setPendingFile({ file: f, duration });
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    } catch (err) {
      toast.error((err as Error).message);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const upload = async () => {
    if (!pendingFile || !user) return;
    setUploading(true);
    try {
      const mimeType = pendingFile.file.type || "audio/ogg";
      const path = `${user.id}/${crypto.randomUUID()}.ogg`;
      
      const { error: upErr } = await supabase.storage
        .from("audio-files")
        .upload(path, pendingFile.file, { contentType: mimeType, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("audios").insert({
        user_id: user.id,
        title: title.trim() || "Áudio",
        storage_path: path,
        file_size: pendingFile.file.size,
        duration_seconds: pendingFile.duration,
        mime_type: mimeType,
      } as never);
      if (insErr) throw insErr;
      
      toast.success("Áudio enviado com sucesso!");
      setPendingFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["audios"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      await delFn({ data: id });
    },
    onSuccess: () => {
      toast.success("Áudio removido");
      qc.invalidateQueries({ queryKey: ["audios"] });
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
        data: { audioId: sendDialog.audioId, accountId, chatIds },
      });
      if (res.ok) {
        toast.success(`Enviado com sucesso!`);
      }
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
          <h1 className="text-2xl font-bold tracking-tight">Áudios</h1>
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="size-4" />
            Como criar um arquivo .ogg
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Envie áudios para o Telegram que aparecerão como <b>Mensagens de Voz</b> (Voice Notes gravadas na hora).
        </p>
      </div>

      <Card className="p-5 space-y-4" data-tour="audio-upload">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>
              Áudio em formato .ogg (com codec OPUS)
            </Label>
            <Input ref={fileRef} type="file" accept=".ogg,audio/ogg" onChange={onPickFile} />
          </div>
          <div className="flex-1 space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do áudio" />
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
        {audios.data?.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground text-sm md:col-span-2 lg:col-span-3">
            <Mic className="size-8 mx-auto mb-2 opacity-50" />
            Nenhum áudio enviado ainda.
          </Card>
        )}
        {audios.data?.map((a) => (
          <Card key={a.id} className="p-4 flex flex-col justify-between space-y-4">
            <AudioPreview path={a.storage_path} />
            <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  Nota de Voz · {a.duration_seconds ?? "?"}s ·{" "}
                  {a.file_size ? (a.file_size / 1024 / 1024).toFixed(2) + " MB" : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setSendDialog({ audioId: a.id, title: a.title })}
              >
                <Send className="size-4" />
                Enviar agora
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm("Excluir este áudio?")) delMut.mutate(a.id);
                }}
              >
                <Trash2 className="size-4 text-destructive" />
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
            <DialogTitle>Como preparar um áudio (Voice Note)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">Por que formato .ogg?</p>
              <p className="text-muted-foreground">
                O Telegram exige que mensagens de voz sejam enviadas no formato <b>.ogg</b> codificado com <b>OPUS</b>. Se você enviar mp3 ou wav, o Telegram exibirá como um "arquivo de música" ou "documento", e não como uma gravação de voz.
              </p>
            </div>

            <div>
              <p className="font-medium mb-1">Como converter seu áudio gratuitamente</p>
              <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
                <li>Acesse um site de conversão grátis, como <b>Convertio</b> ou <b>Online-Audio-Converter</b>.</li>
                <li>Faça o upload do seu áudio (MP3, M4A, WAV, etc).</li>
                <li>Selecione o formato de saída como <b>OGG</b>.</li>
                <li>Clique em Converter e baixe o arquivo resultante.</li>
                <li>Faça o upload do arquivo .ogg aqui nesta tela.</li>
              </ol>
            </div>

            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs">
              💡 <b>Dica:</b> Áudios muito longos podem demorar a enviar. Recomendamos enviar áudios curtos e diretos, iguais aos que você envia normalmente conversando no Telegram.
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
