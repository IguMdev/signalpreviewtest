import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, Search } from "lucide-react";
import { getCachedEmojis, type CachedEmoji } from "@/lib/emoji-cache";

type SavedEmoji = {
  id: string;
  name: string;
  custom_emoji_id: string;
  preview_char: string | null;
};

function Thumb({ cached, fallback }: { cached?: CachedEmoji; fallback: string | null }) {
  if (cached?.thumb_data_url) {
    if (cached.thumb_mime === "video/webm") {
      return (
        <video
          src={cached.thumb_data_url}
          muted
          playsInline
          preload="metadata"
          className="size-7 object-contain"
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = 0;
            e.currentTarget.pause();
          }}
        />
      );
    }
    if (cached.thumb_mime?.startsWith("image/")) {
      return <img src={cached.thumb_data_url} alt="" className="size-7 object-contain" />;
    }
  }
  return <span className="text-xl leading-none">{fallback ?? "✨"}</span>;
}

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

type Props = {
  value: string;
  onChange: (v: string) => void;
  targetRef?: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  size?: "sm" | "default";
  className?: string;
};

export function PremiumEmojiPicker({ value, onChange, targetRef, size = "sm", className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [thumbs, setThumbs] = useState<Map<string, CachedEmoji>>(new Map());
  const internalRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const ref = targetRef ?? internalRef;

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
    getCachedEmojis(list.data.map((e) => e.custom_emoji_id)).then(setThumbs);
  }, [list.data]);

  const filtered = useMemo(() => {
    const items = list.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((e) => e.name.toLowerCase().includes(term));
  }, [list.data, q]);

  const insert = (name: string) => {
    const token = `{EMOJI:${name}}`;
    insertAtCursor(ref.current, value, token, onChange);
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
                    title={`{EMOJI:${e.name}}`}
                  >
                    <Thumb cached={thumbs.get(e.custom_emoji_id)} fallback={e.preview_char} />
                    <span className="text-[9px] font-mono uppercase truncate w-full text-center text-muted-foreground">
                      {e.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-1 border-t">
            Insere <code className="font-mono">{"{EMOJI:NOME}"}</code> na posição do cursor.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}