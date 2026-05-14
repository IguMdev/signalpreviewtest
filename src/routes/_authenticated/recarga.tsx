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
  Users, Heart, MessageCircle, Forward,
  History, CheckCircle2, Clock, XCircle, AlertCircle,
  Send,
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
    descricao: "Inclui 1 crédito de sala — você pode operar 1 sala de sinais.",
  },
  {
    id: "salas-3",
    nome: "Plano Premium",
    preco: 300,
    descricao: "Inclui 3 créditos de sala — opere até 3 salas simultaneamente.",
    destaque: true,
  },
];

type BotType = "inscritos" | "interacoes" | "boasvindas" | "encaminhador";

const BOT_META: Record<BotType, { title: string; icon: any; tagline: string; quotaLabel: string }> = {
  inscritos:    { title: "BotInscritos",    icon: Users,         tagline: "Novos membros para o seu canal",         quotaLabel: "membros/mês" },
  interacoes:   { title: "BotInterações",   icon: Heart,         tagline: "Reações automáticas em cada sinal",      quotaLabel: "reações/sinal" },
  boasvindas:   { title: "BotBoasVindas",   icon: MessageCircle, tagline: "Mensagem automática para novos membros", quotaLabel: "" },
  encaminhador: { title: "BotEncaminhador", icon: Forward,       tagline: "Encaminha mensagens entre canais",       quotaLabel: "" },
};

const BOT_ORDER: BotType[] = ["inscritos", "interacoes"];
const BOT_PAIR: BotType[] = ["boasvindas", "encaminhador"];

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

        <div className="grid gap-3 md:grid-cols-2">
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
                <p className="text-xs text-muted-foreground min-h-[32px]">{p.descricao}</p>
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
                          <Button asChild size="sm" className="w-full" disabled={isCurrent}>
                            <a
                              href={`${p.kirvano_checkout_url}${p.kirvano_checkout_url.includes("?") ? "&" : "?"}utm_content=${user?.id ?? ""}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {isCurrent ? "Plano atual" : "Adquirir agora"}
                              <ExternalLink className="size-3 ml-1" />
                            </a>
                          </Button>
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
                            <Button asChild size="sm" className="w-full" disabled={isCurrent}>
                              <a
                                href={`${p.kirvano_checkout_url}${p.kirvano_checkout_url.includes("?") ? "&" : "?"}utm_content=${user?.id ?? ""}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {isCurrent ? "Plano atual" : "Adquirir agora"}
                                <ExternalLink className="size-3 ml-1" />
                              </a>
                            </Button>
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

const SMM_STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending:     { label: "Pendente",    variant: "secondary",   icon: Clock },
  in_progress: { label: "Em andamento", variant: "default",    icon: Loader2 },
  completed:   { label: "Concluído",    variant: "default",    icon: CheckCircle2 },
  partial:     { label: "Parcial",      variant: "outline",    icon: AlertCircle },
  canceled:    { label: "Cancelado",    variant: "outline",    icon: XCircle },
  failed:      { label: "Falhou",       variant: "destructive", icon: XCircle },
};

function SmmOrdersSection({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  const retryFn = useServerFn(retryEngagementOrder);
  const qc = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function retry(id: string) {
    setRetryingId(id);
    try {
      await retryFn({ data: { orderId: id } });
      toast.success("Pedido re-enviado para o painel!");
      qc.invalidateQueries({ queryKey: ["smm-orders"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao re-tentar");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
          <Activity className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Pedidos do painel SMM</h2>
          <p className="text-xs text-muted-foreground">
            Status dos pedidos de inscritos e reações enviados ao painel. Atualiza automaticamente.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhum pedido enviado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const meta = SMM_STATUS_META[r.status] ?? { label: r.status, variant: "outline" as const, icon: AlertCircle };
                  const Icon = meta.icon;
                  const date = r.created_at ? new Date(r.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  }) : "—";
                  const typeLabel = r.type === "reaction" ? "Reações" : "Inscritos";
                  const isRetrying = retryingId === r.id;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{date}</TableCell>
                      <TableCell className="text-sm">{typeLabel}</TableCell>
                      <TableCell className="text-xs max-w-[240px] truncate">
                        <a href={r.target} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {r.target}
                        </a>
                        {r.error && (
                          <div className="text-[10px] text-destructive truncate" title={r.error}>
                            {r.error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.quantity}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="gap-1">
                          <Icon className={`size-3 ${r.status === "in_progress" ? "animate-spin" : ""}`} />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retry(r.id)}
                            disabled={isRetrying}
                          >
                            {isRetrying ? (
                              <Loader2 className="size-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3 mr-1" />
                            )}
                            Re-tentar
                          </Button>
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
