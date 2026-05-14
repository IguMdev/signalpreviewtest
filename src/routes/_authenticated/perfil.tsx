import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserCircle, Mail, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user, signOut } = useAuth();
  const { data } = useQuery({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted-foreground">Informações da sua conta e créditos.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-primary/10 grid place-items-center text-primary">
            <UserCircle className="size-8" />
          </div>
          <div>
            <p className="font-semibold text-lg">{data?.display_name ?? "Usuário"}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Mail className="size-3.5" /> {user?.email}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-accent/40 p-4 flex items-center gap-3">
          <Wallet className="size-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Créditos disponíveis</p>
            <p className="text-xl font-bold">{data?.credits ?? 0}</p>
          </div>
        </div>

        <Button variant="outline" onClick={() => signOut()}>Sair da conta</Button>
      </div>
    </div>
  );
}