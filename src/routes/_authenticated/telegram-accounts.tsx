import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { verifyAccount, sendTestMessage, refreshChats } from "@/lib/accounts.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, RefreshCw, Send, Trash2, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/telegram-accounts")({
  component: TelegramAccountsPage,
});

function TelegramAccountsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const verify = useServerFn(verifyAccount);
  const sendTest = useServerFn(sendTestMessage);
  const refresh = useServerFn(refreshChats);

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

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("telegram_accounts").insert({
        user_id: user!.id,
        label,
        bot_token: token,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta adicionada");
      setOpenNew(false);
      setLabel("");
      setToken("");
      qc.invalidateQueries({ queryKey: ["telegram-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Telegram</h1>
          <p className="text-sm text-muted-foreground">Gerencie os bots usados para enviar sinais.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Nova conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar conta Telegram</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rótulo</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Bot principal" />
              </div>
              <div className="space-y-2">
                <Label>Bot Token</Label>
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456:ABC-..."
                  type="password"
                />
                <p className="text-xs text-muted-foreground">
                  Obtenha o token criando um bot com o @BotFather no Telegram.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!label || !token || createMut.isPending}
              >
                {createMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {accounts.data?.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground text-sm">
            <Send className="size-8 mx-auto mb-2 opacity-50" />
            Nenhuma conta cadastrada ainda.
          </Card>
        )}
        {accounts.data?.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{a.label}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      a.status === "ok"
                        ? "bg-primary/10 text-primary"
                        : a.status === "error"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.bot_username ? `@${a.bot_username}` : "—"}
                  {a.last_error && ` · ${a.last_error}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await verify({ data: { accountId: a.id } });
                    if (r.ok) toast.success("Conta verificada");
                    else toast.error(r.error ?? "Falha");
                    qc.invalidateQueries({ queryKey: ["telegram-accounts"] });
                  }}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await refresh({ data: { accountId: a.id } });
                    if (r.ok) toast.success(`${r.count} chats sincronizados`);
                    else toast.error(r.error ?? "Falha");
                  }}
                  title="Sincronizar grupos visíveis"
                >
                  <Users className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTestFor(a.id)}>
                  <MessageSquare className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover esta conta?")) deleteMut.mutate(a.id);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

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

function Users(props: React.SVGProps<SVGSVGElement>) {
  // local fallback to avoid extra import
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}