import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyRedirectBase } from "@/lib/tracking.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Copy, Megaphone } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/integracoes")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  const baseFn = useServerFn(getMyRedirectBase);
  const base = useQuery({ queryKey: ["redirect-base"], queryFn: () => baseFn() });
  const baseHost = base.data?.domain ? `https://${base.data.domain}` : (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Link2 className="size-6" /> Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Instale o snippet na sua landing page para capturar cliques, UTMs e cookies do Meta. Vincule também sua integração Meta CAPI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Megaphone className="size-4" /> Meta Pixel & CAPI</CardTitle>
          <CardDescription>Conecte sua conta Meta para enviar eventos do servidor (CAPI).</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/integracoes/meta">
            <Button variant="outline">Abrir integração Meta</Button>
          </Link>
        </CardContent>
      </Card>

      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId && <SnippetCard pixelId={effectiveId} baseHost={baseHost} />}
    </div>
  );
}

function SnippetCard({ pixelId, baseHost }: { pixelId: string; baseHost: string }) {
  const snippet = `<script>
(function(){
  var u = new URL(location.href);
  var s = u.searchParams;
  function ck(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]+)'));return m?decodeURIComponent(m[1]):null;}
  fetch('${baseHost}/api/public/track/click', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      pixel_id:'${pixelId}',
      landing_url: location.href,
      referrer: document.referrer,
      utm_source: s.get('utm_source'),
      utm_medium: s.get('utm_medium'),
      utm_campaign: s.get('utm_campaign'),
      utm_content: s.get('utm_content'),
      utm_term: s.get('utm_term'),
      fbclid: s.get('fbclid'),
      gclid: s.get('gclid'),
      ttclid: s.get('ttclid'),
      fbp: ck('_fbp'),
      fbc: ck('_fbc')
    })
  }).then(r=>r.json()).then(d=>{
    if(d&&d.click_id){window.__clickId=d.click_id;document.cookie='cid='+d.click_id+';path=/;max-age=2592000';}
  });
})();
</script>`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Snippet de captura</CardTitle>
        <CardDescription>Cole antes do <code>&lt;/head&gt;</code> da sua landing page.</CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Copiado"); }}
          className="w-full text-left text-xs font-mono bg-muted/50 hover:bg-muted rounded p-3 whitespace-pre-wrap break-all relative"
        >
          <Copy className="size-3 absolute top-2 right-2 opacity-60" />
          {snippet}
        </button>
      </CardContent>
    </Card>
  );
}