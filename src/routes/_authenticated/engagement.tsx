import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEngagementPlans, getMySubscriptions, listMyEngagementOrders } from "@/lib/engagement.functions";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Heart, Users, ExternalLink, Crown, MessageCircle, Forward } from "lucide-react";

export const Route = createFileRoute("/_authenticated/engagement")({
  component: EngagementPage,
});

type BotType = "inscritos" | "interacoes" | "boasvindas" | "encaminhador";

const BOT_META: Record<BotType, { title: string; icon: any; tagline: string; quotaLabel: string }> = {
  inscritos:    { title: "BotInscritos",    icon: Users,         tagline: "Novos membros para o seu canal",        quotaLabel: "membros/mês" },
  interacoes:   { title: "BotInterações",   icon: Heart,         tagline: "Reações automáticas em cada sinal",     quotaLabel: "reações/sinal" },
  boasvindas:   { title: "BotBoasVindas",   icon: MessageCircle, tagline: "Mensagem automática para novos membros", quotaLabel: "" },
  encaminhador: { title: "BotEncaminhador", icon: Forward,       tagline: "Encaminha mensagens entre canais",       quotaLabel: "" },
};

const BOT_ORDER: BotType[] = ["inscritos", "interacoes", "boasvindas", "encaminhador"];

function EngagementPage() {
  const { user } = useAuth();
  const fetchPlans = useServerFn(listEngagementPlans);
  const fetchSubs = useServerFn(getMySubscriptions);
  const fetchOrders = useServerFn(listMyEngagementOrders);

  const plansQ = useQuery({ queryKey: ["engagement-plans"], queryFn: () => fetchPlans() });
  const subsQ = useQuery({ queryKey: ["engagement-subs", user?.id], queryFn: () => fetchSubs(), enabled: !!user });
  const ordersQ = useQuery({ queryKey: ["engagement-orders", user?.id], queryFn: () => fetchOrders(), enabled: !!user });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-6 text-primary" />
          Conheça nossos planos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha um plano para cada bot e impulsione seus canais.
        </p>
      </div>

      {/* One section per bot type */}
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
      </div>

      {/* Recent orders */}
      {ordersQ.data && ordersQ.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {ordersQ.data.slice(0, 10).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between border-b border-border last:border-0 pb-2">
                  <div className="flex items-center gap-2">
                    {o.type === "reaction" ? <Heart className="size-4" /> : <Users className="size-4" />}
                    <span>{o.quantity.toLocaleString("pt-BR")} {o.type === "reaction" ? "reações" : "membros"}</span>
                    <span className="text-muted-foreground text-xs truncate max-w-[260px]">{o.target}</span>
                  </div>
                  <Badge variant={o.status === "completed" ? "default" : o.status === "failed" ? "destructive" : "secondary"}>
                    {o.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}