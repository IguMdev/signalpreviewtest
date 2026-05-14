import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { verifyAccount, sendTestMessage, refreshChats } from "@/lib/accounts.functions";
import { enableMemberTracking } from "@/lib/telegram-tracking.functions";
import {
  requestPremiumCode,
  confirmPremiumCode,
  syncPremiumEmojis,
} from "@/lib/premium-account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  RefreshCw,
  Send,
  Trash2,
  MessageSquare,
  Bot,
  Sparkles,
  Check,
  Users as UsersIcon,
  UserCircle,
  Activity,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/telegram-accounts")({
  component: TelegramAccountsPage,
});

function TelegramAccountsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const verify = useServerFn(verifyAccount);
  const sendTest = useServerFn(sendTestMessage);
  const refresh = useServerFn(refreshChats);
  const enableTrack = useServerFn(enableMemberTracking);
  const reqCode = useServerFn(requestPremiumCode);
  const confirmCode = useServerFn(confirmPremiumCode);
  const syncEmojis = useServerFn(syncPremiumEmojis);

  const accounts = useQuery({
    queryKey: ["telegram-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [openNew, setOpenNew] = useState(false);
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [accountType, setAccountType] = useState<"bot" | "premium">("bot");
  const [phone, setPhone] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [premiumStep, setPremiumStep] = useState<"form" | "code">("form");
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState("");
  const [twoFa, setTwoFa] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loadingPremium, setLoadingPremium] = useState(false);

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("telegram_accounts").insert({
        user_id: user!.id,
        label,
        bot_token: token || "premium-no-token",
        account_type: accountType,
        phone: accountType === "premium" ? phone : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta adicionada");
      setOpenNew(false);
      setLabel("");
      setToken("");
      setPhone("");
      setAccountType("bot");
      qc.invalidateQueries({ queryKey: ["telegram-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetDialog() {
    setLabel("");
    setToken("");
    setPhone("");
    setApiId("");
    setApiHash("");
    setTelegramCode("");
    setTwoFa("");
    setNeeds2fa(false);
    setPremiumStep("form");
    setPendingAccountId(null);
    setAccountType("bot");
  }

  async function handleRequestCode() {
    if (!label || !phone || !apiId || !apiHash) {
      toast.error("Preencha todos os campos");
      return;
    }
    const idNum = Number(apiId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      toast.error("API ID inv\u00e1lido");
      return;
    }
    setLoadingPremium(true);
    try {
      // 1) cria a conta no banco
      const { data: row, error } = await supabase
        .from("telegram_accounts")
        .insert({
          user_id: user!.id,
          label,
          bot_token: null,
          account_type: "premium",
          phone,
          tg_api_id: idNum,
          tg_api_hash: apiHash,
        })
        .select("id")
        .single();
      if (error) throw error;
      // 2) chama o servi\u00e7o externo
      await reqCode({
        data: { accountId: row.id, apiId: idNum, apiHash, phone },
      });
      setPendingAccountId(row.id);
      setPremiumStep("code");
      toast.success("C\u00f3digo enviado pelo Telegram");
      qc.invalidateQueries({ queryKey: ["telegram-accounts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoadingPremium(false);
    }
  }

  async function handleConfirmCode() {
    if (!pendingAccountId || !telegramCode) return;
    setLoadingPremium(true);
    try {
      const r = await confirmCode({
        data: {
          accountId: pendingAccountId,
          code: telegramCode,
          password: twoFa || undefined,
        },
      });
      if (r.needsPassword) {
        setNeeds2fa(true);
        toast.message("Esta conta tem 2FA \u2014 informe a senha de nuvem");
        return;
      }
      toast.success("Conta conectada!");
      // Sincroniza emojis em background
      syncEmojis({ data: { accountId: pendingAccountId } })
        .then((s) => toast.success(`${s.count} emojis premium sincronizados`))
        .catch(() => {});
      setOpenNew(false);
      resetDialog();
      qc.invalidateQueries({ queryKey: ["telegram-accounts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoadingPremium(false);
    }
  }

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("telegram_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida");
      qc.invalidateQueries({ queryKey: ["telegram-accounts"] });
    },
  });

  const [testFor, setTestFor] = useState<string | null>(null);
  const [testChat, setTestChat] = useState("");
  const [testText, setTestText] = useState("Mensagem de teste do Sala de Sinais 🚀");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus bots e contas pessoais premium do Telegram.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Adicionar Conta
            </Button>
          </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
            <DialogTitle>
              {accountType === "premium" ? "Adicionar Conta Premium" : "Adicionar conta Telegram"}
            </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo da conta</Label>
              <Select
                value={accountType}
                onValueChange={(v) => {
                  setAccountType(v as "bot" | "premium");
                  setPremiumStep("form");
                  setPendingAccountId(null);
                }}
              >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bot">🤖 Bot (Básico)</SelectItem>
                    <SelectItem value="premium">✨ Conta Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {accountType === "bot" && (
              <>
                <div className="space-y-2">
                  <Label>R\u00f3tulo / Nome do bot</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Bot principal" />
                </div>
                <div className="space-y-2">
                  <Label>Bot Token</Label>
                  <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-..." type="password" />
                  <p className="text-xs text-muted-foreground">
                    Crie um bot com o @BotFather no Telegram para obter o token.
                  </p>
                </div>
              </>
            )}

            {accountType === "premium" && premiumStep === "form" && (
              <>
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm space-y-2">
                  <p className="font-semibold">Como conectar sua conta Telegram:</p>
                  <p className="font-medium">📱 Passo a passo:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    <li>Acesse <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="underline">my.telegram.org</a> e fa\u00e7a login</li>
                    <li>V\u00e1 em "API Development Tools" e crie uma aplica\u00e7\u00e3o</li>
                    <li>Copie o <b>API ID</b> e <b>API Hash</b></li>
                    <li>Preencha todos os campos abaixo</li>
                    <li>Clique em "Solicitar C\u00f3digo" — ele chega no <b>app do Telegram</b> (n\u00e3o por SMS)</li>
                    <li>Digite o c\u00f3digo recebido no app e clique em "Conectar"</li>
                  </ol>
                  <div className="rounded-md bg-primary/20 px-3 py-2 text-xs">
                    💡 <b>Dica:</b> As credenciais API s\u00e3o necess\u00e1rias para conectar sua conta pessoal.
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Conta</Label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Minha Conta Premium" />
                    <p className="text-xs text-muted-foreground">Nome para identificar esta conta no sistema</p>
                  </div>
                  <div className="space-y-2">
                    <Label>N\u00famero do Telefone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511999999999" />
                    <p className="text-xs text-muted-foreground">N\u00famero completo com c\u00f3digo do pa\u00eds (ex: +55)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>API ID</Label>
                    <Input value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="12345678" inputMode="numeric" />
                    <p className="text-xs text-muted-foreground">API ID obtido em my.telegram.org</p>
                  </div>
                  <div className="space-y-2">
                    <Label>API Hash</Label>
                    <Input value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="abcdef1234567890..." />
                    <p className="text-xs text-muted-foreground">API Hash obtido em my.telegram.org</p>
                  </div>
                </div>
              </>
            )}

            {accountType === "premium" && premiumStep === "code" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm flex items-start gap-3">
                  <KeyRound className="size-5 mt-0.5" />
                  <div>
                    <p className="font-semibold">Digite o c\u00f3digo recebido no app do Telegram</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Abra o app do Telegram e veja a conversa oficial "Telegram". O c\u00f3digo n\u00e3o \u00e9 enviado por SMS e expira em ~5 minutos.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>C\u00f3digo</Label>
                  <Input
                    value={telegramCode}
                    onChange={(e) => setTelegramCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="12345"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                {needs2fa && (
                  <div className="space-y-2">
                    <Label>Senha 2FA (verifica\u00e7\u00e3o em duas etapas)</Label>
                    <Input type="password" value={twoFa} onChange={(e) => setTwoFa(e.target.value)} />
                  </div>
                )}
              </div>
            )}
            </div>
            <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenNew(false); resetDialog(); }}>
              Cancelar
            </Button>
            {accountType === "bot" && (
              <Button
                onClick={() => createMut.mutate()}
                disabled={!label || !token || createMut.isPending}
              >
                {createMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            )}
            {accountType === "premium" && premiumStep === "form" && (
              <Button onClick={handleRequestCode} disabled={loadingPremium}>
                {loadingPremium ? "Enviando..." : "Solicitar C\u00f3digo"}
              </Button>
            )}
            {accountType === "premium" && premiumStep === "code" && (
              <Button onClick={handleConfirmCode} disabled={loadingPremium || !telegramCode}>
                {loadingPremium ? "Conectando..." : "Conectar"}
              </Button>
            )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Banner explicativo */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="font-semibold mb-3">Tipos de Conta:</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 font-medium mb-2">
              <Bot className="size-4" /> Bot (Básico)
            </div>
            <ul className="space-y-1 text-muted-foreground pl-1">
              <li>• Mensagens automáticas</li>
              <li>• Emojis padrão</li>
              <li>• API oficial do Telegram</li>
              <li>• Gratuito e simples</li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium mb-2 text-amber-500">
              <Sparkles className="size-4" /> Conta Premium
            </div>
            <ul className="space-y-1 text-muted-foreground pl-1">
              <li>• Emojis premium exclusivos</li>
              <li>• Envio como usuário pessoal</li>
              <li>• Maior personalização</li>
              <li>• Recursos avançados</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Cards de contas */}
      {accounts.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground text-sm">
          <Send className="size-8 mx-auto mb-2 opacity-50" />
          Nenhuma conta cadastrada ainda.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.data?.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onVerify={async () => {
                const r = await verify({ data: { accountId: a.id } });
                if (r.ok) toast.success("Conta verificada");
                else toast.error(r.error ?? "Falha");
                qc.invalidateQueries({ queryKey: ["telegram-accounts"] });
              }}
              onRefresh={async () => {
                const r = await refresh({ data: { accountId: a.id } });
                if (r.ok) toast.success(`${r.count} chats sincronizados`);
                else toast.error(r.error ?? "Falha");
              }}
              onTest={() => setTestFor(a.id)}
              onDelete={() => {
                if (confirm("Remover esta conta?")) deleteMut.mutate(a.id);
              }}
              onEnableTracking={async () => {
                try {
                  await enableTrack({ data: { accountId: a.id } });
                  toast.success("Rastreamento de membros ativado. Adicione o bot como admin do grupo.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha");
                }
              }}
              onSyncEmojis={async () => {
                try {
                  const r = await syncEmojis({ data: { accountId: a.id } });
                  toast.success(`${r.count} emojis premium sincronizados`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha");
                }
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={!!testFor} onOpenChange={(o) => !o && setTestFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem de teste</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chat ID</Label>
              <Input value={testChat} onChange={(e) => setTestChat(e.target.value)} placeholder="-1001234567890" />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={testText} onChange={(e) => setTestText(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestFor(null)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!testFor) return;
                const r = await sendTest({
                  data: { accountId: testFor, chatId: testChat, text: testText },
                });
                if (r.ok) {
                  toast.success("Mensagem enviada");
                  setTestFor(null);
                } else {
                  toast.error(r.error ?? "Falha");
                }
              }}
              disabled={!testChat || !testText}
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Account = {
  id: string;
  label: string;
  status: string;
  account_type: "bot" | "premium";
  bot_username: string | null;
  phone: string | null;
  last_error: string | null;
  last_check_at: string | null;
  daily_limit: number;
};

function AccountCard({
  account: a,
  onVerify,
  onRefresh,
  onTest,
  onDelete,
  onEnableTracking,
  onSyncEmojis,
}: {
  account: Account;
  onVerify: () => void;
  onRefresh: () => void;
  onTest: () => void;
  onDelete: () => void;
  onEnableTracking: () => void;
  onSyncEmojis: () => void;
}) {
  const isPremium = a.account_type === "premium";

  // Contador de mensagens enviadas hoje
  const today = useQuery({
    queryKey: ["account-today", a.id],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("account_id", a.id)
        .eq("status", "sent")
        .gte("sent_at", start.toISOString());
      return count ?? 0;
    },
  });

  const used = today.data ?? 0;
  const limit = a.daily_limit || 1000;
  const pct = Math.min(100, (used / limit) * 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`size-10 rounded-xl grid place-items-center ${
              isPremium ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
            }`}
          >
            {isPremium ? <UserCircle className="size-5" /> : <Bot className="size-5" />}
          </div>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isPremium
                ? "bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-amber-500"
                : "bg-muted text-foreground"
            }`}
          >
            {isPremium ? "✨ Premium" : "Bot"}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
            a.status === "ok"
              ? "bg-emerald-500/10 text-emerald-500"
              : a.status === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {a.status === "ok" ? "Ativo" : a.status === "error" ? "Erro" : "Aguardando"}
        </span>
      </div>

      <div>
        <h3 className="font-bold text-lg leading-tight">{a.label}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isPremium ? a.phone || "—" : a.bot_username ? `@${a.bot_username}` : "—"}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground tracking-wider mb-1.5">RECURSOS</p>
        <ul className="space-y-1 text-sm">
          {isPremium ? (
            <>
              <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Mensagens como usuário pessoal</li>
              <li className="flex items-center gap-2"><Sparkles className="size-3.5 text-amber-500" /> Emojis Premium</li>
              <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Recursos Premium</li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Mensagens básicas</li>
              <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-500" /> Emojis padrão</li>
            </>
          )}
        </ul>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Mensagens hoje:</span>
          <span className="font-medium text-foreground">{used}/{limit}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {a.last_check_at
            ? `Verificado: ${new Date(a.last_check_at).toLocaleString("pt-BR")}`
            : "Nunca usado"}
        </span>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="size-8" onClick={onVerify} title="Verificar">
            <RefreshCw className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={onRefresh} title="Sincronizar grupos">
            <UsersIcon className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={onTest} title="Enviar teste">
            <MessageSquare className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={onEnableTracking} title="Ativar rastreamento de membros">
            <Activity className="size-3.5" />
          </Button>
          {isPremium && (
            <Button size="icon" variant="ghost" className="size-8" onClick={onSyncEmojis} title="Sincronizar emojis premium">
              <Sparkles className="size-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={onDelete} title="Remover">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}