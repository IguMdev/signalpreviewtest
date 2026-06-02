import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { MessageCircle, Plus, Trash2, Bot, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/trackeamento/mensagens")({
  component: TrackingMessagesPage,
});

function TrackingMessagesPage() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [token, setToken] = useState("");
  
  // Queries
  const botsQ = useQuery({
    queryKey: ["tracking-bots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tracking_bots").select("*").order("created_at", { ascending: false });
      if (error) {
        // Fallback for when table doesn't exist yet
        console.error(error);
        return [];
      }
      return data;
    },
  });

  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedBotId && botsQ.data?.[0]) {
      setSelectedBotId(botsQ.data[0].id);
    }
  }, [botsQ.data, selectedBotId]);

  const selectedBot = botsQ.data?.find((b: any) => b.id === selectedBotId);

  const messagesQ = useQuery({
    queryKey: ["tracking-bot-messages", selectedBotId],
    enabled: !!selectedBotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_bot_messages" as any)
        .select("*")
        .eq("tracking_bot_id", selectedBotId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("tracking_bots" as any).insert({
        user_id: u.user!.id,
        label: "Bot " + token.substring(0, 10) + "...",
        bot_token: token,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Bot validado e salvo!");
      setOpenNew(false);
      setToken("");
      setSelectedBotId(data.id);
      qc.invalidateQueries({ queryKey: ["tracking-bots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracking_bots" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bot deletado.");
      qc.invalidateQueries({ queryKey: ["tracking-bots"] });
    },
  });

  const updateMut = useMutation({
    mutationFn: async (updates: any) => {
      if (!selectedBotId) return;
      const { error } = await supabase.from("tracking_bots" as any).update(updates).eq("id", selectedBotId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações atualizadas");
      qc.invalidateQueries({ queryKey: ["tracking-bots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMsgMut = useMutation({
    mutationFn: async () => {
      if (!selectedBotId) return;
      const { data: u } = await supabase.auth.getUser();
      const sortOrder = (messagesQ.data?.length ?? 0) + 1;
      const { error } = await supabase.from("tracking_bot_messages" as any).insert({
        user_id: u.user!.id,
        tracking_bot_id: selectedBotId,
        content: "Nova mensagem...",
        sort_order: sortOrder,
        delay_seconds: 60,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracking-bot-messages", selectedBotId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMsgMut = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("tracking_bot_messages" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem salva");
      qc.invalidateQueries({ queryKey: ["tracking-bot-messages", selectedBotId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMsgMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracking_bot_messages" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracking-bot-messages", selectedBotId] }),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="size-6 text-primary" />
          Mensagens do Trackeamento
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure as mensagens de entrada e o auto-aceite dos seus bots de trackeamento.
        </p>
      </div>

      {/* Tabela de Bots */}
      <Card className="border-border/60 shadow-none bg-card/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Bot
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="size-4" /> Adicionar Bot
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Editar Bot</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-4 rounded-xl border border-border/60 p-4 bg-muted/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>
                        Obtenha o Token do seu Bot
                      </div>
                      <p className="text-xs text-muted-foreground pl-7">Use o <strong className="text-foreground">@BotFather</strong> para criar ou selecionar seu bot.</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">2</span>
                        Insira o Token
                      </div>
                      <p className="text-xs text-muted-foreground pl-7">Cole o token copiado do BotFather no campo abaixo e valide-o.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-500">
                    <CheckCircle2 className="size-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Compatível com Manychat!</p>
                      <p className="text-xs opacity-90">Você pode utilizar seu bot no Manychat e na Track4You ao mesmo tempo.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Token do Bot</Label>
                    <div className="flex gap-2">
                      <Input
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                        className="font-mono text-xs"
                      />
                      <Button
                        onClick={() => createMut.mutate()}
                        disabled={!token || createMut.isPending}
                        className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {createMut.isPending ? "Validando..." : "Validar Token"}
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
                  <Button onClick={() => setOpenNew(false)} className="bg-primary/20 text-primary hover:bg-primary/30">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nome do Bot</th>
                  <th className="px-4 py-3 text-left font-semibold">Token</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {botsQ.data?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum bot cadastrado.
                    </td>
                  </tr>
                ) : (
                  botsQ.data?.map((bot: any) => (
                    <tr
                      key={bot.id}
                      className={`hover:bg-muted/30 transition cursor-pointer ${selectedBotId === bot.id ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedBotId(bot.id)}
                    >
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <Bot className="size-4 text-primary" />
                        {bot.label}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {bot.bot_token.substring(0, 10)}...
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                          <span className="size-1.5 rounded-full bg-emerald-500"></span>
                          {bot.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 hover:text-blue-500 border-blue-600/20">
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); deleteMut.mutate(bot.id); }}
                          className="h-7 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive border-destructive/20"
                        >
                          Deletar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Configurações Padrão */}
      <h2 className="text-lg font-semibold pt-4">Configurações Padrão</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {/* Mensagem de Entrada */}
        <Card className="border-border/60 shadow-none bg-card/40">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Mensagem de Entrada</CardTitle>
            <Switch
              checked={(selectedBot as any)?.welcome_enabled ?? false}
              onCheckedChange={(v) => updateMut.mutate({ welcome_enabled: v })}
              disabled={!selectedBot}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={`text-xs ${selectedBot?.welcome_enabled ? 'text-emerald-500' : 'text-destructive'}`}>
              {selectedBot?.welcome_enabled ? 'Ativo' : 'Inativo'}
            </p>
            <div className="space-y-2">
              <Textarea
                value={(selectedBot as any)?.welcome_message ?? ""}
                onChange={(e) => updateMut.mutate({ welcome_message: e.target.value })}
                placeholder="Seja bem-vindo ao grupo!"
                rows={3}
                disabled={!selectedBot}
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-Aceite */}
        <Card className="border-border/60 shadow-none bg-card/40">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Auto-Aceite</CardTitle>
            <Switch
              checked={(selectedBot as any)?.auto_accept_enabled ?? false}
              onCheckedChange={(v) => updateMut.mutate({ auto_accept_enabled: v })}
              disabled={!selectedBot}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={`text-xs ${selectedBot?.auto_accept_enabled ? 'text-emerald-500' : 'text-destructive'}`}>
              {selectedBot?.auto_accept_enabled ? 'Ativo' : 'Inativo'}
            </p>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Aceitar membro após:</Label>
              <Select
                value={(selectedBot as any)?.auto_accept_delay_seconds?.toString() || "0"}
                onValueChange={(v) => updateMut.mutate({ auto_accept_delay_seconds: parseInt(v) })}
                disabled={!selectedBot}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Instantâneo</SelectItem>
                  <SelectItem value="60">1 Minuto</SelectItem>
                  <SelectItem value="300">5 Minutos</SelectItem>
                  <SelectItem value="600">10 Minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mensagens Personalizadas */}
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-lg font-semibold">Mensagens Personalizadas</h2>
        <Button size="sm" onClick={() => addMsgMut.mutate()} className="bg-primary/20 text-primary hover:bg-primary/30" disabled={!selectedBot || addMsgMut.isPending}>
          <Plus className="size-4 mr-2" /> Nova Mensagem
        </Button>
      </div>
      
      {messagesQ.data?.length === 0 ? (
        <Card className="border-border/60 shadow-none bg-card/40 p-8 text-center text-muted-foreground">
          Nenhuma mensagem personalizada criada para este bot.
        </Card>
      ) : (
        <div className="space-y-3">
          {messagesQ.data?.map((msg: any, i: number) => (
            <Card key={msg.id} className="border-border/60 shadow-none bg-card/40">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Mensagem #{i + 1}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMsgMut.mutate(msg.id)}
                    className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid md:grid-cols-[1fr_200px] gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Conteúdo da Mensagem</Label>
                    <Textarea
                      defaultValue={msg.content}
                      onBlur={(e) => updateMsgMut.mutate({ id: msg.id, updates: { content: e.target.value } })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Atraso após a entrada (segundos)</Label>
                    <Input
                      type="number"
                      defaultValue={msg.delay_seconds}
                      onBlur={(e) => updateMsgMut.mutate({ id: msg.id, updates: { delay_seconds: parseInt(e.target.value) || 0 } })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ex: 60 para enviar 1 minuto após o lead entrar.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
