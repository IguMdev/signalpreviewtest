import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getPremiumEmojiThumbs, syncPremiumEmojis } from "@/lib/premium-account.functions";
import {
  getCachedEmojis,
  putCachedEmojis,
  type CachedEmoji,
} from "@/lib/emoji-cache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles,
  Search,
  Play,
  Square,
  Pencil,
  Trash2,
  Home,
  ChevronRight,
  Zap,
  Save,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/premium-emojis")({
  component: PremiumEmojisPage,
});

type Captured = {
  custom_emoji_id: string;
  preview_char: string | null;
  thumb_data_url: string | null;
  thumb_mime: string | null;
  name: string;
};

function EmojiPreview({
  item,
  animate,
}: {
  item: Pick<Captured, "thumb_data_url" | "thumb_mime" | "preview_char">;
  animate: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (item.thumb_data_url && !failed) {
    if (item.thumb_mime === "video/webm") {
      if (!animate) {
        // Modo estático: renderiza só o primeiro frame, sem decodificar o vídeo inteiro.
        return (
          <video
            src={item.thumb_data_url}
            muted
            playsInline
            preload="metadata"
            className="size-12 object-contain"
            onError={() => setFailed(true)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              v.currentTime = 0;
              v.pause();
            }}
          />
        );
      }
      return (
        <video
          src={item.thumb_data_url}
          autoPlay
          loop
          muted
          playsInline
          className="size-12 object-contain"
          onError={() => setFailed(true)}
        />
      );
    }
    if (item.thumb_mime && item.thumb_mime.startsWith("image/")) {
      return (
        <img
          src={item.thumb_data_url}
          alt="emoji"
          className="size-12 object-contain"
          onError={() => setFailed(true)}
        />
      );
    }
    // TGS (Lottie gzipped) — sem player nativo no browser, cai pro fallback unicode.
  }

  if (item.thumb_data_url && !item.thumb_mime && !failed) {
    return (
      <img
        src={item.thumb_data_url}
        alt="emoji"
        className="size-12 object-contain"
        onError={() => setFailed(true)}
      />
    );
  }

  return item.preview_char ? (
    <div className="text-4xl leading-none">{item.preview_char}</div>
  ) : (
    <Zap className="size-7 text-amber-400" />
  );
}

function PremiumEmojisPage() {
  useAuth();
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<string>("");
  const [capturing, setCapturing] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmojiId, setEditEmojiId] = useState("");
  const [captureStartedAt, setCaptureStartedAt] = useState<string | null>(null);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [animate, setAnimate] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("emoji-animate") !== "false";
  });
  const [savedThumbs, setSavedThumbs] = useState<Map<string, CachedEmoji>>(
    new Map(),
  );
  const syncEmojis = useServerFn(syncPremiumEmojis);
  const fetchThumbs = useServerFn(getPremiumEmojiThumbs);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("emoji-animate", animate ? "true" : "false");
    }
  }, [animate]);

  const accounts = useQuery({
    queryKey: ["telegram-accounts", "premium"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_accounts")
        .select("id, label, phone")
        .eq("account_type", "premium");
      if (error) throw error;
      return data;
    },
  });

  const list = useQuery({
    queryKey: ["emojis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premium_emojis")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Hidrata thumbs dos emojis salvos a partir do IndexedDB.
  useEffect(() => {
    if (!list.data?.length) return;
    const ids = list.data.map((e) => e.custom_emoji_id);
    getCachedEmojis(ids).then(async (cached) => {
      setSavedThumbs(cached);
      const missing = ids.filter((id) => !cached.get(id)?.thumb_data_url);
      if (!missing.length) return;
      const fresh = await fetchThumbs({ data: { ids: missing } }).catch(() => null);
      if (!fresh?.ok || !fresh.items.length) return;
      await putCachedEmojis(
        fresh.items.map((it) => ({
          custom_emoji_id: it.custom_emoji_id,
          preview_char: list.data.find((e) => e.custom_emoji_id === it.custom_emoji_id)?.preview_char ?? null,
          thumb_data_url: it.thumb_data_url,
          thumb_mime: it.thumb_mime,
        })),
      );
      setSavedThumbs(
        new Map([
          ...cached,
          ...fresh.items.map((it) => [
            it.custom_emoji_id,
            {
              ...it,
              preview_char: list.data.find((e) => e.custom_emoji_id === it.custom_emoji_id)?.preview_char ?? null,
              cached_at: Date.now(),
            } as CachedEmoji,
          ] as const),
        ]),
      );
    });
  }, [list.data, fetchThumbs]);

  const updateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("premium_emojis")
        .update({ name: editName, custom_emoji_id: editEmojiId })
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Emoji atualizado");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["emojis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("premium_emojis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Emoji removido");
      qc.invalidateQueries({ queryKey: ["emojis"] });
    },
  });

  const mergeFresh = (
    items: Array<{
      custom_emoji_id: string;
      preview_char: string | null;
      thumb_data_url?: string | null;
      thumb_mime?: string | null;
    }>,
  ) => {
    // Persiste no cache local para não rebaixar.
    void putCachedEmojis(
      items.map((it) => ({
        custom_emoji_id: it.custom_emoji_id,
        preview_char: it.preview_char,
        thumb_data_url: it.thumb_data_url ?? null,
        thumb_mime: it.thumb_mime ?? null,
      })),
    );
    setCaptured((prev) => {
      const seen = new Set(prev.map((p) => p.custom_emoji_id));
      const merged = [...prev];
      for (const it of items) {
        if (!seen.has(it.custom_emoji_id)) {
          merged.push({
            custom_emoji_id: it.custom_emoji_id,
            preview_char: it.preview_char,
            thumb_data_url: it.thumb_data_url ?? null,
            thumb_mime: it.thumb_mime ?? null,
            name: "",
          });
        }
      }
      return merged;
    });
  };

  const syncMut = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Selecione uma conta premium");
      return syncEmojis({ data: { accountId, since: captureStartedAt ?? undefined } });
    },
    onSuccess: (r) => {
      if (r.items?.length) {
        mergeFresh(r.items);
        toast.success(`${r.items.length} novos emojis capturados`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!capturing || !accountId) return;
    const timer = window.setInterval(() => {
      if (!syncMut.isPending) syncMut.mutate();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [capturing, accountId, syncMut.isPending]);

  const saveCaptured = async (item: Captured) => {
    if (!item.name.trim()) {
      toast.error("Defina uma nomenclatura");
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return toast.error("Sessão inválida");
    const { error } = await supabase.from("premium_emojis").insert({
      user_id: uid,
      name: item.name.trim().toUpperCase(),
      custom_emoji_id: item.custom_emoji_id,
      preview_char: item.preview_char,
    });
    if (error) return toast.error(error.message);
    toast.success("Emoji salvo");
    setCaptured((prev) => prev.filter((c) => c.custom_emoji_id !== item.custom_emoji_id));
    qc.invalidateQueries({ queryKey: ["emojis"] });
  };

  const filtered = useMemo(() => {
    if (!list.data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return list.data;
    return list.data.filter((e) => e.name.toLowerCase().includes(q));
  }, [list.data, search]);

  const startEdit = (e: { id: string; name: string; custom_emoji_id: string }) => {
    setEditingId(e.id);
    setEditName(e.name);
    setEditEmojiId(e.custom_emoji_id);
  };

  const startCapture = () => {
    if (!accountId) {
      toast.error("Selecione uma conta premium");
      return;
    }
    const startedAt = new Date().toISOString();
    setCaptureStartedAt(startedAt);
    setCapturing(true);
    syncEmojis({ data: { accountId, since: startedAt } })
      .then((r) => {
        if (r.items?.length) {
          mergeFresh(r.items);
          toast.success(`${r.items.length} novos emojis capturados`);
        }
      })
      .catch((e: Error) => toast.error(e.message));
    toast.info("Captura iniciada. Envie emojis premium na conta selecionada.");
  };

  const stopCapture = () => {
    setCapturing(false);
    setCaptureStartedAt(null);
    toast.success("Captura parada");
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="size-4" />
        <span>Trading</span>
        <ChevronRight className="size-4" />
        <Sparkles className="size-4 text-amber-400" />
        <span>Emojis Premium</span>
      </div>

      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-7 text-amber-400" />
          Emojis Premium
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capture, nomeie e gerencie seus emojis premium do Telegram
        </p>
      </div>

      {/* Captura automática */}
      <Card className="p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="size-11 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shrink-0">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Captura Automática de Emojis</h2>
            <p className="text-sm text-muted-foreground">
              Selecione uma conta premium e envie emojis nela — eles aparecerão abaixo para você nomear.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Conta Premium do Telegram</label>
          <div className="flex gap-2">
            <Select value={accountId} onValueChange={setAccountId} disabled={capturing}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione uma conta premium..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.data?.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Nenhuma conta premium cadastrada
                  </div>
                )}
                {accounts.data?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label} {a.phone ? `(${a.phone})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={startCapture} disabled={capturing || syncMut.isPending} className="gap-2">
              <Play className="size-4" />
              {syncMut.isPending ? "Sincronizando" : "Iniciar Captura"}
            </Button>
            <Button onClick={stopCapture} disabled={!capturing} variant="secondary" className="gap-2">
              <Square className="size-4" />
              Parar Captura
            </Button>
          </div>
        </div>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nomenclatura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Toggle animação vs estático */}
      <div className="flex items-center justify-end gap-2">
        <Switch id="animate-toggle" checked={animate} onCheckedChange={setAnimate} />
        <Label htmlFor="animate-toggle" className="text-sm cursor-pointer">
          {animate ? "Animado" : "Estático"}
        </Label>
      </div>

      {/* Emojis Capturados (pendentes) */}
      {captured.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="size-5 text-amber-400" />
              Emojis Capturados
              <span className="text-sm font-normal text-muted-foreground">
                ({captured.length})
              </span>
            </h2>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setCaptured([])}
            >
              <Trash2 className="size-4" />
              Limpar Capturas
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {captured.map((item) => (
              <div
                key={item.custom_emoji_id}
                className="rounded-lg border border-border bg-muted/20 p-5 flex flex-col items-center gap-3"
              >
                <EmojiPreview item={item} animate={animate} />
                <div className="text-xs text-muted-foreground break-all text-center">
                  ID: {item.custom_emoji_id}
                </div>
                <Input
                  placeholder="NOMENCLATURA (ex: APERTOMAO)"
                  value={item.name}
                  onChange={(e) =>
                    setCaptured((prev) =>
                      prev.map((c) =>
                        c.custom_emoji_id === item.custom_emoji_id
                          ? { ...c, name: e.target.value }
                          : c,
                      ),
                    )
                  }
                  className="text-center font-mono uppercase"
                />
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => saveCaptured(item)}
                >
                  <Save className="size-4" />
                  Salvar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Saved Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[100px_1fr_2fr_180px_100px] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Emoji</div>
          <div>Nomenclatura</div>
          <div>ID Telegram</div>
          <div>Criado</div>
          <div className="text-right">Ações</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Sparkles className="size-8 mx-auto mb-2 opacity-40" />
            Nenhum emoji salvo.
          </div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[100px_1fr_2fr_180px_100px] gap-4 px-6 py-3 border-b border-border last:border-0 items-center hover:bg-muted/20"
            >
              <div className="flex items-center justify-center size-12">
                <EmojiPreview
                  item={{
                    preview_char: e.preview_char,
                    thumb_data_url:
                      savedThumbs.get(e.custom_emoji_id)?.thumb_data_url ?? null,
                    thumb_mime:
                      savedThumbs.get(e.custom_emoji_id)?.thumb_mime ?? null,
                  }}
                  animate={animate}
                />
              </div>
              <div>
                {editingId === e.id ? (
                  <Input
                    value={editName}
                    onChange={(ev) => setEditName(ev.target.value)}
                    className="h-8"
                  />
                ) : (
                  <code className="px-2 py-1 rounded bg-muted/50 text-sm font-mono">
                    {`{${e.name}}`}
                  </code>
                )}
              </div>
              <div>
                {editingId === e.id ? (
                  <Input
                    value={editEmojiId}
                    onChange={(ev) => setEditEmojiId(ev.target.value)}
                    className="h-8 font-mono text-sm"
                  />
                ) : (
                  <code className="block px-3 py-1.5 rounded bg-muted/50 text-sm font-mono truncate">
                    {e.custom_emoji_id}
                  </code>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
              </div>
              <div className="flex justify-end gap-1">
                {editingId === e.id ? (
                  <>
                    <Button size="sm" onClick={() => updateMut.mutate()}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      ✕
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(e)}>
                      <Pencil className="size-4 text-blue-400" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => delMut.mutate(e.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
