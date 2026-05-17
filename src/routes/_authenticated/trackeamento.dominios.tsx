import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listDomains, createDomain, deleteDomain, verifyDomain,
} from "@/lib/tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Globe, Plus, Trash2, ShieldCheck, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trackeamento/dominios")({
  component: DomainsPage,
});

function DomainsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDomains);
  const createFn = useServerFn(createDomain);
  const delFn = useServerFn(deleteDomain);
  const verFn = useServerFn(verifyDomain);

  const domains = useQuery({ queryKey: ["tracking-domains"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { domain } }),
    onSuccess: () => {
      toast.success("Domínio adicionado. Configure o registro TXT para verificar.");
      setOpen(false); setDomain("");
      qc.invalidateQueries({ queryKey: ["tracking-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["tracking-domains"] }); },
  });
  const verify = useMutation({
    mutationFn: (id: string) => verFn({ data: { id } }),
    onSuccess: () => { toast.success("Domínio verificado!"); qc.invalidateQueries({ queryKey: ["tracking-domains"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="size-6" /> Domínios</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Use um domínio próprio nos seus links de redirect (ex.: <code>track.seusite.com/g/...</code>) em vez do domínio padrão. Isso melhora a entregabilidade e o branding.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Adicionar domínio</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo domínio</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Domínio ou subdomínio</Label>
                <Input value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase())} placeholder="track.seusite.com" />
                <p className="text-xs text-muted-foreground">Sem https:// e sem barra. Use preferencialmente um subdomínio.</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!domain || create.isPending}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {domains.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : domains.data && domains.data.length > 0 ? (
        <div className="grid gap-3">
          {domains.data.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-lg">{d.domain}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {d.verified_at ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700"><ShieldCheck className="size-3 mr-1" /> Verificado</Badge>
                      ) : (
                        <Badge variant="outline">Aguardando DNS</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!d.verified_at && (
                      <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)} disabled={verify.isPending}>
                        Verificar agora
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover domínio?")) remove.mutate(d.id); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {!d.verified_at && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs">
                    <p className="font-semibold">Configure os registros DNS:</p>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">1. Registro <strong>TXT</strong> para verificar a propriedade:</p>
                      <div className="grid grid-cols-[80px_1fr] gap-2 font-mono">
                        <span className="text-muted-foreground">Tipo:</span><span>TXT</span>
                        <span className="text-muted-foreground">Nome:</span><CopyChip value={`_lovable.${d.domain}`} />
                        <span className="text-muted-foreground">Valor:</span><CopyChip value={`lovable_verify=${d.verification_token}`} />
                      </div>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-border/50">
                      <p className="text-muted-foreground">2. Registro <strong>CNAME</strong> para apontar o tráfego:</p>
                      <div className="grid grid-cols-[80px_1fr] gap-2 font-mono">
                        <span className="text-muted-foreground">Tipo:</span><span>CNAME</span>
                        <span className="text-muted-foreground">Nome:</span><CopyChip value={d.domain} />
                        <span className="text-muted-foreground">Valor:</span><CopyChip value="cname.lovable.app" />
                      </div>
                      <p className="text-muted-foreground pt-1">
                        Use Cloudflare (modo proxy) para SSL automático. Pode levar até 1h para propagar.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum domínio configurado</CardTitle>
            <CardDescription>Sem domínio próprio, seus links usarão o domínio padrão da plataforma.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function CopyChip({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}
      className="inline-flex items-center gap-1 bg-background border rounded px-2 py-0.5 text-left break-all hover:bg-accent transition w-fit max-w-full"
    >
      <span className="truncate">{value}</span>
      <Copy className="size-3 shrink-0 opacity-60" />
    </button>
  );
}