import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Eye, EyeOff, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getMySubscriptions } from "@/lib/engagement.functions";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function splitName(full?: string | null): { first: string; last: string } {
  if (!full) return { first: "", last: "" };
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function PerfilPage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");
  const [phone, setPhone] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const fetchSubs = useServerFn(getMySubscriptions);
  const subsQ = useQuery({
    queryKey: ["engagement-subs", user?.id],
    queryFn: () => fetchSubs(),
    enabled: !!user,
  });

  useEffect(() => {
    const n = splitName(profile?.display_name);
    setFirstName(n.first);
    setLastName(n.last);
    if (user?.email) setEmail(user.email);
    if (user?.user_metadata) {
      setAddress(user.user_metadata.address || "");
      setCpf(user.user_metadata.cpf || "");
      setBirthDate(user.user_metadata.birth_date || "");
      setNationality(user.user_metadata.nationality || "");
      setPhone(user.user_metadata.phone || "");
    }
  }, [profile?.display_name, user]);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 800 * 1024) {
      toast.error("Tamanho máximo: 800KB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", user.id);
      if (updErr) throw updErr;
      await qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Foto atualizada");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar foto");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveInfo() {
    if (!user) return;
    setSavingInfo(true);
    try {
      const display_name = `${firstName} ${lastName}`.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ display_name })
        .eq("id", user.id);
      if (error) throw error;
      
      const updates: any = {};
      if (email && email !== user.email) {
        updates.email = email;
      }
      
      updates.data = {
        address,
        cpf,
        birth_date: birthDate,
        nationality,
        phone,
      };

      const { error: authErr } = await supabase.auth.updateUser(updates);
      if (authErr) throw authErr;
      
      if (email && email !== user.email) {
        toast.info("Enviamos um email de confirmação para o novo endereço.");
      }

      await qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Informações salvas");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar");
    } finally {
      setSavingInfo(false);
    }
  }

  async function savePassword() {
    if (!newPwd || newPwd.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (!user?.email) return;
    setSavingPwd(true);
    try {
      // Reauth
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPwd,
      });
      if (reauthErr) {
        toast.error("Senha atual incorreta");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setCurrentPwd("");
      setNewPwd("");
      toast.success("Senha atualizada");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao atualizar senha");
    } finally {
      setSavingPwd(false);
    }
  }

  const initials =
    (firstName?.[0] ?? "") + (lastName?.[0] ?? "") || (user?.email?.[0] ?? "U");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minha Conta</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua conta e preferências.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          <LogOut className="size-4 mr-1.5" /> Sair
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Avatar card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="size-20 rounded-md">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={firstName} />
                <AvatarFallback className="rounded-md text-lg">
                  {initials.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 flex-1">
                <p className="font-semibold">{firstName || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">
                  JPG, GIF ou PNG. Tamanho máximo de 800K
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="size-4 mr-1.5" />
                  {uploading ? "Enviando..." : "Enviar foto"}
                </Button>

              </div>
            </div>

            {/* Subscriptions */}
            {subsQ.data && subsQ.data.length > 0 && (
              <div className="mt-6 pt-6 border-t space-y-4">
                <p className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">Assinatura Atual</p>
                {subsQ.data.map((sub: any) => {
                  const isExpired = sub.current_period_end && isPast(new Date(sub.current_period_end));
                  const timeLeft = sub.current_period_end
                    ? formatDistanceToNow(new Date(sub.current_period_end), { locale: ptBR })
                    : null;
                  
                  const endDate = sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-BR') : '--/--/----';

                  return (
                    <div key={sub.id} className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4 shadow-sm transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                          <p className="font-bold text-base text-foreground truncate max-w-[150px]">
                            {sub.plan?.name || "Plano Customizado"}
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider shrink-0">
                          {sub.status === 'active' ? 'Ativo' : sub.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 mt-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Próxima cobrança</span>
                          <span className="font-semibold">{endDate}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Tempo restante</span>
                          <span className="font-semibold text-primary">
                            {isExpired ? "Expirado" : timeLeft}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Informações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Nome</Label>
                  <Input
                    id="firstName"
                    placeholder="Digite seu nome"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Sobrenome</Label>
                  <Input
                    id="lastName"
                    placeholder="Digite seu sobrenome"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={60}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">Ao trocar o email, você precisará confirmar a alteração no novo e no antigo endereço.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    placeholder="Digite seu CPF"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    maxLength={14}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="Digite seu número"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  placeholder="Digite seu endereço"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    placeholder="DD/MM/AAAA"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nationality">Nacionalidade</Label>
                  <Input
                    id="nationality"
                    placeholder="Sua nacionalidade"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={saveInfo} disabled={savingInfo}>
                {savingInfo ? "Salvando..." : "Salvar tudo"}
              </Button>
            </CardContent>
          </Card>

          {/* Informações da Senha */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações da Senha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPwd">Senha atual</Label>
                  <div className="relative">
                    <Input
                      id="currentPwd"
                      type={showCurrent ? "text" : "password"}
                      placeholder="Senha atual"
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Mostrar senha"
                    >
                      {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPwd">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="newPwd"
                      type={showNew ? "text" : "password"}
                      placeholder="Nova senha"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Mostrar senha"
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <Button onClick={savePassword} disabled={savingPwd}>
                {savingPwd ? "Salvando..." : "Salvar tudo"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
