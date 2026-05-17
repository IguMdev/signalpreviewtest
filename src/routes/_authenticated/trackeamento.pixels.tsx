import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listPixels, createPixel, deletePixel, updatePixel,
  VERTICALS, EVENT_OPTIONS,
} from "@/lib/tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Code2, Plus, Trash2, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trackeamento/pixels")({
  component: PixelsPage,
});

const VERTICAL_LABEL: Record<string, string> = {
  bet: "Apostas / Bet", igaming: "iGaming / Cassino",
  hot: "Nicho Hot / +18", promo: "Promoções e descontos", outro: "Outro",
};

function PixelsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPixels);
  const createFn = useServerFn(createPixel);
  const delFn = useServerFn(deletePixel);

  const pixels = useQuery({ queryKey: ["tracking-pixels"], queryFn: () => listFn() });

  const accounts = useQuery({
    queryKey: ["telegram-accounts-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id,bot_username").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<(typeof VERTICALS)[number]>("bet");
  const [accountId, setAccountId] = useState<string>("");

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      name, vertical, account_id: accountId || null, is_active: true,
      event_on_join: "Lead", event_on_offer_click: "InitiateCheckout",
      event_on_register: "CompleteRegistration", event_on_deposit: "Purchase",
    } }),
    onSuccess: () => {
      toast.success("Pixel criado");
      setOpen(false); setName(""); setAccountId("");
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["tracking-pixels"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Code2 className="size-6" /> Pixels</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cada pixel representa uma campanha ou funil. Vincule um bot, ofertas e Meta CAPI para medir o caminho completo: clique → bot → cadastro → depósito.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Novo pixel</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo pixel</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Campanha Aviator BR" /></div>
              <div className="space-y-2">
                <Label>Vertical</Label>
                <Select value={vertical} onValueChange={(v) => setVertical(v as never)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABEL[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bot do Telegram <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (escolher depois)</SelectItem>
                    {accounts.data?.map(a => <SelectItem key={a.id} value={a.id}>@{a.bot_username ?? "(sem username)"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
                {create.isPending ? "Criando..." : "Criar pixel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pixels.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : pixels.data && pixels.data.length > 0 ? (
        <div className="grid gap-3">
          {pixels.data.map(p => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary">{VERTICAL_LABEL[p.vertical] ?? p.vertical}</Badge>
                    {p.is_active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                    {p.bot_username && <Badge variant="outline">@{p.bot_username}</Badge>}
                    <Badge variant="outline" className="font-mono text-xs">{p.id.slice(0, 8)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/trackeamento/metricas" search={{ pixel: p.id }}>
                    <Button variant="outline" size="sm">Ver métricas</Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                    <Settings2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm(`Remover pixel "${p.name}"? Os cliques serão perdidos.`)) remove.mutate(p.id);
                  }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum pixel ainda</CardTitle>
            <CardDescription>Crie o primeiro pixel para começar a rastrear seu funil.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <EditPixelDialog pixel={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditPixelDialog({ pixel, onClose }: { pixel: any | null; onClose: () => void }) {
  return (
    <Dialog open={!!pixel} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Editar pixel</DialogTitle></DialogHeader>
        {pixel && <EditPixelForm key={pixel.id} pixel={pixel} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditPixelForm({ pixel, onClose }: { pixel: any; onClose: () => void }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updatePixel);
  const [name, setName] = useState<string>(pixel.name);
  const [vertical, setVertical] = useState<string>(pixel.vertical);
  const [isActive, setIsActive] = useState<boolean>(pixel.is_active);
  const [evJoin, setEvJoin] = useState<string>(pixel.event_on_join);
  const [evOffer, setEvOffer] = useState<string>(pixel.event_on_offer_click);
  const [evReg, setEvReg] = useState<string>(pixel.event_on_register);
  const [evDep, setEvDep] = useState<string>(pixel.event_on_deposit);

  const save = useMutation({
    mutationFn: () => updFn({ data: {
      id: pixel.id, name, vertical: vertical as never, is_active: isActive,
      event_on_join: evJoin as never, event_on_offer_click: evOffer as never,
      event_on_register: evReg as never, event_on_deposit: evDep as never,
    } }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Vertical</Label>
          <Select value={vertical} onValueChange={setVertical}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABEL[v]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div><p className="text-sm font-medium">Ativo</p><p className="text-xs text-muted-foreground">Desligado: nenhum evento é registrado.</p></div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-semibold">Eventos Meta por etapa</p>
          <EventRow label="Entrada no bot" value={evJoin} onChange={setEvJoin} />
          <EventRow label="Clique na oferta" value={evOffer} onChange={setEvOffer} />
          <EventRow label="Cadastro" value={evReg} onChange={setEvReg} />
          <EventRow label="Depósito" value={evDep} onChange={setEvDep} />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
      </DialogFooter>
    </>
  );
}

function EventRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>{EVENT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o === "off" ? "Desativado" : o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}