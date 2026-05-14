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
  Sparkles as SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/telegram-accounts", label: "Contas Telegram", icon: Send },
  { to: "/premium-emojis", label: "Emojis Premium", icon: Sparkles },
  { to: "/rooms", label: "Salas", icon: Users },
  { to: "/mensagens", label: "Agendamentos", icon: CalendarClock },
  { to: "/videos", label: "Vídeos redondos", icon: Video },
  { to: "/recarga", label: "Recarga", icon: Wallet },
  { to: "/perfil", label: "Minha conta", icon: UserCircle },
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

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-30 h-16 bg-card/80 backdrop-blur border-b border-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen((v) => !v)}>
          <Menu className="size-5" />
        </Button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <Send className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Sala de Sinais</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-accent/60 px-3 py-1.5 text-sm">
            <Wallet className="size-4 text-primary" />
            <span className="font-medium">{profileQuery.data?.credits ?? 0}</span>
            <span className="text-muted-foreground text-xs">créditos</span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate({ to: "/login" }))}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 bottom-0 left-0 z-20 w-64 bg-card border-r border-border transition-transform",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <nav className="p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
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
    </div>
  );
}