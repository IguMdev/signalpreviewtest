import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Send } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Você já pode entrar.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="absolute -top-32 -right-32 size-[480px] rounded-full cyber-gradient opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 size-[520px] rounded-full cyber-gradient opacity-30 blur-3xl pointer-events-none" />
      <Card className="relative w-full max-w-md p-8 space-y-6 glass-strong cyber-border neon-glow rounded-2xl border-0">
        <div className="flex flex-col items-center gap-2">
          <div className="size-14 rounded-2xl cyber-gradient text-primary-foreground grid place-items-center neon-glow animate-pulse-neon">
            <Send className="size-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight cyber-text">Criar conta</h1>
          <p className="text-sm text-muted-foreground">Comece a enviar sinais</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full cyber-gradient text-primary-foreground border-0 hover:opacity-90 neon-glow" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="cyber-text font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}