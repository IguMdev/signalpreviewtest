import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertQuickTemplate,
  deleteQuickTemplate,
  sendQuickTemplate,
} from "@/lib/quick-send-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Bookmark,
  Pencil,
  Trash2,
  Send,
  Loader2,
  ImageIcon,
  X,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PremiumEmojiPicker } from "@/components/PremiumEmojiPicker";

export type QuickTemplate = {
  id: string;
  name: string;
  content: string;
  parse_mode: string;
  image_path: string | null;
  image_mime: string | null;
  default_room_id: string | null;
  default_account_id: string | null;
  sort_order: number;
};

type Room = { id: string; name: string; default_account_id: string | null };
type Account = { id: string; label: string };

export function QuickTemplatesBar({
  rooms,
  accounts,
}: {
  rooms: Room[];
  accounts: Account[];
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertQuickTemplate);
  const deleteFn = useServerFn(deleteQuickTemplate);
  const sendFn = useServerFn(sendQuickTemplate);

  const [editing, setEditing] = useState<QuickTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<QuickTemplate | null>(null);

  const list = useQuery({
    queryKey: ["quick-send-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quick_send_templates")
        .select(
          "id, name, content, parse_mode, image_path, image_mime, default_room_id, default_account_id, sort_order",
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as QuickTemplate[];
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Modelo removido");
      qc.invalidateQueries({ queryKey: ["quick-send-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = list.data ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bookmark className="size-3.5" />
        Envio rápido (modelos pré-salvos)
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="group inline-flex items-center rounded-full bg-secondary/60 hover:bg-secondary border border-border/60 pl-3 pr-1 py-1 text-sm gap-1"
          >
            <button
              type="button"
              className="font-medium pr-1 text-foreground/90 hover:text-foreground"
              onClick={() => setSending(t)}
              title="Abrir modelo para envio rápido"
            >
              {t.name}
            </button>
            <button
              type="button"
              className="size-6 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-background/60 opacity-0 group-hover:opacity-100 transition"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(t);
              }}
              title="Editar modelo"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              className="size-6 rounded-full grid place-items-center text-muted-foreground hover:text-destructive hover:bg-background/60 opacity-0 group-hover:opacity-100 transition"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Excluir o modelo "${t.name}"?`)) delMut.mutate(t.id);
              }}
              title="Excluir modelo"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/70 px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40"
        >
          <Plus className="size-3.5" />
          Novo modelo
        </button>
      </div>

      {(creating || editing) && (
        <QuickTemplateDialog
          rooms={rooms}
          accounts={accounts}
          initial={editing ?? null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (payload) => {
            try {
              await upsertFn({ data: payload });
              toast.success(payload.id ? "Modelo atualizado" : "Modelo criado");
              setCreating(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["quick-send-templates"] });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}

      {sending && (
        <QuickSendDialog
          tpl={sending}
          rooms={rooms}
          accounts={accounts}
          onClose={() => setSending(null)}
          onSend={async (payload) => {
            try {
              const r = await sendFn({ data: payload });
              if (r.ok) {
                toast.success(`Enviado (${r.sent} grupo${r.sent === 1 ? "" : "s"})`);
                setSending(null);
              } else {
                toast.error(r.error ?? "Falha ao enviar");
              }
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function QuickTemplateDialog({
  initial,
  rooms,
  accounts,
  onClose,
  onSave,
}: {
  initial: QuickTemplate | null;
  rooms: Room[];
  accounts: Account[];
  onClose: () => void;
  onSave: (p: {
    id?: string;
    name: string;
    content: string;
    parseMode: "HTML" | "Markdown" | "MarkdownV2";
    imagePath: string | null;
    imageMime: string | null;
    defaultRoomId: string | null;
    defaultAccountId: string | null;
    sortOrder: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [roomId, setRoomId] = useState<string>(initial?.default_room_id ?? "");
  const [accountId, setAccountId] = useState<string>(initial?.default_account_id ?? "");
  const [imagePath, setImagePath] = useState<string | null>(initial?.image_path ?? null);
  const [imageMime, setImageMime] = useState<string | null>(initial?.image_mime ?? null);
  const [uploading, setUploading] = useState(false);

  // Auto-pick the room's default bot when room changes and no bot chosen yet.
  useEffect(() => {
    if (!roomId) return;
    const r = rooms.find((x) => x.id === roomId);
    if (r?.default_account_id && !accountId) setAccountId(r.default_account_id);
  }, [roomId, rooms, accountId]);

  const previewUrl = useMemo(() => {
    if (!imagePath) return null;
    return supabase.storage.from("room-images").getPublicUrl(imagePath).data.publicUrl;
  }, [imagePath]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/quick/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("room-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setImagePath(path);
      setImageMime(file.type);
      toast.success("Imagem carregada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar modelo" : "Novo modelo de envio rápido"}</DialogTitle>
          <DialogDescription>
            Modelos aparecem como botões abaixo da busca. Você pode usar variáveis como{" "}
            <code>{"{DATA}"}</code> ou <code>{"{HORA}"}</code> e editar tudo no momento do envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome do botão</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Pré-save Diário"
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Sala (padrão)</Label>
              <Select value={roomId || undefined} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bot (padrão)</Label>
              <Select value={accountId || undefined} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Conteúdo (HTML)</Label>
            <div className="flex justify-end -mb-1">
              <PremiumEmojiPicker value={content} onChange={setContent} />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"Olá! Pré-save de hoje: {LINK}\nValor: {VALOR}"}
              rows={6}
              maxLength={4000}
            />
          </div>

          <div>
            <Label>Imagem (opcional)</Label>
            {previewUrl ? (
              <div className="relative inline-block">
                <img src={previewUrl} alt="" className="rounded-md max-h-40 border border-border" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePath(null);
                    setImageMime(null);
                  }}
                  className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1"
                  title="Remover imagem"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border/70 text-sm cursor-pointer hover:bg-secondary/40">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                <span>{uploading ? "Enviando..." : "Selecionar imagem"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return toast.error("Informe um nome");
              onSave({
                id: initial?.id,
                name: name.trim(),
                content,
                parseMode: "HTML",
                imagePath,
                imageMime,
                defaultRoomId: roomId || null,
                defaultAccountId: accountId || null,
                sortOrder: initial?.sort_order ?? 0,
              });
            }}
          >
            Salvar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickSendDialog({
  tpl,
  rooms,
  accounts,
  onClose,
  onSend,
}: {
  tpl: QuickTemplate;
  rooms: Room[];
  accounts: Account[];
  onClose: () => void;
  onSend: (p: {
    id: string;
    roomId: string;
    accountId: string;
    content: string;
    parseMode: "HTML" | "Markdown" | "MarkdownV2";
    premium: boolean;
    imagePathOverride?: string | null;
    removeImage?: boolean;
  }) => Promise<void>;
}) {
  const [content, setContent] = useState(tpl.content);
  const [roomId, setRoomId] = useState<string>(tpl.default_room_id ?? "");
  const [accountId, setAccountId] = useState<string>(tpl.default_account_id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const premiumKey = `qst:premium:${tpl.id}`;
  const [premium, setPremiumState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(premiumKey) === "1";
  });
  const setPremium = (v: boolean) => {
    setPremiumState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(premiumKey, v ? "1" : "0");
    }
  };
  const [imagePath, setImagePath] = useState<string | null>(tpl.image_path);
  const [uploading, setUploading] = useState(false);
  const removed = imagePath === null && tpl.image_path !== null;

  useEffect(() => {
    if (!roomId) return;
    const r = rooms.find((x) => x.id === roomId);
    if (r?.default_account_id && !accountId) setAccountId(r.default_account_id);
  }, [roomId, rooms, accountId]);

  const previewUrl = imagePath
    ? supabase.storage.from("room-images").getPublicUrl(imagePath).data.publicUrl
    : null;

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/quick/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("room-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setImagePath(path);
      toast.success("Imagem carregada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar agora — {tpl.name}</DialogTitle>
          <DialogDescription>
            Edite as informações do dia e dispare. O envio é imediato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Sala</Label>
              <Select value={roomId || undefined} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bot</Label>
              <Select value={accountId || undefined} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Imagem</Label>
            {previewUrl ? (
              <div className="relative inline-block mt-1">
                <img
                  src={previewUrl}
                  alt=""
                  className="rounded-md max-h-40 border border-border"
                />
                <button
                  type="button"
                  onClick={() => setImagePath(null)}
                  className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1"
                  title="Remover imagem deste envio"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border/70 text-sm cursor-pointer hover:bg-secondary/40 mt-1">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                <span>{uploading ? "Enviando..." : "Selecionar imagem"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-primary" />
              <div>
                <div className="font-medium">Emojis premium</div>
                <div className="text-xs text-muted-foreground">
                  Renderiza emojis premium via conta MTProto (se configurada).
                </div>
              </div>
            </div>
            <Switch checked={premium} onCheckedChange={setPremium} />
          </div>

          <div>
            <Label>Conteúdo</Label>
            <div className="flex justify-end -mb-1">
              <PremiumEmojiPicker value={content} onChange={setContent} />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              maxLength={4000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Suporta HTML do Telegram (<code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, links).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            disabled={submitting || !roomId || !accountId}
            onClick={async () => {
              if (!roomId) return toast.error("Selecione a sala");
              if (!accountId) return toast.error("Selecione o bot");
              setSubmitting(true);
              try {
                await onSend({
                  id: tpl.id,
                  roomId,
                  accountId,
                  content,
                  parseMode: (tpl.parse_mode as "HTML" | "Markdown" | "MarkdownV2") || "HTML",
                  premium,
                  imagePathOverride: imagePath,
                  removeImage: removed,
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}