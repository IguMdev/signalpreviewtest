import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  Send,
  Zap,
  Bot,
  TrendingUp,
  Users,
  Shield,
  Sparkles,
  Flame,
  Trophy,
  GraduationCap,
  ShoppingBag,
  LineChart,
  Sun,
  Moon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TelesinAIs — Automação Telegram para Sinais, Promoções e Comunidades" },
      {
        name: "description",
        content:
          "Plataforma all-in-one para criar bots, automatizar envios, gerenciar grupos VIP e escalar sua comunidade no Telegram.",
      },
      { property: "og:title", content: "TelesinAIs — Automação Telegram" },
      {
        property: "og:description",
        content:
          "Automatize sinais, promoções de afiliado, funis VIP e engajamento no Telegram em um único painel.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Bot,
    title: "Bots inteligentes",
    desc: "Boas-vindas, follow-up e encaminhador automático para escalar atendimento sem time.",
  },
  {
    icon: Zap,
    title: "Envios agendados",
    desc: "Sinais, prévias, lembretes e promoções disparados na hora certa, em todos os grupos.",
  },
  {
    icon: TrendingUp,
    title: "Tracking nativo",
    desc: "Pixels, postbacks e Meta CAPI integrados para medir cada clique e conversão.",
  },
  {
    icon: Users,
    title: "Gestão de membros",
    desc: "Controle de acesso VIP, expiração automática e fluxos de upsell prontos.",
  },
  {
    icon: Sparkles,
    title: "Emojis Premium",
    desc: "Mensagens que se destacam com emojis premium e templates de alta conversão.",
  },
  {
    icon: Shield,
    title: "Cloud seguro",
    desc: "Banco gerenciado, RLS e backups automáticos — sem precisar configurar servidor.",
  },
];

const niches = [
  { icon: Trophy, title: "iGaming", desc: "Sinais de cassino, odds esportivas e afiliados de casas de aposta." },
  { icon: LineChart, title: "OB (Opportunity Bets)", desc: "Sinais de operações binárias com martingale, soros e gestão de banca automatizada." },
  { icon: Flame, title: "Hot", desc: "Funis VIP, prévias agendadas e promoções de redes adultas." },
  { icon: GraduationCap, title: "Experts", desc: "Aulas, lembretes e funis de venda de mentoria/curso." },
  { icon: ShoppingBag, title: "Promoções", desc: "Amazon, Shopee, Mercado Livre e AliExpress com link de afiliado." },
];

function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  return (
    <div className="min-h-screen relative overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute -top-40 -left-40 size-[520px] rounded-full cyber-gradient opacity-25 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 size-[560px] rounded-full cyber-gradient opacity-20 blur-3xl pointer-events-none" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="TelesinAIs" className="size-9 rounded-xl neon-glow" />
          <span className="font-bold tracking-tight cyber-text">TelesinAIs</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
          <a href="#nichos" className="hover:text-foreground transition-colors">Nichos</a>
          <a href="#comecar" className="hover:text-foreground transition-colors">Começar</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Alternar tema"
            title="Alternar tema"
            suppressHydrationWarning
          >
            {mounted ? (
              theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />
            ) : (
              <Sun className="size-4 opacity-0" />
            )}
          </Button>
          {user ? (
            <Button asChild className="cyber-gradient text-primary-foreground border-0 hover:opacity-90 neon-glow">
              <Link to="/dashboard">Ir para o painel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Entrar</Link>
              </Button>
              <Button asChild className="cyber-gradient text-primary-foreground border-0 hover:opacity-90 neon-glow">
                <Link to="/signup">Cadastrar-se</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="size-3.5 text-primary" />
          Automação Telegram all-in-one
        </div>
        <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
          Escale sua operação no <span className="cyber-text">Telegram</span> no piloto automático
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Crie bots, dispare sinais, gerencie membros VIP, rode promoções de afiliado e acompanhe cada
          conversão — tudo a partir de um painel único.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="cyber-gradient text-primary-foreground border-0 hover:opacity-90 neon-glow">
            <Link to="/signup">
              <Send className="size-4" /> Criar conta grátis
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="relative z-10 mx-auto max-w-6xl px-6 pb-24 scroll-mt-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tudo que você precisa em um lugar</h2>
          <p className="mt-3 text-muted-foreground">Pare de juntar 5 ferramentas. O TelesinAIs faz o trabalho pesado.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-6 glass-strong cyber-border rounded-2xl border-0">
              <div className="flex size-11 items-center justify-center rounded-xl cyber-gradient neon-glow">
                <f.icon className="size-5 text-primary-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Niches */}
      <section id="nichos" className="relative z-10 mx-auto max-w-6xl px-6 pb-24 scroll-mt-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Feito para o seu nicho</h2>
          <p className="mt-3 text-muted-foreground">Templates e automações prontas para cada tipo de operação.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {niches.map((n) => (
            <Card key={n.title} className="p-6 glass-strong cyber-border rounded-2xl border-0">
              <n.icon className="size-7 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{n.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{n.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="comecar" className="relative z-10 mx-auto max-w-4xl px-6 pb-24 scroll-mt-24">
        <Card className="p-10 md:p-14 text-center glass-strong cyber-border neon-glow rounded-3xl border-0">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Comece em <span className="cyber-text">minutos</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Crie sua conta gratuita, conecte seu bot do Telegram e dispare a primeira automação ainda hoje.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="cyber-gradient text-primary-foreground border-0 hover:opacity-90 neon-glow">
              <Link to="/signup">Cadastrar-se</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </Card>
      </section>

      <footer className="relative z-10 border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TelesinAIs — Automação Telegram
      </footer>
    </div>
  );
}