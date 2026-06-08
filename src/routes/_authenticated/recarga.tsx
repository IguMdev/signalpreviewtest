import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DoorOpen, Sparkles, ExternalLink, Crown,
  Users, Heart, MessageCircle, Forward, Repeat,
  History, CheckCircle2, Clock, XCircle, AlertCircle,
  Send, Target, Check, Lock, Code, Database
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listEngagementPlans, getMySubscriptions, listMyPaymentHistory,
  listMyEngagementOrders, setSubscriptionTarget, listEngagementAudit,
} from "@/lib/engagement.functions";
import { generateWivenCheckout } from "@/lib/checkout.functions";
import { useAuth } from "@/lib/auth-context";

import { CustomCheckoutModal } from "@/components/payment/CustomCheckoutModal";

export const Route = createFileRoute("/_authenticated/recarga")({
  component: RecargaPage,
});

// Central do Assinante da Kirvano — cliente faz login com o e-mail da compra
// e cancela sozinho. O webhook SUBSCRIPTION_CANCELED desativa o plano aqui.
const WIVEN_CUSTOMER_PORTAL = "https://app.wiven.com.br/purchases";

type SalaPlano = {
  id: string;
  nome: string;
  preco: number;
  features?: string[];
  destaque?: boolean;
  checkoutUrl?: string;
  badge?: string;
};

const salasPlanos: SalaPlano[] = [
  {
    id: "salas-1",
    nome: "Base",
    preco: 190,
    features: [
      "Dashboard",
      "1 Conta Telegram",
      "1 Sala",
      "Agendamentos",
    ],
  },
  {
    id: "salas-3",
    nome: "Premium",
    preco: 480,
    features: [
      "Tudo do Base mais:",
      "3 Contas Telegram",
      "3 Salas",
      "Conta e Emojis Premium",
      "Vídeos",
      "Áudios",
      "Trackeamento",
    ],
    destaque: true,
    badge: "MAIS POPULAR",
  },
  {
    id: "salas-unlimited",
    nome: "Unlimited",
    preco: 650,
    features: [
      "Tudo do Premium mais:",
      "BotBoasVindas",
      "BotEncaminhador",
      "BotFollowUp",
      "Integrações"
    ],
  },
];

// Tracking planos removed as they are integrated into main plans

type BotType = "inscritos" | "interacoes" | "boasvindas" | "encaminhador" | "followup";

const BOT_META: Record<BotType, { title: string; icon: any; tagline: string; quotaLabel: string }> = {
  inscritos:    { title: "BotInscritos",    icon: Users,         tagline: "Novos membros para o seu canal",         quotaLabel: "membros/mês" },
  interacoes:   { title: "BotInterações",   icon: Heart,         tagline: "Reações automáticas em cada sinal",      quotaLabel: "reações/sinal" },
  boasvindas:   { title: "BotBoasVindas",   icon: MessageCircle, tagline: "Mensagem automática para novos membros", quotaLabel: "" },
  encaminhador: { title: "BotEncaminhador", icon: Forward,       tagline: "Encaminha mensagens entre canais",       quotaLabel: "" },
  followup:     { title: "BotFollowUp",     icon: Repeat,        tagline: "Sequência de mensagens para leads do BoasVindas", quotaLabel: "" },
};

const BOT_ORDER: BotType[] = [];
const BOT_PAIR: BotType[] = ["boasvindas", "encaminhador", "followup"];

function RecargaPage() {
  const { user } = useAuth();
  const generateUrl = useServerFn(generateWivenCheckout);
  const fetchPlans = useServerFn(listEngagementPlans);
  const fetchSubs = useServerFn(getMySubscriptions);
  const fetchHistory = useServerFn(listMyPaymentHistory);
  const fetchOrders = useServerFn(listMyEngagementOrders);
  const fetchAudit = useServerFn(listEngagementAudit);

  const [billingCycle, setBillingCycle] = useState<"mensal" | "trimestral" | "anual">("mensal");

  const plansQ = useQuery({ queryKey: ["engagement-plans"], queryFn: () => fetchPlans() });
  const subsQ = useQuery({
    queryKey: ["engagement-subs", user?.id],
    queryFn: () => fetchSubs(),
    enabled: !!user,
  });
  const historyQ = useQuery({
    queryKey: ["payment-history", user?.id],
    queryFn: () => fetchHistory(),
    enabled: !!user,
  });
  const ordersQ = useQuery({
    queryKey: ["smm-orders", user?.id],
    queryFn: () => fetchOrders(),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const auditQ = useQuery({
    queryKey: ["smm-audit", user?.id],
    queryFn: () => fetchAudit(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const subs = (subsQ.data ?? []) as any[];
  const subByBot = new Map<BotType, any>();
  for (const s of subs) {
    const bt = s.plan?.bot_type as BotType | undefined;
    if (bt && !subByBot.has(bt)) subByBot.set(bt, s);
  }

  const plansByBot = new Map<BotType, any[]>();
  for (const p of (plansQ.data ?? []) as any[]) {
    const bt = p.bot_type as BotType;
    if (!plansByBot.has(bt)) plansByBot.set(bt, []);
    plansByBot.get(bt)!.push(p);
  }

  // Map de URLs de checkout das salas (vindas do banco) por slug
  const salasUrlBySlug = new Map<string, string | null>();
  for (const p of (plansQ.data ?? []) as any[]) {
    if (p.bot_type === "salas") salasUrlBySlug.set(p.slug, p.wiven_checkout_url);
  }
  const salasPlanosResolved = salasPlanos.map((p) => ({
    ...p,
    checkoutUrl: salasUrlBySlug.get(p.id) ?? p.checkoutUrl,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
          <Sparkles className="size-6 text-primary" />
          Assinatura
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Assine o plano que melhor impulsiona sua operação.
        </p>
      </div>

      {/* Salas de Sinais - Premium Pricing Grid */}
      <section className="pb-12 border-b border-white/5 pt-8">
        {/* Toggles */}
        <div className="flex justify-center mb-16 relative z-20">
          <div className="relative flex items-center p-1.5 bg-[#090a0f] rounded-[32px] border border-white/5 shadow-inner w-full max-w-[460px]">
            {/* Sliding Pill */}
            <div 
              className="absolute inset-y-1.5 bg-gradient-to-r from-[#202434] to-[#1b1e2a] border border-white/10 rounded-[28px] transition-all duration-500 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] ease-out"
              style={{
                width: 'calc(33.333% - 4px)',
                left: '6px',
                transform: `translateX(${billingCycle === "mensal" ? "0" : billingCycle === "trimestral" ? "100%" : "200%"})`
              }}
            />

            <button 
              onClick={() => setBillingCycle("mensal")}
              className={`relative z-10 flex-1 py-3 text-sm font-semibold transition-colors duration-500 ${billingCycle === "mensal" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Mensal
            </button>

            <button 
              onClick={() => setBillingCycle("trimestral")}
              className={`relative z-10 flex-1 py-3 text-sm font-semibold transition-colors duration-500 flex items-center justify-center gap-1.5 ${billingCycle === "trimestral" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Trimestral
              <span className={`transition-all duration-500 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${billingCycle === "trimestral" ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-gray-400 border border-white/5"}`}>-10%</span>
            </button>

            <button 
              onClick={() => setBillingCycle("anual")}
              className={`relative z-10 flex-1 py-3 text-sm font-semibold transition-colors duration-500 flex items-center justify-center gap-1.5 ${billingCycle === "anual" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Anual
              <span className={`transition-all duration-500 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${billingCycle === "anual" ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-gray-400 border border-white/5"}`}>-20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto items-stretch">
          {salasPlanosResolved.map((p) => {
            const isBase = p.id === "salas-1";
            const isPremium = p.id === "salas-3";
            const isUnlimited = p.id === "salas-unlimited";

            const multiplier = billingCycle === "mensal" ? 1 : billingCycle === "trimestral" ? 3 : 12;
            const discount = billingCycle === "mensal" ? 1 : billingCycle === "trimestral" ? 0.9 : 0.8;
            const finalPrice = p.preco * multiplier * discount;
            const oldPrice = p.preco * multiplier;
            const equivalentMonthly = finalPrice / multiplier;

            let cardBg = "";
            let textColor = "";
            let mutedColor = "";
            let borderColor = "";
            let btnClass = "";
            let dividerClass = "";
            
            if (isBase) {
              cardBg = "bg-gradient-to-b from-[#181a25] to-[#10121a] hover:from-[#1c1e2b] hover:to-[#12141c]";
              textColor = "text-white";
              mutedColor = "text-gray-400";
              borderColor = "border-transparent ring-1 ring-white/5 hover:ring-white/10";
              btnClass = "bg-white/5 text-white hover:bg-white/10 border border-white/5 transition-all group-hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]";
              dividerClass = "border-white/5";
            } else if (isPremium) {
              cardBg = "bg-gradient-to-b from-[#1e1518] to-[#0f0a0d] hover:from-[#261a1e] hover:to-[#140e11]";
              textColor = "text-white";
              mutedColor = "text-gray-300";
              borderColor = "border-transparent ring-1 ring-primary/40 shadow-[0_0_50px_-15px_rgba(var(--primary),0.2)] group-hover:shadow-[0_0_80px_-15px_rgba(var(--primary),0.4)] group-hover:ring-primary/60 md:-translate-y-4 z-20";
              btnClass = "bg-primary text-primary-foreground hover:opacity-90 shadow-[0_0_20px_rgba(var(--primary),0.4)] transition-all";
              dividerClass = "border-white/5";
            } else {
              cardBg = "bg-gradient-to-b from-[#14151f] to-[#0a0b0f] hover:from-[#181a26] hover:to-[#0c0d12]";
              textColor = "text-white";
              mutedColor = "text-gray-400";
              borderColor = "border-transparent ring-1 ring-white/5 hover:ring-white/10";
              btnClass = "bg-white text-black hover:bg-gray-200 border border-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all";
              dividerClass = "border-white/5";
            }

            return (
              <div
                key={p.id}
                className={`group rounded-[32px] p-8 flex flex-col relative overflow-hidden transition-all duration-700 ease-out border ${cardBg} ${textColor} ${borderColor} hover:-translate-y-2`}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                {p.badge && (
                  <div className="absolute top-6 right-6 rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5 text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(var(--primary),0.2)] group-hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all duration-500 backdrop-blur-sm">
                    <Sparkles className="size-3 animate-pulse" /> {p.badge}
                  </div>
                )}
                
                <div className="space-y-3 mb-6 pt-2">
                   <div className="mb-4 text-current opacity-70">
                      <Database className="size-6" />
                   </div>
                   <h3 className="text-3xl font-bold tracking-tight">{p.nome}</h3>
                   <p className={`text-sm ${mutedColor} leading-relaxed pr-4 min-h-[40px]`}>
                      Para quem quer otimizar suas operações de sinal.
                   </p>
                </div>

                <div className="mb-8 flex flex-col flex-1">
                   <div className="min-h-[80px]">
                     {billingCycle !== "mensal" ? (
                       <div className={`text-sm line-through opacity-50 mb-1 font-semibold`}>
                         R$ {oldPrice.toFixed(0)}
                       </div>
                     ) : (
                       <div className="h-5 mb-1" />
                     )}
                     
                     <div className="flex items-end gap-1 font-sans">
                     <span className={`text-5xl font-black ${textColor}`}>R$ {finalPrice.toFixed(0)}</span>
                     {billingCycle === "mensal" && (
                       <span className={`text-base font-medium ${mutedColor} mb-1.5`}>/mês</span>
                     )}
                     {billingCycle === "trimestral" && (
                       <span className={`text-base font-medium ${mutedColor} mb-1.5`}>/trimestre</span>
                     )}
                     {billingCycle === "anual" && (
                       <span className={`text-base font-medium ${mutedColor} mb-1.5`}>/ano</span>
                     )}
                   </div>

                     {billingCycle !== "mensal" ? (
                       <div className={`inline-flex mt-3 items-center px-3 py-1.5 rounded-full text-xs font-semibold ${isUnlimited ? "bg-white/10 text-white" : "bg-primary/10 text-primary"}`}>
                         <div className={`w-1.5 h-1.5 rounded-full mr-2 ${isUnlimited ? "bg-white" : "bg-primary"}`} />
                         cobrança {billingCycle} • equivale R${equivalentMonthly.toFixed(0)}/mês
                       </div>
                     ) : (
                        <div className="h-8 mt-3" />
                     )}
                   </div>

                   <div className="mt-8 mb-6">
                     {(() => {
                        const planNameExt = p.nome + (billingCycle === "trimestral" ? " (Trimestral)" : billingCycle === "anual" ? " (Anual)" : "");
                        const planIdExt = p.id + (billingCycle === "trimestral" ? "-trimestral" : billingCycle === "anual" ? "-anual" : "");

                        return p.checkoutUrl ? (
                          <Button 
                            asChild 
                            className={`w-full py-6 text-base font-bold rounded-full transition-all ${btnClass}`}
                          >
                            <a href={p.checkoutUrl} target="_blank" rel="noreferrer">
                              Comece agora
                            </a>
                          </Button>
                        ) : (
                          <CheckoutButton
                            planId={planIdExt}
                            customPrice={finalPrice}
                            customName={planNameExt}
                            customDescription={p.features?.join("\\n") || ""}
                            generateUrl={generateUrl}
                            className={`w-full py-6 text-base font-bold rounded-full transition-all ${btnClass}`}
                            label="Comece agora"
                            isSubscription={true}
                            billingCycle={billingCycle}
                          />
                        );
                     })()}
                   </div>
                   
                   <div className={`pt-6 border-t ${dividerClass} flex-1`}>
                     <h4 className={`text-sm italic mb-4 font-serif ${mutedColor}`}>Features</h4>
                     <ul className="space-y-4">
                        {p.features?.map((feature: string, idx: number) => (
                          <li key={idx} className={`flex items-start gap-3 text-sm pb-4 ${idx !== p.features!.length - 1 ? `border-b ${dividerClass}` : ''}`}>
                            <Code className={`size-4 mt-0.5 shrink-0 opacity-50 text-primary`} />
                            <span className={`text-gray-300 leading-snug`}>{feature}</span>
                          </li>
                        ))}
                     </ul>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trackeamento integrated into main plans */}

      {/* Engagement bots removidos pois estão integrados aos planos principais */}

      {/* 
      <EngagementOrdersSection
        rows={(ordersQ.data ?? []) as any[]}
        isLoading={ordersQ.isLoading}
      />

      <EngagementAuditSection
        rows={(auditQ.data ?? []) as any[]}
        isLoading={auditQ.isLoading}
      />
      */}


      {/* Payment History */}
      <PaymentHistorySection
        rows={(historyQ.data ?? []) as any[]}
        isLoading={historyQ.isLoading}
      />
    </div>
  );
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  active:   { label: "Pagamento aprovado", variant: "default",     icon: CheckCircle2 },
  pending:  { label: "Aguardando pagamento", variant: "secondary", icon: Clock },
  canceled: { label: "Cancelado",            variant: "outline",   icon: XCircle },
  refunded: { label: "Reembolsado",          variant: "outline",   icon: XCircle },
  failed:   { label: "Pagamento recusado",   variant: "destructive", icon: AlertCircle },
  expired:  { label: "Expirado",             variant: "outline",   icon: XCircle },
};

const ORDER_STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Aguardando painel", variant: "secondary", icon: Clock },
  in_progress: { label: "Em processamento", variant: "default", icon: Clock },
  completed: { label: "Concluído", variant: "default", icon: CheckCircle2 },
  partial: { label: "Parcial", variant: "outline", icon: AlertCircle },
  canceled: { label: "Cancelado", variant: "outline", icon: XCircle },
  failed: { label: "Falhou", variant: "destructive", icon: AlertCircle },
};

function EngagementOrdersSection({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
          <Send className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Entregas automáticas</h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe pedidos enviados ao painel de inscritos e interações.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhuma entrega automática registrada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const meta = ORDER_STATUS_META[r.status] ?? { label: r.status, variant: "outline" as const, icon: AlertCircle };
                  const Icon = meta.icon;
                  const date = r.created_at ? new Date(r.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }) : "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{date}</TableCell>
                      <TableCell className="text-sm">{r.type === "members" ? "Inscritos" : "Interações"}</TableCell>
                      <TableCell className="text-xs max-w-[220px] truncate">
                        <a href={r.target} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {r.target}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{Number(r.quantity ?? 0).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="gap-1">
                          <Icon className="size-3" />
                          {meta.label}
                        </Badge>
                        {r.smm_order_id && (
                          <div className="text-[11px] text-muted-foreground mt-1">Pedido #{r.smm_order_id}</div>
                        )}
                        {r.error && (
                          <div className="text-[11px] text-destructive mt-1 max-w-[220px] truncate">{r.error}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ChooseChannelCard({ subscriptionId }: { subscriptionId: string }) {
  const setTarget = useServerFn(setSubscriptionTarget);
  const qc = useQueryClient();
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const trimmed = link.trim();
    // Validação básica no cliente — o servidor faz a normalização final
    const looksLikeTg =
      /^@?[a-zA-Z0-9_]{4,64}$/.test(trimmed) ||
      /^(https?:\/\/)?(t\.me|telegram\.me)\//i.test(trimmed);
    if (!looksLikeTg) {
      toast.error("Cole um link público do Telegram, ex: https://t.me/seucanal ou @seucanal");
      return;
    }
    if (/joinchat|t\.me\/\+/i.test(trimmed)) {
      toast.error("Convites privados (joinchat / +hash) não funcionam — use um @username público.");
      return;
    }
    setLoading(true);
    try {
      await setTarget({ data: { subscriptionId, targetLink: trimmed } });
      toast.success("Pedido despachado para o painel!");
      qc.invalidateQueries({ queryKey: ["engagement-subs"] });
      qc.invalidateQueries({ queryKey: ["smm-orders"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao despachar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="py-3 space-y-2">
        <div className="text-xs font-medium">Escolha o canal/grupo para receber os inscritos</div>
        <p className="text-[11px] text-muted-foreground">
          Cole o link público (ex: <code>https://t.me/seucanal</code>, <code>t.me/seucanal</code> ou <code>@seucanal</code>). A entrega é automática e única.
          Convites privados (joinchat / +hash) não são aceitos.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="https://t.me/seucanal ou @seucanal"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={loading}
          />
          <Button size="sm" onClick={submit} disabled={loading || !link}>
            <Send className="size-3 mr-1" />
            {loading ? "Enviando…" : "Entregar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function PaymentHistorySection({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return _PaymentHistorySectionImpl({ rows, isLoading });
}

function EngagementAuditSection({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-md bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="size-5 text-destructive" />
        </div>
        <div>
          <h2 className="font-semibold">Auditoria de entregas</h2>
          <p className="text-xs text-muted-foreground">
            Pedidos onde o painel diz “Concluído” mas a contagem real no Telegram está abaixo do esperado.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Auditando…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Nenhuma divergência detectada — todas as entregas estão batendo com o Telegram.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Inicial</TableHead>
                  <TableHead>Atual</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Faltando</TableHead>
                  <TableHead>Status painel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">#{r.smm_order_id ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate">
                      <a href={r.target} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {r.target}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">{r.start_count?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{r.current_count?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.expected_count?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                    <TableCell className="text-sm font-semibold text-destructive">
                      -{Number(r.missing ?? 0).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <AlertCircle className="size-3" />
                        {r.panel_status ?? r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function _PaymentHistorySectionImpl({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
          <History className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Histórico de pagamentos</h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe o status dos seus pagamentos e assinaturas.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhum pagamento registrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status] ?? { label: r.status, variant: "outline" as const, icon: AlertCircle };
                  const Icon = meta.icon;
                  const date = r.created_at ? new Date(r.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }) : "—";
                  const price = r.plan?.price_brl != null
                    ? `R$ ${Number(r.plan.price_brl).toFixed(2).replace(".", ",")}`
                    : "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{date}</TableCell>
                      <TableCell className="text-sm">{r.plan?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{price}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="gap-1">
                          <Icon className="size-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function CheckoutButton({ 
  planId, 
  customPrice, 
  customName, 
  customDescription,
  generateUrl,
  className,
  label,
  isSubscription,
  billingCycle
}: { 
  planId: string, 
  customPrice?: number, 
  customName?: string, 
  customDescription?: string,
  generateUrl: any,
  className?: string,
  label?: string,
  isSubscription?: boolean,
  billingCycle?: string
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button size="sm" className={className || "w-full"} onClick={() => setModalOpen(true)}>
        {label || "Adquirir agora"}
      </Button>

      <CustomCheckoutModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        planId={planId}
        customPrice={customPrice}
        customName={customName}
        customDescription={customDescription}
        isSubscription={isSubscription}
        billingCycle={billingCycle}
      />
    </>
  );
}
