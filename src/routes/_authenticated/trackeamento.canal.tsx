import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updatePixel, getPixel } from "@/lib/tracking.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Send, Copy } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/canal")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: CanalPage,
});

function CanalPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  const currentPixel = pixels.find((p: any) => p.id === effectiveId);
  const mode = (currentPixel?.tracking_mode ?? "telegram") as "telegram" | "direct_response";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Send className="size-6" /> Canal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "direct_response"
            ? "Configure a página de vendas e copie o snippet de tracking para colar no <head>."
            : "Vincule cada pixel a um bot do Telegram e a uma sala."}
        </p>
      </div>
      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId && (mode === "direct_response"
        ? <DirectResponsePanel pixelId={effectiveId} />
        : <CanalForm pixelId={effectiveId} />)}
    </div>
  );
}

function DirectResponsePanel({ pixelId }: { pixelId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getPixel);
  const updFn = useServerFn(updatePixel);
  const pixel = useQuery({ queryKey: ["pixel", pixelId], queryFn: () => getFn({ data: { id: pixelId } }) });
  const [salesUrl, setSalesUrl] = useState("");
  useEffect(() => { if (pixel.data) setSalesUrl(pixel.data.sales_page_url ?? ""); }, [pixel.data]);

  const save = useMutation({
    mutationFn: () => updFn({ data: { id: pixelId, sales_page_url: salesUrl || null } as any }),
    onSuccess: () => {
      toast.success("Página de vendas salva");
      qc.invalidateQueries({ queryKey: ["pixel", pixelId] });
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<!-- Signal Tracking (Direct Response) -->
<script>
(function(){
  var PIXEL = "${pixelId}";
  var ENDPOINT = "${origin}/api/public/track/dr/" + PIXEL;
  function q(k){return new URLSearchParams(location.search).get(k);}
  function ck(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
  var CID = localStorage.getItem('lv_cid') || q('click_id') || null;
  function setCid(id){ CID = id; if(id) localStorage.setItem('lv_cid', id); }
  function send(stage, extra){
    var body = Object.assign({
      stage: stage, click_id: CID,
      fbp: ck('_fbp'), fbc: ck('_fbc'), fbclid: q('fbclid'),
      landing_url: location.href, referrer: document.referrer,
      utm_source: q('utm_source'), utm_medium: q('utm_medium'),
      utm_campaign: q('utm_campaign'), utm_content: q('utm_content'), utm_term: q('utm_term')
    }, extra || {});
    return fetch(ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
      .then(function(r){return r.json();})
      .then(function(j){ if(j && j.click_id) setCid(j.click_id); return j; })
      .catch(function(){});
  }
  window.lvTrack = send;
  send('view');
})();
</script>`;

  const leadExample = `lvTrack('lead', { email: 'user@dominio.com', phone: '+5511999998888' });`;
  const purchaseExample = `lvTrack('purchase', { value: 297, currency: 'BRL', email: 'comprador@dominio.com' });`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Página de vendas</CardTitle>
          <CardDescription>URL onde o anúncio Meta cai. Usada como referência nos relatórios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>URL da página</Label>
            <Input value={salesUrl} onChange={(e) => setSalesUrl(e.target.value)} placeholder="https://meuproduto.com.br/oferta" />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snippet de tracking</CardTitle>
          <CardDescription>Cole no <code>&lt;head&gt;</code> da página de vendas. Dispara <code>view</code> automaticamente e expõe <code>lvTrack(stage, extra)</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="text-xs bg-muted/40 border rounded p-3 overflow-x-auto whitespace-pre">{snippet}</pre>
          <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Snippet copiado"); }}>
            <Copy className="size-3.5" /> Copiar snippet
          </Button>

          <div className="pt-3 border-t space-y-2">
            <p className="text-xs font-medium">Dispare eventos extras no fluxo:</p>
            <p className="text-[11px] text-muted-foreground">No opt-in / captura de lead:</p>
            <pre className="text-xs bg-muted/40 border rounded p-2 overflow-x-auto">{leadExample}</pre>
            <p className="text-[11px] text-muted-foreground">Na página de obrigado / pós-compra:</p>
            <pre className="text-xs bg-muted/40 border rounded p-2 overflow-x-auto">{purchaseExample}</pre>
            <p className="text-[11px] text-muted-foreground">
              Outros estágios: <code>lvTrack('checkout')</code>, <code>lvTrack('payment_info')</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CanalForm({ pixelId }: { pixelId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getPixel);
  const updFn = useServerFn(updatePixel);
  const pixel = useQuery({ queryKey: ["pixel", pixelId], queryFn: () => getFn({ data: { id: pixelId } }) });

  const accounts = useQuery({
    queryKey: ["ta-mini-canal"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id,bot_username");
      return data ?? [];
    },
  });
  const rooms = useQuery({
    queryKey: ["rooms-mini-canal"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id,name");
      return data ?? [];
    },
  });

  const [accountId, setAccountId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");

  useEffect(() => {
    if (pixel.data) {
      setAccountId(pixel.data.account_id ?? "");
      setRoomId(pixel.data.room_id ?? "");
    }
  }, [pixel.data]);

  const save = useMutation({
    mutationFn: () => updFn({ data: {
      id: pixelId,
      account_id: accountId || null,
      room_id: roomId || null,
    } }),
    onSuccess: () => {
      toast.success("Vínculos salvos");
      qc.invalidateQueries({ queryKey: ["pixel", pixelId] });
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vínculos do pixel</CardTitle>
        <CardDescription>O bot recebe o <code>/start tk_&lt;click_id&gt;</code> e a sala é onde os usuários entram.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Bot do Telegram</Label>
          <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {accounts.data?.map(a => <SelectItem key={a.id} value={a.id}>@{a.bot_username ?? "(sem)"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sala (opcional)</Label>
          <Select value={roomId || "none"} onValueChange={(v) => setRoomId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {rooms.data?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
      </CardContent>
    </Card>
  );
}