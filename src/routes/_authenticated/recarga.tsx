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
  Send, Target, Check, Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  listEngagementPlans, getMySubscriptions, listMyPaymentHistory,
  setSubscriptionTarget,
} from "@/lib/engagement.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/recarga")({
  component: RecargaPage,
});

// Central do Assinante da Kirvano — cliente faz login com o e-mail da compra
// e cancela sozinho. O webhook SUBSCRIPTION_CANCELED desativa o plano aqui.
const KIRVANO_CUSTOMER_PORTAL = "https://app.kirvano.com/purchases";

type SalaPlano = {
  id: string;
  nome: string;
  preco: number;
  descricao: string;
  destaque?: boolean;
  checkoutUrl?: string;
};

const salasPlanos: SalaPlano[] = [
  {
    id: "salas-1",
    nome: "Plano Básico",
    preco: 150,
    descricao: "🟡Plano Básico\n✅ Acesso a todas a ferramentas básicas\n✅ Inclui 1 crédito de sala.\n✅ Opera apenas 1 Bot Telegram. \n✅ Suporte 24/7.",
  },
  {
    id: "salas-3",
    nome: "Plano Premium",
    preco: 300,
    descricao: "🟣Plano Premium\n✅ Acesso a todas a ferramentas básicas\n✅ Inclui 3 crédito de sala.\n✅ Opera 3 Bots Telegram.\n✅ Suporte 24/7 Prioritário.",
    destaque: true,
  },
];

type TrackingPlano = {
  id: string;
  nome: string;
  preco?: number;
  precoLabel?: string;
  features: string[];
  destaque?: boolean;
  ctaLabel: string;
  checkoutUrl?: string;
};

const trackingPlanos: TrackingPlano[] = [
  {
    id: "track-starter",
    nome: "Plano Starter",
    preco: 297,
    features: [
      "2 pixels",
      "2 domínios",
      "6 funis",
      "1 Canal Telegram",
      "Implementação Plug & Play",
      "Suporte Especializado",
    ],
    ctaLabel: "Assinar agora",
  },
  {
    id: "track-pro",
    nome: "Plano Pro",
    preco: 397,
    features: [
      "4 pixels",
      "4 domínios",
      "12 funis",
      "3 Canais Telegram",
      "Implementação Plug & Play",
      "Suporte Especializado",
    ],
    destaque: true,
    ctaLabel: "Assinar agora",
  },
  {
    id: "track-custom",
    nome: "Plano Customizado",
    precoLabel: "Contatar time de vendas",
    features: [
      "Suporte Prioritário",
      "Onboarding Imediato",
      "Garantia 7 dias",
      "Implementação completa",
      "Atendimento Especializado",
    ],
    ctaLabel: "Time de vendas",
  },
];

type BotType = "inscritos" | "interacoes" | "boasvindas" | "encaminhador" | "followup";

const BOT_META: Record<BotType, { title: string; icon: any; tagline: string; quotaLabel: string }> = {
  inscritos:    { title: "BotInscritos",    icon: Users,         tagline: "Novos membros para o seu canal",         quotaLabel: "membros/mês" },
  interacoes:   { title: "BotInterações",   icon: Heart,         tagline: "Reações automáticas em cada sinal",      quotaLabel: "reações/sinal" },
  boasvindas:   { title: "BotBoasVindas",   icon: MessageCircle, tagline: "Mensagem automática para novos membros", quotaLabel: "" },
  encaminhador: { title: "BotEncaminhador", icon: Forward,       tagline: "Encaminha mensagens entre canais",       quotaLabel: "" },
  followup:     { title: "BotFollowUp",     icon: Repeat,        tagline: "Sequência de mensagens para leads do BoasVindas", quotaLabel: "" },
};

const BOT_ORDER: BotType[] = ["inscritos", "interacoes"];
const BOT_PAIR: BotType[] = ["boasvindas", "encaminhador", "followup"];

function RecargaPage() {
  const { user } = useAuth();
  const fetchPlans = useServerFn(listEngagementPlans);
  const fetchSubs = useServerFn(getMySubscriptions);
  const fetchHistory = useServerFn(listMyPaymentHistory);

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
    if (p.bot_type === "salas") salasUrlBySlug.set(p.slug, p.kirvano_checkout_url);
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
          Recarga
          <Badge variant="secondary" className="text-[11px] font-normal animate-pulse">
            Role para baixo para mais opções
          </Badge>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Assine planos de salas e bots de engajamento para impulsionar suas operações.
        </p>
      </div>

      {/* Salas de Sinais */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
            <DoorOpen className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Salas de Sinais</h2>
            <p className="text-xs text-muted-foreground">
              Cada plano libera créditos de sala — 1 crédito = 1 sala ativa.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2" data-tour="recharge-plans">
          {salasPlanosResolved.map((p) => (
            <Card key={p.id} className={p.destaque ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{p.nome}</span>
                  {p.destaque && (
                    <Badge className="text-[10px] gap-1">
                      <Crown className="size-3" /> Popular
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold">
                  R$ {p.preco.toFixed(2).replace(".", ",")}
                  <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground min-h-[32px] whitespace-pre-line">{p.descricao}</p>
                {p.checkoutUrl ? (
                  <Button asChild size="sm" className="w-full">
                    <a href={p.checkoutUrl} target="_blank" rel="noreferrer">
                      Adquirir agora
                      <ExternalLink className="size-3 ml-1" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    variant={p.destaque ? "default" : "outline"}
                    onClick={() => toast.info("Pagamento em breve disponível.")}
                  >
                    Adquirir agora
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trackeamento — Track4You */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
            <Target className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Trackeamento</h2>
            <p className="text-xs text-muted-foreground">
              Planos Track4You — pixels, domínios e funis para escalar suas campanhas.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {trackingPlanos.map((p) => (
            <Card key={p.id} className={p.destaque ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{p.nome}</span>
                  {p.destaque && (
                    <Badge className="text-[10px] gap-1">
                      <Crown className="size-3" /> Vantagem
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold">
                  {p.preco != null ? (
                    <>
                      R$ {p.preco.toFixed(2).replace(".", ",")}
                      <span className="text-xs font-normal text-muted-foreground"> / por mês</span>
                    </>
                  ) : (
                    <span className="text-lg">{p.precoLabel}</span>
                  )}
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-semibold text-primary">Channel Tracking</div>
                  <ul className="space-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="size-3 text-primary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {p.checkoutUrl ? (
                  <Button asChild size="sm" className="w-full">
                    <a href={p.checkoutUrl} target="_blank" rel="noreferrer">
                      {p.ctaLabel}
                      <ExternalLink className="size-3 ml-1" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    variant={p.destaque ? "default" : "outline"}
                    onClick={() => toast.info("Pagamento em breve disponível.")}
                  >
                    {p.ctaLabel}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Engagement bots */}
      <div className="space-y-8">
        {BOT_ORDER.map((bot) => {
          const meta = BOT_META[bot];
          const Icon = meta.icon;
          const plans = plansByBot.get(bot) ?? [];
          const sub = subByBot.get(bot);
          const activePlan = sub?.plan;
          const usagePct = activePlan?.monthly_quota
            ? Math.min(100, ((sub?.units_used ?? 0) / activePlan.monthly_quota) * 100)
            : 0;

          if (plans.length === 0) return null;

          return (
            <section key={bot} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{meta.title}</h2>
                    <p className="text-xs text-muted-foreground">{meta.tagline}</p>
                  </div>
                </div>
                {sub && (
                  <Badge variant={sub.status === "active" ? "default" : "secondary"} className="gap-1">
                    <Crown className="size-3" /> {sub.status}
                  </Badge>
                )}
              </div>

              {sub && activePlan && activePlan.monthly_quota > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>{activePlan.name}</span>
                      <span className="text-muted-foreground">
                        {(sub.units_used ?? 0).toLocaleString("pt-BR")} / {activePlan.monthly_quota.toLocaleString("pt-BR")} {meta.quotaLabel}
                      </span>
                    </div>
                    <Progress value={usagePct} />
                  </CardContent>
                </Card>
              )}

              {sub && bot === "inscritos" && !sub.target_link && (
                <ChooseChannelCard subscriptionId={sub.id} />
              )}
              {sub && bot === "inscritos" && sub.target_link && (
                <Card className="bg-muted/30">
                  <CardContent className="py-3 text-xs flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Entrega para:</span>
                    <a href={sub.target_link} target="_blank" rel="noreferrer" className="font-medium truncate text-primary">
                      {sub.target_link}
                    </a>
                  </CardContent>
                </Card>
              )}

              <div className={`grid gap-3 ${plans.length >= 3 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2"}`}>
                {plans.map((p: any) => {
                  const isCurrent = activePlan?.id === p.id;
                  return (
                    <Card key={p.id} className={isCurrent ? "border-primary" : ""}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>{p.name}</span>
                          {isCurrent && <Badge className="text-[10px]">Atual</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-2xl font-bold">
                          R$ {Number(p.price_brl).toFixed(2)}
                          <span className="text-xs font-normal text-muted-foreground">/mês</span>
                        </div>
                        <p className="text-xs text-muted-foreground min-h-[32px]">{p.description}</p>
                        {p.kirvano_checkout_url ? (
                          isCurrent ? (
                            <Button asChild size="sm" variant="outline" className="w-full">
                              <a href={KIRVANO_CUSTOMER_PORTAL} target="_blank" rel="noreferrer">
                                Gerenciar assinatura
                                <ExternalLink className="size-3 ml-1" />
                              </a>
                            </Button>
                          ) : (
                            <Button asChild size="sm" className="w-full">
                              <a
                                href={`${p.kirvano_checkout_url}${p.kirvano_checkout_url.includes("?") ? "&" : "?"}utm_content=${user?.id ?? ""}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Adquirir agora
                                <ExternalLink className="size-3 ml-1" />
                              </a>
                            </Button>
                          )
                        ) : (
                          <Button size="sm" className="w-full" disabled variant="secondary">
                            Em breve
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Boas-vindas + Encaminhador lado a lado */}
        <div className="grid gap-6 md:grid-cols-2">
          {BOT_PAIR.map((bot) => {
            const meta = BOT_META[bot];
            const Icon = meta.icon;
            const plans = plansByBot.get(bot) ?? [];
            const sub = subByBot.get(bot);
            const activePlan = sub?.plan;
            const usagePct = activePlan?.monthly_quota
              ? Math.min(100, ((sub?.units_used ?? 0) / activePlan.monthly_quota) * 100)
              : 0;

            if (plans.length === 0) return null;

            return (
              <section key={bot} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{meta.title}</h2>
                      <p className="text-xs text-muted-foreground">{meta.tagline}</p>
                    </div>
                  </div>
                  {sub && (
                    <Badge variant={sub.status === "active" ? "default" : "secondary"} className="gap-1">
                      <Crown className="size-3" /> {sub.status}
                    </Badge>
                  )}
                </div>

                {sub && activePlan && activePlan.monthly_quota > 0 && (
                  <Card className="bg-muted/30">
                    <CardContent className="py-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span>{activePlan.name}</span>
                        <span className="text-muted-foreground">
                          {(sub.units_used ?? 0).toLocaleString("pt-BR")} / {activePlan.monthly_quota.toLocaleString("pt-BR")} {meta.quotaLabel}
                        </span>
                      </div>
                      <Progress value={usagePct} />
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-3">
                  {plans.map((p: any) => {
                    const isCurrent = activePlan?.id === p.id;
                    return (
                      <Card key={p.id} className={isCurrent ? "border-primary" : ""}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span>{p.name}</span>
                            {isCurrent && <Badge className="text-[10px]">Atual</Badge>}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-2xl font-bold">
                            R$ {Number(p.price_brl).toFixed(2)}
                            <span className="text-xs font-normal text-muted-foreground">/mês</span>
                          </div>
                          <p className="text-xs text-muted-foreground min-h-[32px]">{p.description}</p>
                          {p.kirvano_checkout_url ? (
                            isCurrent ? (
                              <Button asChild size="sm" variant="outline" className="w-full">
                                <a href={KIRVANO_CUSTOMER_PORTAL} target="_blank" rel="noreferrer">
                                  Gerenciar assinatura
                                  <ExternalLink className="size-3 ml-1" />
                                </a>
                              </Button>
                            ) : (
                              <Button asChild size="sm" className="w-full">
                                <a
                                  href={`${p.kirvano_checkout_url}${p.kirvano_checkout_url.includes("?") ? "&" : "?"}utm_content=${user?.id ?? ""}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Adquirir agora
                                  <ExternalLink className="size-3 ml-1" />
                                </a>
                              </Button>
                            )
                          ) : (
                            <Button size="sm" className="w-full" disabled variant="secondary">
                              Em breve
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

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
