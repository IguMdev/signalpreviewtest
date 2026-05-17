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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Code2, Plus, Trash2, Settings2, HelpCircle, AlertTriangle, ExternalLink, Check } from "lucide-react";

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
          <DialogContent className="max-w-2xl">
            <NewPixelWizard
              accounts={accounts.data ?? []}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
              }}
            />
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

function NewPixelWizard({
  accounts, onDone,
}: { accounts: any[]; onDone: () => void }) {
  const createFn = useServerFn(createPixel);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [vertical, setVertical] = useState<(typeof VERTICALS)[number]>("bet");
  const [accountId, setAccountId] = useState<string>("");

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      name, vertical, account_id: accountId || null, is_active: true,
      event_on_join: "Lead", event_on_offer_click: "InitiateCheckout",
      event_on_register: "CompleteRegistration", event_on_deposit: "Purchase",
      meta_pixel_id: metaPixelId || null,
      meta_access_token: accessToken || null,
      meta_test_event_code: testEventCode || null,
    } }),
    onSuccess: () => { toast.success("Pixel criado"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canNext = name.trim().length > 0 && metaPixelId.trim().length > 0 && accessToken.trim().length > 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo Pixel</DialogTitle>
      </DialogHeader>

      <Stepper step={step} />

      {step === 1 ? (
        <TooltipProvider delayDuration={150}>
          <div className="space-y-5">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <InstructionRow
                index={1}
                title="Colete Pixel e Token no Facebook"
                description="Localize e copie seu ID e Token de Integração."
                tip="Em business.facebook.com → Gerenciador de Eventos → seu Pixel → Configurações → Conversions API → Gerar token."
              />
              <InstructionRow
                index={2}
                title="Preencha o Nome, ID e Token"
                description="Preencha corretamente os campos abaixo."
                tip="O Nome é só pra você identificar internamente. ID e Token vêm direto do Meta."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite o Nome do Pixel" />
              </div>
              <div className="space-y-2">
                <Label>ID</Label>
                <Input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="Digite o ID do Pixel" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Token de Integração</Label>
              <Textarea
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Digite o Token de Integração do Pixel"
                rows={3}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>@{a.bot_username ?? "(sem username)"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-destructive">
                Se você gerar um novo token de integração no Facebook após configurar o pixel, o token atual será invalidado e a automação deixará de funcionar.
              </p>
            </div>
          </div>
        </TooltipProvider>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Opcional: informe um <strong>Test Event Code</strong> do Meta Events Manager para validar os disparos sem enviar para produção.
          </p>
          <div className="space-y-2">
            <Label>Test Event Code</Label>
            <Input value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} placeholder="TEST12345" />
          </div>
          <a
            href="https://business.facebook.com/events_manager"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            Abrir Events Manager <ExternalLink className="size-3" />
          </a>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Você pode pular este passo e configurar depois em <strong>Editar pixel</strong>.
          </div>
        </div>
      )}

      <DialogFooter className="gap-2">
        {step === 2 && (
          <Button variant="ghost" onClick={() => setStep(1)} disabled={create.isPending}>Voltar</Button>
        )}
        <Button variant="ghost" onClick={onDone} disabled={create.isPending}>Cancelar</Button>
        {step === 1 ? (
          <Button onClick={() => setStep(2)} disabled={!canNext}>Próximo</Button>
        ) : (
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Criando..." : "Criar pixel"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <StepDot n={1} active={step >= 1} done={step > 1} label="Configuração" />
      <div className={`h-px w-24 ${step > 1 ? "bg-primary" : "bg-border"}`} />
      <StepDot n={2} active={step >= 2} done={false} label="Evento Teste" />
    </div>
  );
}

function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`size-8 rounded-full flex items-center justify-center text-sm font-semibold border ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
      }`}>
        {done ? <Check className="size-4" /> : n}
      </div>
      <span className={`text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function InstructionRow({
  index, title, description, tip,
}: { index: number; title: string; description: string; tip: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-6 rounded-full bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">{title}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{tip}</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
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