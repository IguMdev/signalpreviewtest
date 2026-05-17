import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPixels } from "@/lib/tracking.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

/**
 * Filtro de pixel reutilizável. Lê e grava `?pixel=<id>` na URL.
 * Retorna o pixelId selecionado (ou null = todos).
 */
export function usePixelFilter(): {
  pixelId: string | null;
  pixels: any[];
  isLoading: boolean;
  setPixel: (id: string | null) => void;
} {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { pixel?: string };
  const listFn = useServerFn(listPixels);
  const q = useQuery({ queryKey: ["tracking-pixels"], queryFn: () => listFn() });
  const pixels = (q.data ?? []) as any[];
  const currentId = search.pixel ?? null;

  return {
    pixelId: currentId,
    pixels,
    isLoading: q.isLoading,
    setPixel: (id) => {
      navigate({
        to: ".",
        search: (prev: any) => ({ ...prev, pixel: id ?? undefined }),
        replace: true,
      });
    },
  };
}

export function PixelFilterBar({
  pixelId, pixels, setPixel, allowAll = false,
}: {
  pixelId: string | null;
  pixels: any[];
  setPixel: (id: string | null) => void;
  allowAll?: boolean;
}) {
  if (pixels.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Você ainda não criou nenhum pixel.</p>
        <Link to="/trackeamento/pixels">
          <Button size="sm"><Plus className="size-4" /> Criar pixel</Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Label className="text-sm">Pixel:</Label>
      <Select
        value={pixelId ?? (allowAll ? "all" : pixels[0]?.id ?? "")}
        onValueChange={(v) => setPixel(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value="all">Todos os pixels</SelectItem>}
          {pixels.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} {p.bot_username ? `· @${p.bot_username}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}