import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyRedirectBase } from "@/lib/tracking.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat, Copy } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/postbacks")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: PostbacksPage,
});

function PostbacksPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  const baseFn = useServerFn(getMyRedirectBase);
  const base = useQuery({ queryKey: ["redirect-base"], queryFn: () => baseFn() });
  const baseHost = base.data?.domain ? `https://${base.data.domain}` : (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Repeat className="size-6" /> Postbacks S2S</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Configure estas URLs na sua corretora/afiliado. Quando o usuário se cadastrar ou depositar, a corretora chama a URL com o <code>subid</code> (= click_id) e disparamos o evento Meta CAPI.
        </p>
      </div>
      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId && <PostbackUrls pixelId={effectiveId} baseHost={baseHost} />}
    </div>
  );
}

function PostbackUrls({ pixelId, baseHost }: { pixelId: string; baseHost: string }) {
  const rows: { label: string; event: string; example: string }[] = [
    { label: "Cadastro", event: "register", example: `${baseHost}/api/public/track/postback/${pixelId}?event=register&subid={SUBID}` },
    { label: "Depósito", event: "deposit", example: `${baseHost}/api/public/track/postback/${pixelId}?event=deposit&subid={SUBID}&value={AMOUNT}&currency=BRL` },
    { label: "Clique na oferta (opcional)", event: "offer_click", example: `${baseHost}/api/public/track/postback/${pixelId}?event=offer_click&subid={SUBID}` },
  ];
  return (
    <div className="grid gap-3">
      {rows.map((r) => (
        <Card key={r.event}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{r.label}</CardTitle>
            <CardDescription>Substitua <code>{"{SUBID}"}</code> pelo macro de subid da sua corretora.</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(r.example); toast.success("Copiado"); }}
              className="w-full text-left text-xs font-mono bg-muted/50 hover:bg-muted rounded p-3 flex items-center gap-2"
            >
              <Copy className="size-3 shrink-0" /><span className="break-all">{r.example}</span>
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}