import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Send,
  Sparkles,
  Users,
  CalendarClock,
  Wallet,
  UserCircle,
  LogOut,
  Menu,
  Moon,
  Sun,
  Video,
  UserPlus,
  GraduationCap,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Bot,
  MessageCircle,
  Forward,
  ScrollText,
  Crosshair,
  Globe,
  Code2,
  Funnel,
  BarChart3,
  Repeat,
  Link2,
  Lock,
  ShoppingBag,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { TourProvider } from "@/components/tour/TourProvider";
import { BoostAllocationDialog } from "@/components/engagement/BoostAllocationDialog";
export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tour: "nav-dashboard" },
  { to: "/telegram-accounts", label: "Contas Telegram", icon: Send, tour: "nav-telegram-accounts" },
  { to: "/premium-emojis", label: "Emojis Premium", icon: Sparkles, tour: "nav-premium-emojis" },
  { to: "/rooms", label: "Salas", icon: Users, tour: "nav-rooms" },
  { to: "/membros", label: "Membros", icon: UserPlus, tour: "nav-membros" },
  { to: "/mensagens", label: "Agendamentos", icon: CalendarClock, tour: "nav-mensagens" },
  { to: "/videos", label: "Vídeos", icon: Video, tour: "nav-videos" },
  { to: "/recarga", label: "Recarga", icon: Wallet, tour: "nav-recarga" },
] as const;

const trackingItems = [
  { to: "/trackeamento/dominios", label: "Domínios", icon: Globe },
  { to: "/trackeamento/pixels", label: "Pixels", icon: Code2 },
  { to: "/trackeamento/canal", label: "Canal", icon: Send },
  { to: "/trackeamento/funis", label: "Funis", icon: Funnel },
  { to: "/trackeamento/metricas", label: "Métricas", icon: BarChart3 },
  { to: "/trackeamento/postbacks", label: "Postbacks", icon: Repeat },
  { to: "/trackeamento/integracoes", label: "Integrações", icon: Link2 },
] as const;

const trackingLockedItems = [
  { label: "Mensagens", icon: MessageCircle },
] as const;

const promoItems = [
  { to: "/promocoes/contas", label: "Contas de afiliado", icon: ShoppingBag },
  { to: "/promocoes/estatisticas", label: "Estatísticas", icon: BarChart2 },
] as const;

const botItems = [
  { to: "/bots/boasvindas", label: "BotBoasVindas", icon: MessageCircle, type: "boasvindas" as const },
  { to: "/bots/encaminhador", label: "BotEncaminhador", icon: Forward, type: "encaminhador" as const },
  { to: "/bots/followup", label: "BotFollowUp", icon: MessageCircle, type: "boasvindas" as const },
] as const;
const botLogsItem = { to: "/bots/logs", label: "Logs dos Bots", icon: ScrollText } as const;

const accountItems = [
  { to: "/perfil", label: "Minha conta", icon: UserCircle, tour: "nav-perfil" },
] as const;

const footerNavItems = [
  { to: "/tutorial", label: "Tutorial", icon: GraduationCap, tour: "nav-tutorial" },
] as const;

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    const isDark =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, credits")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const botSubsQuery = useQuery({
    queryKey: ["bot-subs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_engagement_subscriptions")
        .select("bot_type, status")
        .eq("user_id", user!.id)
        .eq("status", "active");
      return (data ?? []).map((r: any) => r.bot_type as string);
    },
  });
  const activeBots = new Set(botSubsQuery.data ?? []);
  const visibleBotItems = botItems.filter((b) => activeBots.has(b.type));

  const premiumAccountsQuery = useQuery({
    queryKey: ["has-premium-account", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("telegram_accounts")
        .select("id", { count: "exact", head: true })
        .eq("account_type", "premium")
        .eq("is_active", true)
        .not("tg_session", "is", null);
      return (count ?? 0) > 0;
    },
  });
  const hasPremiumAccount = premiumAccountsQuery.data === true;

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <TourProvider>
    <div className="min-h-screen text-foreground">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-30 h-16 glass border-b border-border/60 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen((v) => !v)}>
          <Menu className="size-5" />
        </Button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/favicon.png" alt="Logo" className="size-9 rounded-lg" />
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full glass cyber-border px-3 py-1.5 text-sm">
            <Wallet className="size-4 text-primary" />
            <span className="font-medium">{profileQuery.data?.credits ?? 0}</span>
            <span className="text-muted-foreground text-xs">créditos</span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Link to="/perfil" aria-label="Minha conta" className="shrink-0">
            <Avatar className="size-8 ring-1 ring-primary/40 hover:ring-primary transition">
              <AvatarImage src={profileQuery.data?.avatar_url ?? undefined} alt={profileQuery.data?.display_name ?? "Perfil"} />
              <AvatarFallback className="text-xs">
                {(profileQuery.data?.display_name?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate({ to: "/login" }))}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 bottom-0 left-0 z-20 w-64 glass border-r border-border/60 transition-transform flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, tour }) => {
            if (to === "/premium-emojis" && !hasPremiumAccount) {
              return (
                <div
                  key={to}
                  data-tour={tour}
                  className="relative flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/40 cursor-not-allowed"
                  title="Cadastre uma conta premium em Contas Telegram para liberar"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-4" />
                    {label}
                  </span>
                  <Lock className="size-3" />
                </div>
              );
            }
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                data-tour={tour}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "cyber-gradient-soft text-foreground cyber-border"
                    : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} />
                {label}
              </Link>
            );
          })}

          {/* Separador sutil */}
          <div className="my-2 border-t border-border/40" />

          {/* Trackeamento dropdown */}
          <Collapsible defaultOpen={location.pathname.startsWith("/trackeamento")}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                data-tour="nav-trackeamento"
                className="w-full relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition text-foreground/70 hover:bg-white/5 hover:text-foreground"
              >
                <span className="flex items-center gap-3">
                  <Crosshair className="size-4" />
                  Trackeamento
                </span>
                <ChevronDown className="size-4 transition-transform data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pl-2">
              {trackingItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active
                        ? "cyber-gradient-soft text-foreground cyber-border"
                        : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-4", active && "text-primary")} />
                    {label}
                  </Link>
                );
              })}
              {trackingLockedItems.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="relative flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground/40 cursor-not-allowed"
                  title="Faça a Assinatura em Recarga"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-4" />
                    {label}
                  </span>
                  <Lock className="size-3" />
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Promoções dropdown */}
          <Collapsible defaultOpen={location.pathname.startsWith("/promocoes")}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition text-foreground/70 hover:bg-white/5 hover:text-foreground"
              >
                <span className="flex items-center gap-3">
                  <ShoppingBag className="size-4" />
                  Promoções
                </span>
                <ChevronDown className="size-4 transition-transform data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pl-2">
              {promoItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active
                        ? "cyber-gradient-soft text-foreground cyber-border"
                        : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-4", active && "text-primary")} />
                    {label}
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Bots dropdown — só aparece se houver assinatura ativa */}
          {visibleBotItems.length > 0 && (
            <Collapsible defaultOpen={visibleBotItems.some((i) => location.pathname === i.to || location.pathname.startsWith(i.to + "/"))}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition text-foreground/70 hover:bg-white/5 hover:text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Bot className="size-4" />
                    Bots
                  </span>
                  <ChevronDown className="size-4 transition-transform data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-2">
                {visibleBotItems.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to || location.pathname.startsWith(to + "/");
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                        active
                          ? "cyber-gradient-soft text-foreground cyber-border"
                          : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4", active && "text-primary")} />
                      {label}
                    </Link>
                  );
                })}
                {(() => {
                  const Icon = botLogsItem.icon;
                  const active = location.pathname === botLogsItem.to;
                  return (
                    <Link
                      to={botLogsItem.to}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                        active
                          ? "cyber-gradient-soft text-foreground cyber-border"
                          : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4", active && "text-primary")} />
                      {botLogsItem.label}
                    </Link>
                  );
                })()}
              </CollapsibleContent>
            </Collapsible>
          )}
        </nav>
        <div className="px-3 pt-3 pb-4 mt-2 border-t border-border/60 bg-background/40 backdrop-blur-sm space-y-1">
          <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Ajuda
          </p>
          {footerNavItems.map(({ to, label, icon: Icon, tour }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                data-tour={tour}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "cyber-gradient-soft text-foreground cyber-border"
                    : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} />
                {label}
              </Link>
            );
          })}
          {accountItems.map(({ to, label, icon: Icon, tour }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                data-tour={tour}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "cyber-gradient-soft text-foreground cyber-border"
                    : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} />
                {label}
              </Link>
            );
          })}
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-background/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Content */}
      <main className="pt-16 lg:pl-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <BoostAllocationDialog />
    </div>
    </TourProvider>
  );
}