import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEngagementPlans, getMySubscription, listMyEngagementOrders } from "@/lib/engagement.functions";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Heart, Users, ExternalLink, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/engagement")({
  component: EngagementPage,
});

function EngagementPage() {
  const { user } = useAuth();
  const fetchPlans = useServerFn(listEngagementPlans);
  const fetchSub = useServerFn(getMySubscription);
  const fetchOrders = useServerFn(listMyEngagementOrders);

  const plansQ = useQuery({ queryKey: ["engagement-plans"], queryFn: () => fetchPlans() });
  const subQ = useQuery({ queryKey: ["engagement-sub", user?.id], queryFn: () => fetchSub(), enabled: !!user });
  const ordersQ = useQuery({ queryKey: ["engagement-orders", user?.id], queryFn: () => fetchOrders(), enabled: !!user });

  const sub = subQ.data as any;
  const plan = sub?.plan;

  const reactPct = plan?.monthly_reactions_quota
    ? Math.min(100, ((sub?.reactions_used ?? 0) / plan.monthly_reactions_quota) * 100)
    : 0;
  const memberPct = plan?.monthly_members_quota
    ? Math.min(100, ((sub?.members_used ?? 0) / plan.monthly_members_quota) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-6 text-primary" />
          Engajamento Bot
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Reações e membros bot para impulsionar seus canais de sinais.
        </p>
      </div>

      {/* Current subscription */}
      {sub && plan ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="size-5 text-primary" />
                Plano {plan.name} ativo
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Renova em {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
            <Badge variant={sub.status === "active" ? "default" : "secondary"}>{sub.status}</Badge>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-2"><Heart className="size-4" /> Reações</span>
                <span className="text-muted-foreground">{sub.reactions_used} / {plan.monthly_reactions_quota}</span>
              </div>
              <Progress value={reactPct} />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-2"><Users className="size-4" /> Membros</span>
                <span className="text-muted-foreground">{sub.members_used} / {plan.monthly_members_quota}</span>
              </div>
              <Progress value={memberPct} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Você ainda não tem uma assinatura ativa. Escolha um plano abaixo.
          </CardContent>
        </Card>
      )}

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {plansQ.data?.map((p: any) => {
          const isCurrent = plan?.id === p.id;
          return (
            <Card key={p.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  {isCurrent && <Badge>Atual</Badge>}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  R$ {Number(p.price_brl).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>
                <ul className="text-sm space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Heart className="size-4 text-primary" />
                    {p.monthly_reactions_quota.toLocaleString("pt-BR")} reações/mês
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    {p.monthly_members_quota.toLocaleString("pt-BR")} membros/mês
                  </li>
                </ul>
                {p.kirvano_checkout_url ? (
                  <Button
                    asChild
                    className="w-full"
                    disabled={isCurrent}
                  >
                    <a
                      href={`${p.kirvano_checkout_url}${p.kirvano_checkout_url.includes("?") ? "&" : "?"}utm_content=${user?.id ?? ""}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {isCurrent ? "Plano atual" : "Assinar"}
                      <ExternalLink className="size-4 ml-1" />
                    </a>
                  </Button>
                ) : (
                  <Button className="w-full" disabled variant="secondary">
                    Em breve
                  </Button>
                )}
              </CardContent>
            </Card>
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