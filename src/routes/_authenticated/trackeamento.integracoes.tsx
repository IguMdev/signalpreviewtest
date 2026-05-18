import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getMyRedirectBase,
  listClicksFiltered,
  testPostback,
} from "@/lib/tracking.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Copy, Megaphone, Webhook, History, Download, Play } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/integracoes")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  const currentPixel = pixels.find((p) => p.id === effectiveId) ?? null;
  const baseFn = useServerFn(getMyRedirectBase);
  const base = useQuery({ queryKey: ["redirect-base"], queryFn: () => baseFn() });
  const baseHost = base.data?.domain ? `https://${base.data.domain}` : (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Link2 className="size-6" /> Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Instale o snippet na sua landing page, gere URLs de postback para suas ofertas e acompanhe o histórico de eventos por pixel.
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
      {effectiveId && currentPixel && (
        <>
          <SnippetCard pixelId={effectiveId} baseHost={baseHost} />
          <PostbackCard pixel={currentPixel} baseHost={baseHost} />
          <PostbackTesterCard pixel={currentPixel} baseHost={baseHost} />
          <EventsHistoryCard pixelId={effectiveId} />
        </>
      )}
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

function buildPostbackUrl(baseHost: string, pixelId: string, secret: string, event: string, clickIdPlaceholder = "{click_id}") {
  const url = new URL(`${baseHost}/api/public/track/postback/${pixelId}`);
  url.searchParams.set("secret", secret);
  url.searchParams.set("sub1", clickIdPlaceholder);
  url.searchParams.set("event", event);
  if (event === "deposit" || event === "ftd") {
    url.searchParams.set("value", "{value}");
    url.searchParams.set("currency", "BRL");
  }
  return decodeURIComponent(url.toString());
}

function PostbackCard({ pixel, baseHost }: { pixel: any; baseHost: string }) {
  const [event, setEvent] = useState<"register" | "deposit" | "ftd">("register");
  const url = buildPostbackUrl(baseHost, pixel.id, pixel.postback_secret, event);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Webhook className="size-4" /> URL de postback</CardTitle>
        <CardDescription>
          Use esta URL na sua plataforma de afiliados. Substitua <code>{"{click_id}"}</code> pelo SubID
          recebido (o mesmo gerado quando o usuário clicou na oferta).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-sm">Evento:</Label>
          <Select value={event} onValueChange={(v) => setEvent(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="register">Registro (register)</SelectItem>
              <SelectItem value="deposit">Depósito (deposit)</SelectItem>
              <SelectItem value="ftd">First deposit (ftd)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(url); toast.success("URL copiada"); }}
          className="w-full text-left text-xs font-mono bg-muted/50 hover:bg-muted rounded p-3 whitespace-pre-wrap break-all relative"
        >
          <Copy className="size-3 absolute top-2 right-2 opacity-60" />
          {url}
        </button>
        <p className="text-xs text-muted-foreground">
          Secret do pixel: <code className="bg-muted px-1 rounded">{pixel.postback_secret}</code>. Aceita GET ou POST (JSON/form).
        </p>
      </CardContent>
    </Card>
  );
}

function PostbackTesterCard({ pixel, baseHost }: { pixel: any; baseHost: string }) {
  const [clickId, setClickId] = useState("");
  const [event, setEvent] = useState<"register" | "deposit" | "ftd">("register");
  const [value, setValue] = useState("");
  const [lastResult, setLastResult] = useState<{ ok: boolean; status: number; error?: string } | null>(null);
  const testFn = useServerFn(testPostback);
  const mut = useMutation({
    mutationFn: () => {
      const url = new URL(`${baseHost}/api/public/track/postback/${pixel.id}`);
      url.searchParams.set("secret", pixel.postback_secret);
      url.searchParams.set("sub1", clickId);
      url.searchParams.set("event", event);
      if (value) url.searchParams.set("value", value);
      url.searchParams.set("currency", "BRL");
      return testFn({ data: { url: url.toString() } });
    },
    onSuccess: (res) => {
      setLastResult(res);
      if (res.ok) toast.success(`Postback enviado (HTTP ${res.status})`);
      else toast.error(`Falha (HTTP ${res.status}) ${res.error ?? ""}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Play className="size-4" /> Testar postback</CardTitle>
        <CardDescription>Dispare um postback de teste contra um click_id existente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">click_id (sub1)</Label>
            <Input value={clickId} onChange={(e) => setClickId(e.target.value)} placeholder="ex: a8Kdz3..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Evento</Label>
            <Select value={event} onValueChange={(v) => setEvent(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="register">register</SelectItem>
                <SelectItem value="deposit">deposit</SelectItem>
                <SelectItem value="ftd">ftd</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor (opcional)</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex: 50" inputMode="decimal" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => mut.mutate()} disabled={!clickId || mut.isPending}>
            {mut.isPending ? "Enviando..." : "Disparar postback"}
          </Button>
          {lastResult && (
            <Badge variant={lastResult.ok ? "default" : "destructive"}>
              HTTP {lastResult.status}{lastResult.error ? ` · ${lastResult.error}` : ""}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EventsHistoryCard({ pixelId }: { pixelId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [event, setEvent] = useState<"any" | "click" | "join" | "offer_click" | "register" | "deposit">("any");
  const fn = useServerFn(listClicksFiltered);
  const q = useQuery({
    queryKey: ["integ-events", pixelId, from, to, event],
    queryFn: () => fn({
      data: {
        pixel_id: pixelId,
        from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(to).toISOString() : null,
        event,
        limit: 1000,
      },
    }),
  });
  const rows = (q.data ?? []) as any[];

  const exportCsv = useMemo(() => () => {
    const headers = [
      "created_at", "click_id", "event_type",
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "fbclid", "gclid", "ttclid",
      "joined_at", "clicked_offer_at", "registered_at", "deposited_at",
      "sale_value", "sale_currency", "tg_username", "tg_user_id", "external_user_id", "ip",
    ];
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      const evType =
        r.deposited_at ? "deposit" :
        r.registered_at ? "register" :
        r.clicked_offer_at ? "offer_click" :
        r.joined_at ? "join" : "click";
      lines.push(headers.map((h) => esc(h === "event_type" ? evType : r[h])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eventos-${pixelId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, pixelId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><History className="size-4" /> Histórico de eventos</CardTitle>
        <CardDescription>Filtre e exporte os eventos capturados para este pixel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Evento</Label>
            <Select value={event} onValueChange={(v) => setEvent(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos</SelectItem>
                <SelectItem value="click">Clique</SelectItem>
                <SelectItem value="join">Entrou no grupo</SelectItem>
                <SelectItem value="offer_click">Clique na oferta</SelectItem>
                <SelectItem value="register">Registro</SelectItem>
                <SelectItem value="deposit">Depósito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-2">Quando</th>
                <th className="p-2">click_id</th>
                <th className="p-2">Evento</th>
                <th className="p-2">UTM source</th>
                <th className="p-2">Campanha</th>
                <th className="p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem eventos no período.</td></tr>
              )}
              {rows.map((r) => {
                const evType =
                  r.deposited_at ? "deposit" :
                  r.registered_at ? "register" :
                  r.clicked_offer_at ? "offer_click" :
                  r.joined_at ? "join" : "click";
                return (
                  <tr key={r.click_id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-2 font-mono">{r.click_id}</td>
                    <td className="p-2"><Badge variant="secondary">{evType}</Badge></td>
                    <td className="p-2">{r.utm_source ?? "—"}</td>
                    <td className="p-2">{r.utm_campaign ?? "—"}</td>
                    <td className="p-2">{r.sale_value ? `${r.sale_value} ${r.sale_currency ?? ""}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Mostrando até 1000 eventos mais recentes.</p>
      </CardContent>
    </Card>
  );
}