import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getPixel,
  updatePixel,
  listOffers,
  createOffer,
  deleteOffer,
  listRecentClicks,
  getPixelStats,
  getAttribution,
  EVENT_OPTIONS,
  VERTICALS,
} from "@/lib/tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Copy, Plus, Trash2, ExternalLink, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trackeamento/$pixelId")({
  component: PixelDetailPage,
});

const VERTICAL_LABEL: Record<string, string> = {
  bet: "Apostas / Bet", igaming: "iGaming / Cassino",
  hot: "Nicho Hot / +18", promo: "Promoções e descontos", outro: "Outro",
};

function PixelDetailPage() {
  const { pixelId } = Route.useParams();
  const qc = useQueryClient();

  const getFn = useServerFn(getPixel);
  const updFn = useServerFn(updatePixel);
  const listOffersFn = useServerFn(listOffers);
  const createOfferFn = useServerFn(createOffer);
  const delOfferFn = useServerFn(deleteOffer);
  const recentFn = useServerFn(listRecentClicks);
  const statsFn = useServerFn(getPixelStats);
  const attrFn = useServerFn(getAttribution);

  const pixel = useQuery({ queryKey: ["pixel", pixelId], queryFn: () => getFn({ data: { id: pixelId } }) });
  const offers = useQuery({ queryKey: ["offers", pixelId], queryFn: () => listOffersFn({ data: { pixel_id: pixelId } }) });
  const stats = useQuery({ queryKey: ["stats", pixelId], queryFn: () => statsFn({ data: { pixel_id: pixelId, days: 30 } }) });
  const recent = useQuery({ queryKey: ["recent", pixelId], queryFn: () => recentFn({ data: { pixel_id: pixelId, limit: 100 } }) });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link to="/trackeamento" className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="size-3" /> Voltar
          </Link>
          <h1 className="text-2xl font-bold truncate">{pixel.data?.name ?? "..."}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {pixel.data && <Badge variant="secondary">{VERTICAL_LABEL[pixel.data.vertical] ?? pixel.data.vertical}</Badge>}
            {pixel.data?.is_active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
            {pixel.data?.bot_username && <Badge variant="outline">@{pixel.data.bot_username}</Badge>}
            <Badge variant="outline" className="font-mono text-xs">{pixelId.slice(0, 8)}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="funil">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="atribuicao">Atribuição</TabsTrigger>
          <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
          <TabsTrigger value="instalacao">Instalação</TabsTrigger>
          <TabsTrigger value="logs">Cliques recentes</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        {/* FUNIL */}
        <TabsContent value="funil" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
            <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["stats", pixelId] })}>
              <RefreshCw className="size-3" /> Atualizar
            </Button>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
            <FunnelCard label="Cliques" value={stats.data?.clicks ?? 0} />
            <FunnelCard label="Entradas no bot" value={stats.data?.joins ?? 0} />
            <FunnelCard label="Cliques na oferta" value={stats.data?.offerClicks ?? 0} />
            <FunnelCard label="Cadastros" value={stats.data?.registers ?? 0} />
            <FunnelCard label="Depósitos" value={stats.data?.deposits ?? 0} />
            <FunnelCard label="Receita (R$)" value={(stats.data?.revenue ?? 0).toFixed(2)} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Cliques por dia</CardTitle></CardHeader>
            <CardContent>
              {stats.data?.series && stats.data.series.length > 0 ? (
                <div className="space-y-1">
                  {stats.data.series.map(d => {
                    const max = Math.max(...stats.data!.series.map(s => s.clicks), 1);
                    return (
                      <div key={d.day} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground shrink-0">{d.day}</span>
                        <div className="flex-1 bg-muted h-5 rounded overflow-hidden">
                          <div className="bg-primary h-full" style={{ width: `${(d.clicks / max) * 100}%` }} />
                        </div>
                        <span className="w-20 text-right tabular-nums">{d.clicks} cliques</span>
                        <span className="w-16 text-right tabular-nums text-muted-foreground">{d.registers} reg</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATRIBUIÇÃO */}
        <TabsContent value="atribuicao" className="space-y-4">
          <AttributionTab pixelId={pixelId} attrFn={attrFn} />
        </TabsContent>

        {/* OFERTAS */}
        <TabsContent value="ofertas" className="space-y-4">
          <OffersTab
            pixelId={pixelId}
            offers={offers.data ?? []}
            createOfferFn={createOfferFn}
            delOfferFn={delOfferFn}
            baseUrl={baseUrl}
          />
        </TabsContent>

        {/* INSTALAÇÃO */}
        <TabsContent value="instalacao" className="space-y-4">
          <InstallTab pixelId={pixelId} baseUrl={baseUrl} botUsername={pixel.data?.bot_username ?? null} />
        </TabsContent>

        {/* CLIQUES RECENTES */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>click_id</TableHead>
                    <TableHead>UTM source</TableHead>
                    <TableHead>UTM content</TableHead>
                    <TableHead>Funil</TableHead>
                    <TableHead>Telegram</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recent.data ?? []).map(r => (
                    <TableRow key={r.click_id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="font-mono text-xs">{r.click_id}</TableCell>
                      <TableCell className="text-xs">{r.utm_source ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.utm_content ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <FunnelDots r={r} />
                      </TableCell>
                      <TableCell className="text-xs">{r.tg_username ? `@${r.tg_username}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!recent.data || recent.data.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhum clique ainda.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIG */}
        <TabsContent value="config" className="space-y-4">
          {pixel.data && <ConfigTab pixel={pixel.data} updFn={updFn} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FunnelCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function FunnelDots({ r }: { r: any }) {
  const steps = [
    { ok: true, l: "C" },
    { ok: !!r.joined_at, l: "J" },
    { ok: !!r.clicked_offer_at, l: "O" },
    { ok: !!r.registered_at, l: "R" },
    { ok: !!r.deposited_at, l: "D" },
  ];
  return (
    <div className="flex gap-1">
      {steps.map((s, i) => (
        <span key={i} className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${s.ok ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.l}</span>
      ))}
    </div>
  );
}

function AttributionTab({ pixelId, attrFn }: { pixelId: string; attrFn: any }) {
  const [groupCol, setGroupCol] = useState<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term">("utm_content");
  const attr = useQuery({
    queryKey: ["attr", pixelId, groupCol],
    queryFn: () => attrFn({ data: { pixel_id: pixelId, group_col: groupCol, days: 30 } }),
  });
  return (
    <>
      <div className="flex items-center gap-2">
        <Label className="text-sm">Agrupar por:</Label>
        <Select value={groupCol} onValueChange={(v) => setGroupCol(v as never)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="utm_content">utm_content (criativo)</SelectItem>
            <SelectItem value="utm_campaign">utm_campaign</SelectItem>
            <SelectItem value="utm_source">utm_source</SelectItem>
            <SelectItem value="utm_medium">utm_medium</SelectItem>
            <SelectItem value="utm_term">utm_term (palavra-chave)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{groupCol}</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Cliques na oferta</TableHead>
                <TableHead className="text-right">Cadastros</TableHead>
                <TableHead className="text-right">Depósitos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">CR%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(attr.data ?? []).map(row => (
                <TableRow key={row.dimension}>
                  <TableCell className="font-medium text-xs max-w-xs truncate">{row.dimension}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.joins}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.offer_clicks}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.registers}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.deposits}</TableCell>
                  <TableCell className="text-right tabular-nums">R$ {Number(row.revenue ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.clicks > 0 ? ((row.registers / row.clicks) * 100).toFixed(1) : "0"}%</TableCell>
                </TableRow>
              ))}
              {(!attr.data || attr.data.length === 0) && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Sem dados nessa dimensão.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function OffersTab({ pixelId, offers, createOfferFn, delOfferFn, baseUrl }: {
  pixelId: string;
  offers: any[];
  createOfferFn: any;
  delOfferFn: any;
  baseUrl: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [dest, setDest] = useState("");
  const [subid, setSubid] = useState("sub1");

  const create = useMutation({
    mutationFn: () => createOfferFn({ data: {
      pixel_id: pixelId, slug, name, destination_url: dest,
      subid_param: subid, default_event: "InitiateCheckout",
      default_currency: "BRL",
    } }),
    onSuccess: () => {
      toast.success("Oferta criada"); setOpen(false);
      setSlug(""); setName(""); setDest("");
      qc.invalidateQueries({ queryKey: ["offers", pixelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delOfferFn({ data: { id } }),
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["offers", pixelId] }); },
  });

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Ofertas / Redirector</h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Use o link do redirector dentro do seu bot. Ele injeta o <code className="text-xs">click_id</code> como sub-id na URL da oferta
            e marca o passo "clique na oferta" do funil.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Nova oferta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova oferta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="aviator-br" />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aviator BR" />
              </div>
              <div className="space-y-2">
                <Label>URL de destino (com seu link de afiliado)</Label>
                <Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="https://meuafiliado.com/?ref=123" />
              </div>
              <div className="space-y-2">
                <Label>Parâmetro de sub-id na corretora</Label>
                <Input value={subid} onChange={(e) => setSubid(e.target.value)} placeholder="sub1" />
                <p className="text-xs text-muted-foreground">Pergunte ao gerente da casa: pode ser sub1, subid, click_id, etc.</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!slug || !name || !dest || create.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {offers.map(o => {
          const example = `${baseUrl}/api/public/track/g/<click_id>/${o.slug}`;
          return (
            <Card key={o.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{o.name}</p>
                    <p className="text-xs text-muted-foreground">slug: <code>{o.slug}</code> · sub-id: <code>{o.subid_param}</code></p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={o.destination_url} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="icon"><ExternalLink className="size-4" /></Button>
                    </a>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover oferta?")) remove.mutate(o.id); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Link do redirector (substitua <code>&lt;click_id&gt;</code> pelo recebido no /start):</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted p-2 rounded font-mono text-[11px] break-all">{example}</code>
                    <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(example); toast.success("Copiado"); }}>
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {offers.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Nenhuma oferta cadastrada.</CardContent></Card>
        )}
      </div>
    </>
  );
}

function InstallTab({ pixelId, baseUrl, botUsername }: { pixelId: string; baseUrl: string; botUsername: string | null }) {
  const snippet = useMemo(() => `<!-- Lovable Tracking — cole no <head> da sua landing page -->
<script>
(function(){
  var p = new URLSearchParams(location.search);
  var fbp = (document.cookie.match(/_fbp=([^;]+)/)||[])[1] || null;
  var fbc = (document.cookie.match(/_fbc=([^;]+)/)||[])[1] || null;
  var fbclid = p.get("fbclid");
  if (fbclid && !fbc) fbc = "fb.1." + Date.now() + "." + fbclid;
  var payload = {
    pixel_id: "${pixelId}",
    fbp: fbp, fbc: fbc, fbclid: fbclid,
    ttclid: p.get("ttclid"), gclid: p.get("gclid"),
    kwai_click_id: p.get("kwai_click_id"),
    utm_source: p.get("utm_source"), utm_medium: p.get("utm_medium"),
    utm_campaign: p.get("utm_campaign"), utm_content: p.get("utm_content"),
    utm_term: p.get("utm_term"),
    landing_url: location.href, referrer: document.referrer
  };
  fetch("${baseUrl}/api/public/track/click", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  }).then(function(r){return r.json();}).then(function(d){
    if(!d || !d.telegram_url) return;
    // Substitua TODOS os links pro Telegram pela URL personalizada com o click_id
    document.querySelectorAll('a[data-tg], a.tg-link').forEach(function(a){ a.href = d.telegram_url; });
    window.__tgUrl = d.telegram_url;
  }).catch(function(){});
})();
</script>`, [pixelId, baseUrl]);

  const postbackReg = `${baseUrl}/api/public/track/postback/${pixelId}?secret=<POSTBACK_SECRET>&click_id={sub1}&event=register&external_id={user_id}`;
  const postbackDep = `${baseUrl}/api/public/track/postback/${pixelId}?secret=<POSTBACK_SECRET>&click_id={sub1}&event=deposit&value={amount}&currency=BRL&external_id={user_id}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Snippet da landing page</CardTitle>
          <CardDescription>Cole dentro do <code>&lt;head&gt;</code> da landing onde fica o botão "Entrar no Telegram".</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={snippet} readOnly className="font-mono text-xs h-64" />
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Copiado"); }}>
            <Copy className="size-4" /> Copiar snippet
          </Button>
          <p className="text-xs text-muted-foreground">
            O snippet identifica o clique no anúncio, gera um <code>click_id</code> e retorna a URL personalizada do bot.
            Marque seus botões/links do Telegram com <code>data-tg</code> ou classe <code>tg-link</code> para serem trocados automaticamente.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Bot do Telegram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {botUsername ? (
            <p>Bot vinculado: <strong>@{botUsername}</strong>. Quando o usuário entrar pelo link, o bot detecta automaticamente o <code>/start tk_&lt;click_id&gt;</code> e dispara o evento <strong>Lead</strong> no Meta com os dados originais do clique.</p>
          ) : (
            <p className="text-muted-foreground">Vincule um bot na aba <strong>Configurações</strong> para que o sistema detecte automaticamente as entradas.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Postback da corretora (cadastro / depósito)</CardTitle>
          <CardDescription>
            Cole essas URLs no painel de afiliado (campo Postback / S2S / Conversion URL). Os tokens entre chaves <code>{`{...}`}</code> são substituídos pela plataforma deles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1">Cadastro:</p>
            <CopyRow value={postbackReg} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Depósito (FTD):</p>
            <CopyRow value={postbackDep} />
          </div>
          <p className="text-xs text-muted-foreground">
            Configure o <code>postback_secret</code> na aba Configurações deste pixel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-muted p-2 rounded font-mono text-[11px] break-all">{value}</code>
      <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}>
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

function ConfigTab({ pixel, updFn }: { pixel: any; updFn: any }) {
  const qc = useQueryClient();
  const [name, setName] = useState<string>(pixel.name);
  const [vertical, setVertical] = useState<string>(pixel.vertical);
  const [isActive, setIsActive] = useState<boolean>(pixel.is_active);
  const [accountId, setAccountId] = useState<string>(pixel.account_id ?? "");
  const [roomId, setRoomId] = useState<string>(pixel.room_id ?? "");
  const [metaId, setMetaId] = useState<string>(pixel.meta_integration_id ?? "");
  const [evJoin, setEvJoin] = useState<string>(pixel.event_on_join ?? "Lead");
  const [evOffer, setEvOffer] = useState<string>(pixel.event_on_offer_click ?? "InitiateCheckout");
  const [evReg, setEvReg] = useState<string>(pixel.event_on_register ?? "CompleteRegistration");
  const [evDep, setEvDep] = useState<string>(pixel.event_on_deposit ?? "Purchase");

  const accounts = useQuery({
    queryKey: ["ta-mini-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id,bot_username");
      return data ?? [];
    },
  });
  const rooms = useQuery({
    queryKey: ["rooms-mini-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id,name");
      return data ?? [];
    },
  });
  const metas = useQuery({
    queryKey: ["meta-mini-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("meta_integrations").select("id,pixel_id");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: () => updFn({ data: {
      id: pixel.id,
      name, vertical: vertical as never, is_active: isActive,
      account_id: accountId || null,
      room_id: roomId || null,
      meta_integration_id: metaId || null,
      event_on_join: evJoin as never,
      event_on_offer_click: evOffer as never,
      event_on_register: evReg as never,
      event_on_deposit: evDep as never,
    } }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["pixel", pixel.id] });
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Geral</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Vertical</Label>
            <Select value={vertical} onValueChange={setVertical}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABEL[v]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><p className="text-sm font-medium">Ativo</p><p className="text-xs text-muted-foreground">Desligado, nenhum evento é registrado.</p></div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vínculos</CardTitle></CardHeader>
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
          <div className="space-y-2">
            <Label>Integração Meta CAPI</Label>
            <Select value={metaId || "none"} onValueChange={(v) => setMetaId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {metas.data?.map(m => <SelectItem key={m.id} value={m.id}>Pixel {m.pixel_id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos Meta por etapa</CardTitle>
          <CardDescription>Qual evento padrão do Meta disparar em cada passo do funil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <EventRow label="Entrada no bot (Lead)" value={evJoin} onChange={setEvJoin} />
          <EventRow label="Clique na oferta (InitiateCheckout)" value={evOffer} onChange={setEvOffer} />
          <EventRow label="Cadastro na corretora (CompleteRegistration)" value={evReg} onChange={setEvReg} />
          <EventRow label="Depósito (Purchase)" value={evDep} onChange={setEvDep} />
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Salvando..." : "Salvar configurações"}
      </Button>
    </div>
  );
}

function EventRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          {EVENT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o === "off" ? "Desativado" : o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}