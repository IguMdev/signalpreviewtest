import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wallet, DoorOpen, Sparkles, ExternalLink, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recarga")({
  component: RecargaPage,
});

type Plano = {
  id: string;
  nome: string;
  preco: number;
  descricao: string;
  destaque?: boolean;
  checkoutUrl?: string;
};

const salasPlanos: Plano[] = [
  { id: "salas-1", nome: "Plano Básico", preco: 150, descricao: "Acesso a 1 sala de sinais. Ideal para iniciantes." },
  { id: "salas-3", nome: "Plano Premium", preco: 300, descricao: "Acesso a 3 salas de sinais. Tudo incluso.", destaque: true },
];

const creditosPlanos: Plano[] = [
  { id: "cred-500",  nome: "Inicial",      preco: 49.9,  descricao: "500 créditos para envios." },
  { id: "cred-2000", nome: "Profissional", preco: 149.9, descricao: "2.000 créditos com prioridade.", destaque: true },
  { id: "cred-5000", nome: "Premium",      preco: 299.9, descricao: "5.000 créditos + suporte VIP." },
];

const SECTIONS = [
  {
    key: "salas",
    title: "Salas de Sinais",
    tagline: "Assine para liberar acesso às salas exclusivas.",
    icon: DoorOpen,
    plans: salasPlanos,
    suffix: "/mês",
  },
  {
    key: "creditos",
    title: "Créditos",
    tagline: "Recarregue seu saldo para enviar sinais.",
    icon: Wallet,
    plans: creditosPlanos,
    suffix: "",
  },
] as const;

function RecargaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-6 text-primary" />
          Recarga de Créditos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha um plano para liberar salas e continuar enviando sinais.
        </p>
      </div>

      <div className="space-y-8">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <Icon className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">{section.title}</h2>
                  <p className="text-xs text-muted-foreground">{section.tagline}</p>
                </div>
              </div>

              <div className={`grid gap-3 ${section.plans.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}>
                {section.plans.map((p) => (
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
                        {section.suffix && (
                          <span className="text-xs font-normal text-muted-foreground">{section.suffix}</span>
                        )}
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
          );
        })}
      </div>
    </div>
  );
}