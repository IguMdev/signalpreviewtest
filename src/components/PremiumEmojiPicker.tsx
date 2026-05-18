import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, Search } from "lucide-react";
import { getCachedEmojis, putCachedEmojis, type CachedEmoji } from "@/lib/emoji-cache";
import { getPremiumEmojiThumbs } from "@/lib/premium-account.functions";

type SavedEmoji = {
  id: string;
  name: string;
  custom_emoji_id: string;
  preview_char: string | null;
};

/**
 * Insere texto na posição do cursor de um textarea/input controlado
 * e mantém o cursor após a inserção.
 */
export function insertAtCursor(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  current: string,
  insert: string,
  onChange: (next: string) => void,
) {
  if (!el) {
    onChange(current + insert);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + insert + current.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + insert.length;
    el.setSelectionRange(pos, pos);
  });
}

async function decodeTgsDataUrl(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const win = window as typeof window & { DecompressionStream?: typeof DecompressionStream };
  if (!win.DecompressionStream) return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new win.DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as object;
}

function EmojiFallback({ fallback }: { fallback: string | null }) {
  return <span className="text-xl leading-none">{fallback ?? "✨"}</span>;
}

function TgsEmojiMedia({ src, className, animate, fallback }: { src: string; className: string; animate: boolean; fallback: string | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    let destroyed = false;
    let animation: { destroy: () => void; goToAndStop: (value: number, isFrame?: boolean) => void } | null = null;
    decodeTgsDataUrl(src)
      .then(async (animationData) => {
        if (!animationData || destroyed || !ref.current) return setFailed(true);
        const lottie = await import("lottie-web");
        if (destroyed || !ref.current) return;
        animation = lottie.default.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: animate,
          autoplay: animate,
          animationData,
        });
        if (!animate) animation.goToAndStop(0, true);
      })
      .catch(() => setFailed(true));
    return () => {
      destroyed = true;
      animation?.destroy();
    };
  }, [src, animate]);

  if (failed) return <EmojiFallback fallback={fallback} />;
  return <div ref={ref} className={`${className} [&_svg]:!block`} />;
}

export function PremiumEmojiMedia({ cached, fallback, className = "size-7", animate = false }: { cached?: CachedEmoji; fallback: string | null; className?: string; animate?: boolean }) {
  if (cached?.thumb_data_url) {
    if (cached.thumb_mime === "video/webm") {
      return <video src={cached.thumb_data_url} autoPlay={animate} loop={animate} muted playsInline preload="metadata" className={`${className} object-contain`} onLoadedMetadata={(e) => { if (!animate) { e.currentTarget.currentTime = 0; e.currentTarget.pause(); } }} />;
    }
    if (cached.thumb_mime?.startsWith("image/")) {
      return <img src={cached.thumb_data_url} alt="" className={`${className} object-contain`} />;
    }
    if (cached.thumb_mime === "application/x-tgsticker") {
      return <TgsEmojiMedia src={cached.thumb_data_url} className={className} animate={animate} fallback={fallback} />;
    }
  }
  return <EmojiFallback fallback={fallback} />;
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  targetRef?: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  size?: "sm" | "default";
  className?: string;
};

function isTextControl(el: Element | null): el is HTMLTextAreaElement | HTMLInputElement {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
}

function setTextControlCursor(el: HTMLTextAreaElement | HTMLInputElement, pos: number) {
  try {
    el.focus();
    el.setSelectionRange(pos, pos);
  } catch {
    el.focus();
  }
}

export function PremiumEmojiPicker({ value, onChange, targetRef, size = "sm", className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [thumbs, setThumbs] = useState<Map<string, CachedEmoji>>(new Map());
  const fetchThumbs = useServerFn(getPremiumEmojiThumbs);
  const internalRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const ref = targetRef ?? internalRef;
  // Captura a posição do cursor ANTES do popover roubar o foco.
  const savedSelection = useRef<{ el: HTMLTextAreaElement | HTMLInputElement; start: number; end: number } | null>(null);

  const captureSelection = () => {
    let el = ref.current as HTMLTextAreaElement | HTMLInputElement | null;
    if (!el) {
      const active = document.activeElement;
      if (isTextControl(active)) {
        el = active;
      }
    }
    if (!el || typeof el.selectionStart !== "number" || typeof el.selectionEnd !== "number") {
      return;
    }
    savedSelection.current = {
      el,
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  };

  const list = useQuery({
    queryKey: ["emojis", "picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premium_emojis")
        .select("id, name, custom_emoji_id, preview_char")
        .order("name");
      if (error) throw error;
      return data as SavedEmoji[];
    },
  });

  useEffect(() => {
    if (!list.data?.length) return;
    const ids = list.data.map((e) => e.custom_emoji_id);
    getCachedEmojis(ids).then(async (cached) => {
      setThumbs(cached);
      const missing = ids.filter((id) => {
        const item = cached.get(id);
        return !item?.thumb_data_url || item.thumb_mime === "application/x-tgsticker";
      });
      if (!missing.length) return;
      const previewById = new Map(list.data.map((e) => [e.custom_emoji_id, e.preview_char] as const));
      for (let i = 0; i < missing.length; i += 24) {
        const fresh = await fetchThumbs({ data: { ids: missing.slice(i, i + 24) } }).catch(() => null);
        if (!fresh?.ok || !fresh.items.length) continue;
        await putCachedEmojis(fresh.items.map((it) => ({ custom_emoji_id: it.custom_emoji_id, preview_char: previewById.get(it.custom_emoji_id) ?? null, thumb_data_url: it.thumb_data_url, thumb_mime: it.thumb_mime })));
        setThumbs((prev) => new Map([...prev, ...fresh.items.map((it) => [it.custom_emoji_id, { ...it, preview_char: previewById.get(it.custom_emoji_id) ?? null, cached_at: Date.now() } as CachedEmoji] as const)]));
      }
    });
  }, [list.data, fetchThumbs]);

  const filtered = useMemo(() => {
    const items = list.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((e) => e.name.toLowerCase().includes(term));
  }, [list.data, q]);

  const insert = (name: string) => {
    const token = `{${name}}`;
    const saved = savedSelection.current;
    if (saved) {
      const start = Math.min(saved.start, value.length);
      const end = Math.min(Math.max(saved.end, start), value.length);
      const next = value.slice(0, start) + token + value.slice(end);
      onChange(next);
      const pos = start + token.length;
      requestAnimationFrame(() => {
        setTextControlCursor(saved.el, pos);
      });
    } else {
      insertAtCursor(ref.current, value, token, onChange);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          className={className}
          onPointerDown={captureSelection}
          title="Inserir emoji premium"
        >
          <Sparkles className="size-4 text-amber-400" />
          {size !== "sm" && <span className="ml-1">Emoji premium</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="space-y-2">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar emoji premium..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto -mx-1 px-1">
            {list.isLoading ? (
              <div className="text-xs text-muted-foreground py-6 text-center">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                {list.data?.length ? "Nenhum emoji corresponde." : "Nenhum emoji premium salvo ainda."}
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-1">
                {filtered.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => insert(e.name)}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-md p-1.5 hover:bg-accent transition"
                    title={`{${e.name}}`}
                  >
                    <PremiumEmojiMedia cached={thumbs.get(e.custom_emoji_id)} fallback={e.preview_char} />
                    <span className="text-[9px] font-mono uppercase truncate w-full text-center text-muted-foreground">
                      {e.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-1 border-t">
            Insere <code className="font-mono">{"{NOME}"}</code> na posição do cursor.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}