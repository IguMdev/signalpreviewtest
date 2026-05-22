import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listPixels, createPixel, deletePixel, updatePixel,
  VERTICALS, EVENT_OPTIONS, TRACKING_MODES, MODE_PRESETS,
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
import { Code2, Plus, Trash2, Settings2, HelpCircle, AlertTriangle, ExternalLink, Check, Send, Globe, Bot } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trackeamento/pixels")({
  component: PixelsPage,
});

const VERTICAL_LABEL: Record<string, string> = {
  bet: "Apostas / Bet", igaming: "iGaming / Cassino",
  hot: "Nicho Hot / +18", promo: "Promoções e descontos", outro: "Outro",
};

const MODE_LABEL: Record<string, string> = {
  telegram: "Telegram",
  direct_response: "Direct Response",
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
                    <Badge variant="secondary">{MODE_LABEL[p.tracking_mode ?? "telegram"]}</Badge>
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
  const [trackingMode, setTrackingMode] = useState<"telegram" | "direct_response">("telegram");
  const [name, setName] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [vertical, setVertical] = useState<(typeof VERTICALS)[number]>("bet");
  const [accountId, setAccountId] = useState<string>("");
  const [salesPageUrl, setSalesPageUrl] = useState<string>("");

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      name, vertical,
      tracking_mode: trackingMode,
      account_id: trackingMode === "telegram" ? (accountId || null) : null,
      sales_page_url: trackingMode === "direct_response" ? (salesPageUrl || null) : null,
      is_active: true,
      event_on_join: "Lead", event_on_offer_click: "InitiateCheckout",
      event_on_register: "CompleteRegistration", event_on_deposit: "Purchase",
      event_on_view: "ViewContent", event_on_lead: "Lead",
      event_on_checkout: "InitiateCheckout", event_on_payment_info: "AddPaymentInfo",
      event_on_purchase: "Purchase",
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
            <div className="space-y-2">
              <Label>Modo de trackeamento</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(TRACKING_MODES as readonly ("telegram" | "direct_response")[]).map((m) => {
                  const preset = MODE_PRESETS[m];
                  const active = trackingMode === m;
                  const Icon = m === "telegram" ? Bot : Send;
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setTrackingMode(m)}
                      className={`text-left rounded-xl border p-3 transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/30"}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="size-4 text-primary" />
                        <p className="text-sm font-semibold">{preset.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                      <ul className="mt-2 space-y-0.5">
                        {preset.stages.map((s) => (
                          <li key={s.key} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span className="inline-block size-1 rounded-full bg-primary/60" />
                            <span>{s.label}</span>
                            <code className="ml-1 text-[10px] rounded bg-background border px-1">{s.defaultEvent}</code>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </div>

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
              {trackingMode === "telegram" ? (
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
              ) : (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Globe className="size-3.5" /> URL da página de vendas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input value={salesPageUrl} onChange={(e) => setSalesPageUrl(e.target.value)} placeholder="https://seusite.com/oferta" />
                </div>
              )}
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
        <TooltipProvider delayDuration={150}>
          <div className="space-y-5">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <InstructionRow
                index={1}
                title="Acesse o Gerenciador de Eventos"
                description="Localize o pixel que você deseja configurar."
                tip="business.facebook.com/events_manager → seu Pixel → aba Testar Eventos."
              />
              <InstructionRow
                index={2}
                title="Preencha o Código de Teste e envie"
                description='Copie o código da seção "Confirme os eventos do seu Servidor".'
                tip="O código começa com TEST e identifica esta sessão de teste."
              />
              <InstructionRow
                index={3}
                title="Aguarde e aceite os Eventos"
                description="Aceite os eventos para otimização de campanhas. Os eventos enviados serão:"
                tip="Após aceitar, o Meta passa a contar esses eventos para otimização de campanhas."
              />
              <ul className="pl-9 space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <code className="rounded bg-background border px-1.5 py-0.5 text-[11px]">enter_channel</code>
                  <span>: Disparado quando um usuário entra no canal.</span>
                </li>
                <li className="flex items-center gap-2">
                  <code className="rounded bg-background border px-1.5 py-0.5 text-[11px]">left_channel</code>
                  <span>: Disparado quando um usuário sai do canal.</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID do Pixel</Label>
                <Input value={metaPixelId} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-2">
                <Label>Código de Teste</Label>
                <Input value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} placeholder="Digite o Código de Teste" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Token de Integração</Label>
              <Textarea value={accessToken} readOnly rows={3} className="font-mono text-xs bg-muted/40 break-all" />
            </div>

            <a
              href="https://business.facebook.com/events_manager"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Abrir Events Manager <ExternalLink className="size-3" />
            </a>
          </div>
        </TooltipProvider>
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
            {create.isPending ? "Enviando..." : "Enviar Evento Teste"}
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
  const [trackingMode, setTrackingMode] = useState<"telegram" | "direct_response">(pixel.tracking_mode ?? "telegram");
  const [salesPageUrl, setSalesPageUrl] = useState<string>(pixel.sales_page_url ?? "");
  const [evJoin, setEvJoin] = useState<string>(pixel.event_on_join);
  const [evOffer, setEvOffer] = useState<string>(pixel.event_on_offer_click);
  const [evReg, setEvReg] = useState<string>(pixel.event_on_register);
  const [evDep, setEvDep] = useState<string>(pixel.event_on_deposit);
  const [evView, setEvView] = useState<string>(pixel.event_on_view ?? "ViewContent");
  const [evLead, setEvLead] = useState<string>(pixel.event_on_lead ?? "Lead");
  const [evCheckout, setEvCheckout] = useState<string>(pixel.event_on_checkout ?? "InitiateCheckout");
  const [evPayInfo, setEvPayInfo] = useState<string>(pixel.event_on_payment_info ?? "AddPaymentInfo");
  const [evPurchase, setEvPurchase] = useState<string>(pixel.event_on_purchase ?? "Purchase");
  const [metaPixelId, setMetaPixelId] = useState<string>(pixel.meta_pixel_id ?? "");
  const [accessToken, setAccessToken] = useState<string>(pixel.meta_access_token ?? "");
  const [testEventCode, setTestEventCode] = useState<string>(pixel.meta_test_event_code ?? "");

  const save = useMutation({
    mutationFn: () => updFn({ data: {
      id: pixel.id, name, vertical: vertical as never, is_active: isActive,
      tracking_mode: trackingMode,
      sales_page_url: trackingMode === "direct_response" ? (salesPageUrl || null) : null,
      event_on_join: evJoin as never, event_on_offer_click: evOffer as never,
      event_on_register: evReg as never, event_on_deposit: evDep as never,
      event_on_view: evView as never, event_on_lead: evLead as never,
      event_on_checkout: evCheckout as never, event_on_payment_info: evPayInfo as never,
      event_on_purchase: evPurchase as never,
      meta_pixel_id: metaPixelId || null,
      meta_access_token: accessToken || null,
      meta_test_event_code: testEventCode || null,
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
          <Label>Modo de trackeamento</Label>
          <Select value={trackingMode} onValueChange={(v) => setTrackingMode(v as never)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="telegram">{MODE_PRESETS.telegram.label}</SelectItem>
              <SelectItem value="direct_response">{MODE_PRESETS.direct_response.label}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{MODE_PRESETS[trackingMode].description}</p>
        </div>
        {trackingMode === "direct_response" && (
          <div className="space-y-2">
            <Label>URL da página de vendas</Label>
            <Input value={salesPageUrl} onChange={(e) => setSalesPageUrl(e.target.value)} placeholder="https://seusite.com/oferta" />
          </div>
        )}
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
          {trackingMode === "telegram" ? (
            <>
              <EventRow label="Entrada no bot" value={evJoin} onChange={setEvJoin} />
              <EventRow label="Clique na oferta" value={evOffer} onChange={setEvOffer} />
              <EventRow label="Cadastro" value={evReg} onChange={setEvReg} />
              <EventRow label="Depósito" value={evDep} onChange={setEvDep} />
            </>
          ) : (
            <>
              <EventRow label="Visualização da página" value={evView} onChange={setEvView} />
              <EventRow label="Lead qualificado" value={evLead} onChange={setEvLead} />
              <EventRow label="Iniciou checkout" value={evCheckout} onChange={setEvCheckout} />
              <EventRow label="Dados de pagamento" value={evPayInfo} onChange={setEvPayInfo} />
              <EventRow label="Compra confirmada" value={evPurchase} onChange={setEvPurchase} />
            </>
          )}
        </div>
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-semibold">Credenciais Meta (CAPI)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">ID do Pixel</Label>
              <Input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="123456789012345" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Test Event Code</Label>
              <Input value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} placeholder="TEST12345" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Token de Integração</Label>
            <Textarea value={accessToken} onChange={(e) => setAccessToken(e.target.value)} rows={2} className="font-mono text-xs" placeholder="EAAB..." />
          </div>
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