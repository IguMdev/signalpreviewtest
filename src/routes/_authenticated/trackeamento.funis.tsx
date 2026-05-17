import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listOffers, createOffer, deleteOffer,
  getMyRedirectBase, EVENT_OPTIONS,
} from "@/lib/tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Funnel, Plus, Trash2, Copy } from "lucide-react";
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

  const offers = useQuery({ queryKey: ["offers", pixelId], queryFn: () => listFn({ data: { pixel_id: pixelId } }) });
  const base = useQuery({ queryKey: ["redirect-base"], queryFn: () => baseFn() });

  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [dest, setDest] = useState("");
  const [subParam, setSubParam] = useState("sub1");
  const [defaultEvent, setDefaultEvent] = useState<(typeof EVENT_OPTIONS)[number]>("InitiateCheckout");

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      pixel_id: pixelId, slug, name, destination_url: dest,
      subid_param: subParam, default_event: defaultEvent, default_currency: "BRL",
    } }),
    onSuccess: () => {
      toast.success("Oferta criada");
      setOpen(false); setSlug(""); setName(""); setDest("");
      qc.invalidateQueries({ queryKey: ["offers", pixelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          <DialogTrigger asChild><Button><Plus className="size-4" /> Nova oferta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova oferta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aviator Brazino" /></div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="aviator" />
                <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números, _ e -</p>
              </div>
              <div className="space-y-2"><Label>URL de destino</Label><Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="https://corretora.com/?ref=123" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Parâmetro subid</Label>
                  <Input value={subParam} onChange={(e) => setSubParam(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Evento Meta</Label>
                  <Select value={defaultEvent} onValueChange={(v) => setDefaultEvent(v as never)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EVENT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o === "off" ? "Desativado" : o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!slug || !name || !dest || create.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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