import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wallet, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recarga")({
  component: RecargaPage,
});

const planos = [
  { nome: "Inicial", creditos: 500, preco: "R$ 49,90", destaque: false },
  { nome: "Profissional", creditos: 2000, preco: "R$ 149,90", destaque: true },
  { nome: "Premium", creditos: 5000, preco: "R$ 299,90", destaque: false },
];

function RecargaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recarga de créditos</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um plano para continuar enviando sinais sem interrupção.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planos.map((p) => (
          <div
            key={p.nome}
            className={`rounded-2xl border p-6 space-y-4 ${
              p.destaque
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{p.nome}</h3>
              {p.destaque && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Popular
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <Wallet className="size-5 text-primary" />
              <span className="text-2xl font-bold">{p.creditos.toLocaleString("pt-BR")}</span>
              <span className="text-sm text-muted-foreground">créditos</span>
            </div>
            <p className="text-2xl font-bold">{p.preco}</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Envios ilimitados</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Suporte por e-mail</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Emojis premium</li>
            </ul>
            <Button
              className="w-full"
              variant={p.destaque ? "default" : "outline"}
              onClick={() => toast.info("Pagamento em breve disponível.")}
            >
              Comprar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}