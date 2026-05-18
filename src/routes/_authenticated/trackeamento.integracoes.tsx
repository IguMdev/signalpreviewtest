import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getMyRedirectBase,
  listClicksFiltered,
  listPixels,
  listIntegrations,
  createIntegration,
  deleteIntegration,
} from "@/lib/tracking.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Link2, Plus, Copy, Download, AlertTriangle, Trash2, Plug, Facebook,
  Wrench, ArrowLeft, ArrowRight, CheckCircle2, Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/trackeamento/integracoes")({
  component: IntegracoesPage,
});

type EventType = "register" | "ftd" | "deposit" | "custom";
const EVENT_LABEL: Record<EventType, string> = {
  register: "Registro",
  ftd: "FTD (Primeiro Depósito)",
  deposit: "Depósito",
  custom: "Lead / Custom",
};

function IntegracoesPage() {
  const listFn = useServerFn(listIntegrations);
  const pixelsFn = useServerFn(listPixels);
  const baseFn = useServerFn(getMyRedirectBase);
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: () => listFn() });
  const pixels = useQuery({ queryKey: ["tracking-pixels"], queryFn: () => pixelsFn() });
  const base = useQuery({ queryKey: ["redirect-base"], queryFn: () => baseFn() });
  const baseHost = base.data?.domain ? `https://${base.data.domain}` : (typeof window !== "undefined" ? window.location.origin : "");

  const [wizardOpen, setWizardOpen] = useState(false);

  const rows = (integrations.data ?? []) as any[];
  const pixelMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of (pixels.data ?? []) as any[]) m.set(p.id, p);
    return m;
  }, [pixels.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Link2 className="size-6" /> Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Gerencie integrações com Casas de Aposta, Corretoras e outros sistemas para rastrear Registros, FTD, Depósitos ou Outros.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Plug className="size-4" /> Integrações Realizadas</CardTitle>
            <CardDescription>Configure URLs de webhook e acompanhe o status dos seus postbacks.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full">{rows.length} integrações</Badge>
            <Button onClick={() => setWizardOpen(true)}><Plus className="size-4" /> Nova Integração</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr className="text-left">
                  <th className="p-3">Nome</th>
                  <th className="p-3">Evento</th>
                  <th className="p-3">Link de Divulgação</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {integrations.isLoading && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
                )}
                {!integrations.isLoading && rows.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Nenhuma integração cadastrada. Clique em "Nova Integração" para começar.
                  </td></tr>
                )}
                {rows.map((r) => {
                  const pixel = pixelMap.get(r.pixel_id);
                  const divulgUrl = `${baseHost}/api/public/track/postback/${r.pixel_id}?secret=${pixel?.postback_secret ?? ""}&sub1={click_id}&event=${r.event_type}&integration=${r.id}`;
                  return <IntegrationRow key={r.id} row={r} pixel={pixel} divulgUrl={divulgUrl} />;
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-amber-500">Atenção: Requisito de Integração</div>
          <p className="text-muted-foreground mt-1">
            A integração só funciona corretamente com plataformas que permitam o envio do parâmetro{" "}
            <code className="bg-background/60 px-1 rounded text-amber-400">click_id</code> através de Postback (S2S).
            Antes de realizar a configuração, verifique com o suporte do seu sistema ou provedor se eles oferecem suporte ao repasse desse parâmetro.
          </p>
        </div>
      </div>

      <EventsHistoryCard pixels={(pixels.data ?? []) as any[]} />

      {wizardOpen && (
        <NewIntegrationWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          pixels={(pixels.data ?? []) as any[]}
          baseHost={baseHost}
        />
      )}
    </div>
  );
}

function IntegrationRow({ row, pixel, divulgUrl }: { row: any; pixel: any; divulgUrl: string }) {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteIntegration);
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Integração removida"); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const evLabel = row.event_type === "custom" && row.custom_event_name
    ? row.custom_event_name
    : EVENT_LABEL[row.event_type as EventType];
  return (
    <tr className="border-t">
      <td className="p-3 font-medium">
        <div>{row.name}</div>
        <div className="text-xs text-muted-foreground">{pixel?.name ?? "—"}</div>
      </td>
      <td className="p-3"><Badge variant="secondary">{evLabel}</Badge></td>
      <td className="p-3">
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(divulgUrl); toast.success("Link copiado"); }}
          className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 max-w-xs truncate"
          title={divulgUrl}
        >
          <Copy className="size-3 shrink-0" /> <span className="truncate">{divulgUrl}</span>
        </button>
      </td>
      <td className="p-3">
        <Badge variant={row.is_active ? "default" : "outline"}>{row.is_active ? "Ativa" : "Inativa"}</Badge>
      </td>
      <td className="p-3 text-right">
        <Button size="sm" variant="ghost" onClick={() => del.mutate()} disabled={del.isPending}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

// ============= WIZARD =============
function NewIntegrationWizard({
  open, onOpenChange, pixels, baseHost,
}: { open: boolean; onOpenChange: (v: boolean) => void; pixels: any[]; baseHost: string }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [pixelId, setPixelId] = useState<string>("");
  const [eventType, setEventType] = useState<EventType | "">("");
  const [customEventName, setCustomEventName] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [metaCustomEvent, setMetaCustomEvent] = useState("");
  const [metaValue, setMetaValue] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const qc = useQueryClient();
  const createFn = useServerFn(createIntegration);
  const create = useMutation({
    mutationFn: () => createFn({
      data: {
        pixel_id: pixelId,
        name,
        event_type: eventType as EventType,
        custom_event_name: eventType === "custom" ? (customEventName || null) : null,
        redirect_url: redirectUrl,
        meta_custom_event: metaCustomEvent || null,
        meta_value: metaValue ? Number(metaValue) : null,
        meta_currency: "BRL",
        is_active: true,
      },
    }),
    onSuccess: (res: any) => {
      toast.success("Integração criada");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      setCreatedId(res.id);
      setStep(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pixel = pixels.find((p) => p.id === pixelId);
  const finalUrl = pixel
    ? `${baseHost}/api/public/track/postback/${pixel.id}?secret=${pixel.postback_secret}&sub1={click_id}&event=${eventType}${createdId ? `&integration=${createdId}` : ""}`
    : "";

  const canNext1 = !!(name && pixelId && eventType && redirectUrl && (eventType !== "custom" || customEventName));

  const reset = () => {
    setStep(1); setName(""); setPixelId(""); setEventType(""); setCustomEventName("");
    setRedirectUrl(""); setMetaCustomEvent(""); setMetaValue(""); setCreatedId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Plug className="size-5" />
              </div>
              <div>
                <DialogTitle>Nova Integração</DialogTitle>
                <DialogDescription>Configure o webhook de tracking para sua plataforma</DialogDescription>
              </div>
            </div>
            <Stepper step={step} />
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Registro VIP" />
              </div>
              <div className="space-y-2">
                <Label>Pixel</Label>
                <Select value={pixelId} onValueChange={setPixelId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um Pixel" /></SelectTrigger>
                  <SelectContent>
                    {pixels.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum pixel. <Link to="/trackeamento/pixels" className="underline">Criar pixel</Link></div>}
                    {pixels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Evento</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                <SelectTrigger><SelectValue placeholder="Selecione o Evento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="register">Registro</SelectItem>
                  <SelectItem value="ftd">FTD (Primeiro Depósito)</SelectItem>
                  <SelectItem value="deposit">Depósito</SelectItem>
                  <SelectItem value="custom">Lead / Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {eventType === "custom" && (
              <div className="space-y-2">
                <Label>Nome do Evento Customizado</Label>
                <Input value={customEventName} onChange={(e) => setCustomEventName(e.target.value)} placeholder="ex: LeadHotmart" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Link de Redirect (Destino)</Label>
              <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://seu-site.com/obrigado" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Facebook className="size-4 text-blue-500" /> Configurações Meta Pixel CAPI (opcional)
            </div>
            <div className="space-y-2">
              <Label>Nome do Evento Meta (opcional)</Label>
              <Input value={metaCustomEvent} onChange={(e) => setMetaCustomEvent(e.target.value)} placeholder="ex: Purchase, CompleteRegistration, Lead" />
              <p className="text-xs text-muted-foreground">Deixe em branco para usar o evento padrão do pixel.</p>
            </div>
            <div className="space-y-2">
              <Label>Valor padrão (opcional)</Label>
              <Input type="number" value={metaValue} onChange={(e) => setMetaValue(e.target.value)} placeholder="ex: 50.00" />
              <p className="text-xs text-muted-foreground">Usado quando o postback não enviar valor. Moeda: BRL.</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Dica:</strong> se você ainda não conectou sua conta Meta,{" "}
              <Link to="/integracoes/meta" className="underline">abra a integração Meta</Link> primeiro.
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="size-5" />
              <span className="font-medium">Integração criada com sucesso!</span>
            </div>
            <div className="space-y-2">
              <Label>URL de Postback (S2S)</Label>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(finalUrl); toast.success("Copiado"); }}
                className="w-full text-left text-xs font-mono bg-muted/50 hover:bg-muted rounded p-3 break-all relative"
              >
                <Copy className="size-3 absolute top-2 right-2 opacity-60" />
                {finalUrl}
              </button>
              <p className="text-xs text-muted-foreground">
                Configure esta URL na sua plataforma. Substitua <code className="bg-muted px-1 rounded">{"{click_id}"}</code> pela variável de click_id (SubID) da plataforma.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Link de Redirect</Label>
              <div className="text-xs font-mono bg-muted/50 rounded p-3 break-all">{redirectUrl}</div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!canNext1}>Próximo <ArrowRight className="size-4" /></Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Voltar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Criando..." : <>Criar e ver instalação <ArrowRight className="size-4" /></>}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: number }) {
  const items = [
    { n: 1, label: "Configuração" },
    { n: 2, label: "Facebook" },
    { n: 3, label: "Instalação" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <div className={`size-7 rounded-full flex items-center justify-center text-xs font-semibold ${
            step >= it.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>{it.n}</div>
          <span className={`text-xs ${step >= it.n ? "text-foreground" : "text-muted-foreground"}`}>{it.label}</span>
          {i < items.length - 1 && <div className="w-6 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

// ============= HISTORY =============
function EventsHistoryCard({ pixels }: { pixels: any[] }) {
  const [pixelId, setPixelId] = useState<string>("any");
  const [from, setFrom] = useState("");
  const [event, setEvent] = useState<"any" | "click" | "join" | "offer_click" | "register" | "deposit">("any");
  const [search, setSearch] = useState("");
  const fn = useServerFn(listClicksFiltered);

  const effectivePixel = pixelId === "any" ? (pixels[0]?.id ?? null) : pixelId;
  const q = useQuery({
    queryKey: ["integ-events", effectivePixel, from, event],
    enabled: !!effectivePixel,
    queryFn: () => fn({
      data: {
        pixel_id: effectivePixel!,
        from: from ? new Date(from).toISOString() : null,
        to: null,
        event,
        limit: 1000,
      },
    }),
  });
  const rows = (q.data ?? []) as any[];
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      (r.click_id ?? "").toLowerCase().includes(s) ||
      (r.utm_source ?? "").toLowerCase().includes(s) ||
      (r.utm_campaign ?? "").toLowerCase().includes(s),
    );
  }, [rows, search]);

  const exportCsv = () => {
    const headers = ["created_at", "click_id", "event_type", "utm_source", "utm_campaign", "sale_value", "sale_currency"];
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const evType = r.deposited_at ? "deposit" : r.registered_at ? "register" : r.clicked_offer_at ? "offer_click" : r.joined_at ? "join" : "click";
      lines.push(headers.map((h) => esc(h === "event_type" ? evType : r[h])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eventos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" /> Histórico de Eventos</CardTitle>
          <CardDescription>Acompanhe todos os postbacks recebidos das suas integrações.</CardDescription>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Período</Label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Selecione uma Data" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Tipo</Label>
            <Select value={event} onValueChange={(v) => setEvent(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos os Tipos</SelectItem>
                <SelectItem value="click">Clique</SelectItem>
                <SelectItem value="join">Entrou no grupo</SelectItem>
                <SelectItem value="offer_click">Clique na oferta</SelectItem>
                <SelectItem value="register">Registro</SelectItem>
                <SelectItem value="deposit">Depósito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Pixel</Label>
            <Select value={pixelId} onValueChange={setPixelId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos os Pixels</SelectItem>
                {pixels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome Interno, Tipo ou ClickID..." />
            </div>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 uppercase text-muted-foreground">
              <tr className="text-left">
                <th className="p-2">Data</th>
                <th className="p-2">Horário</th>
                <th className="p-2">Tipo do Evento</th>
                <th className="p-2">Valor</th>
                <th className="p-2">ClickID</th>
                <th className="p-2">UTM Source</th>
              </tr>
            </thead>
            <tbody>
              {!effectivePixel && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Crie um pixel para visualizar eventos.</td></tr>
              )}
              {effectivePixel && q.isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {effectivePixel && !q.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum evento encontrado com os filtros aplicados.</td></tr>
              )}
              {filtered.map((r) => {
                const evType = r.deposited_at ? "deposit" : r.registered_at ? "register" : r.clicked_offer_at ? "offer_click" : r.joined_at ? "join" : "click";
                const d = new Date(r.created_at);
                return (
                  <tr key={r.click_id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{d.toLocaleDateString("pt-BR")}</td>
                    <td className="p-2 whitespace-nowrap">{d.toLocaleTimeString("pt-BR")}</td>
                    <td className="p-2"><Badge variant="secondary">{evType}</Badge></td>
                    <td className="p-2">{r.sale_value ? `${r.sale_value} ${r.sale_currency ?? ""}` : "—"}</td>
                    <td className="p-2 font-mono">{r.click_id}</td>
                    <td className="p-2">{r.utm_source ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Mostrando {filtered.length} de {rows.length} eventos.</p>
      </CardContent>
    </Card>
  );
}