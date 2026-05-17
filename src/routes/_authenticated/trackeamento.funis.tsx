import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listOffers, createOffer, deleteOffer,
  getMyRedirectBase, EVENT_OPTIONS, listDomains,
} from "@/lib/tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Funnel, Plus, Trash2, Copy, AlertTriangle, HelpCircle, X } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/funis")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: FunisPage,
});

function FunisPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Funnel className="size-6" /> Funis</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Cadastre as ofertas (links de afiliado) de cada pixel. Geramos um redirector único por clique para injetar o <code>subid</code> e disparar eventos Meta.
        </p>
      </div>
      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId && <OffersList pixelId={effectiveId} />}
    </div>
  );
}

function OffersList({ pixelId }: { pixelId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listOffers);
  const createFn = useServerFn(createOffer);
  const delFn = useServerFn(deleteOffer);
  const baseFn = useServerFn(getMyRedirectBase);
  const domainsFn = useServerFn(listDomains);

  const offers = useQuery({ queryKey: ["offers", pixelId], queryFn: () => listFn({ data: { pixel_id: pixelId } }) });
  const base = useQuery({ queryKey: ["redirect-base"], queryFn: () => baseFn() });
  const domains = useQuery({ queryKey: ["tracking-domains"], queryFn: () => domainsFn() });

  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState<{ offer: any; domain: string } | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["offers", pixelId] }); },
  });

  const baseHost = base.data?.domain
    ? `https://${base.data.domain}`
    : (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Novo funil</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <NewFunnelDialog
              pixelId={pixelId}
              domains={(domains.data ?? []).filter((d: any) => d.verified_at)}
              onDone={(created) => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["offers", pixelId] });
                if (created) setInstructions(created);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!instructions} onOpenChange={(o) => !o && setInstructions(null)}>
        <DialogContent className="max-w-2xl">
          {instructions && (
            <InstructionsDialog
              offer={instructions.offer}
              domain={instructions.domain}
              onClose={() => setInstructions(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {offers.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : offers.data && offers.data.length > 0 ? (
        <div className="grid gap-3">
          {offers.data.map((o: any) => {
            const exampleUrl = `${baseHost}/api/public/track/g/<click_id>/${o.slug}`;
            return (
              <Card key={o.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold">{o.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary">/{o.slug}</Badge>
                        <Badge variant="outline">{o.default_event}</Badge>
                        <Badge variant="outline">subid: {o.subid_param}</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover oferta?")) remove.mutate(o.id); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground break-all">Destino: {o.destination_url}</div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(exampleUrl); toast.success("Copiado"); }}
                    className="w-full text-left text-xs font-mono bg-muted/50 hover:bg-muted rounded p-2 flex items-center gap-2"
                  >
                    <Copy className="size-3 shrink-0" /> <span className="truncate">{exampleUrl}</span>
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma oferta ainda</CardTitle>
            <CardDescription>Crie a primeira oferta para gerar links de redirect com tracking.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function InstructionsDialog({
  offer, domain, onClose,
}: { offer: any; domain: string; onClose: () => void }) {
  const scriptTag = `<script src="https://${domain}/${offer.id}.js"></script>`;
  const inviteLink = `https://${domain}/t/${offer.id}`;
  return (
    <>
      <DialogHeader><DialogTitle>Instruções de Configuração</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="rounded-lg border bg-background/40 p-4 space-y-2">
          <p className="text-sm font-semibold">Adicione esse código ao Head do seu site:</p>
          <CopyRow value={scriptTag} mono />
        </div>
        <div className="rounded-lg border bg-background/40 p-4 space-y-2">
          <p className="text-sm font-semibold">Utilize esse link para entrada no seu Grupo do Telegram:</p>
          <CopyRow value={inviteLink} />
        </div>
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Siga às instruções com atenção. Apenas entradas em páginas com o <strong>código configurado</strong> no head e feitas através do <strong>link correto</strong> serão contabilizadas.
          </span>
        </div>
      </div>
      <DialogFooter className="justify-center sm:justify-center">
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </DialogFooter>
    </>
  );
}

function CopyRow({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className="flex items-stretch gap-2">
      <div className={`flex-1 min-w-0 rounded-md border bg-muted/40 px-3 py-2 text-xs overflow-x-auto whitespace-nowrap ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
      <Button
        type="button"
        onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}
        className="shrink-0"
      >
        <Copy className="size-4" /> Copiar
      </Button>
    </div>
  );
}

function NewFunnelDialog({
  pixelId, domains, onDone,
}: { pixelId: string; domains: any[]; onDone: (created?: { offer: any; domain: string }) => void }) {
  const { pixels } = usePixelFilter();
  const createFn = useServerFn(createOffer);

  const [name, setName] = useState("");
  const [selectedPixel, setSelectedPixel] = useState<string>(pixelId);
  const [domain, setDomain] = useState<string>("");
  const [requireEntry, setRequireEntry] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [draftUrl, setDraftUrl] = useState("");

  function slugify(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "funil";
  }

  function addUrl() {
    if (!draftUrl.trim() || urls.length >= 5) return;
    try { new URL(draftUrl); } catch { toast.error("URL inválida"); return; }
    setUrls([...urls, draftUrl.trim()]);
    setDraftUrl("");
  }

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      pixel_id: selectedPixel,
      slug: slugify(name),
      name,
      destination_url: urls[0],
      subid_param: "sub1",
      default_event: "InitiateCheckout",
      default_currency: "BRL",
    } }),
    onSuccess: (offer: any) => { toast.success("Funil criado"); onDone({ offer, domain }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = name.trim() && selectedPixel && domain && urls.length > 0;

  return (
    <TooltipProvider delayDuration={150}>
      <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>

      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite o Nome do Funil" />
          </div>
          <div className="space-y-2">
            <Label>Pixel</Label>
            <Select value={selectedPixel} onValueChange={setSelectedPixel}>
              <SelectTrigger><SelectValue placeholder="Selecione um Pixel" /></SelectTrigger>
              <SelectContent>
                {pixels.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-2">
            <Label>Domínio</Label>
            <Select value={domain} onValueChange={setDomain} disabled={domains.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={domains.length === 0 ? "Nenhum domínio verificado" : "Selecione o Domínio"} />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d: any) => <SelectItem key={d.id} value={d.domain}>{d.domain}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 h-10">
                <Switch checked={requireEntry} onCheckedChange={setRequireEntry} disabled />
                <span className="text-sm">Ativar Solicitação de Entrada</span>
                <HelpCircle className="size-3.5 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              A solicitação de entrada está disponível apenas para canais privados.
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-2">
          <Label>Adicionar URLs (máximo 5)</Label>
          <div className="flex gap-2">
            <Input
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
              placeholder={domain ? "https://corretora.com/?ref=123" : "Selecione um domínio primeiro"}
              disabled={!domain || urls.length >= 5}
            />
            <Button type="button" variant="secondary" onClick={addUrl} disabled={!domain || !draftUrl || urls.length >= 5}>
              Adicionar
            </Button>
          </div>
          {urls.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {urls.map((u, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
                  <span className="flex-1 truncate font-mono">{u}</span>
                  <button type="button" onClick={() => setUrls(urls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter className="gap-2 items-center justify-between sm:justify-between">
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5" /> Este bloco não poderá ser alterado.
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onDone()} disabled={create.isPending}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!canSave || create.isPending}>
            {create.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogFooter>
    </TooltipProvider>
  );
}