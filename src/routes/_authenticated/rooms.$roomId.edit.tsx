import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Home, ChevronRight, ExternalLink, Plus, Trash2, Info, X, Upload, ImageIcon, Send, Smile, RotateCcw,
} from "lucide-react";
import { ASSETS_CATALOG, type AssetCategory } from "@/lib/assets-catalog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Heart, Users, MessageCircle, Forward, ChevronDown, ChevronUp } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  getRoomEngagementSettings,
  upsertRoomEngagementSettings,
  getMySubscriptions,
} from "@/lib/engagement.functions";
import { sendRoomTest } from "@/lib/accounts.functions";
import { testWindow } from "@/lib/test-signal.functions";

export const Route = createFileRoute("/_authenticated/rooms/$roomId/edit")({
  component: EditRoomPage,
});

const TIMEZONES = [
  { v: "America/Sao_Paulo", l: "São Paulo / Brasília" },
  { v: "America/Manaus", l: "Manaus" },
  { v: "America/Bahia", l: "Bahia" },
  { v: "America/Fortaleza", l: "Fortaleza" },
  { v: "America/Recife", l: "Recife" },
  { v: "America/Belem", l: "Belém" },
  { v: "America/Cuiaba", l: "Cuiabá" },
  { v: "America/New_York", l: "Nova York" },
  { v: "America/Los_Angeles", l: "Los Angeles" },
  { v: "Europe/Lisbon", l: "Lisboa" },
  { v: "Europe/London", l: "Londres" },
  { v: "UTC", l: "UTC" },
];

const TIMEFRAMES = ["M1","M2","M3","M5","M15","M30"];
const WEEKDAYS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

function EditRoomPage() {
  const { roomId } = useParams({ from: "/_authenticated/rooms/$roomId/edit" });
  const navigate = useNavigate();

  const room = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*, room_chats(id, chat_id, chat_title)")
        .eq("id", roomId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (room.isLoading) return <p className="text-sm text-muted-foreground p-8">Carregando...</p>;
  if (!room.data) return <p className="text-sm text-destructive p-8">Sala não encontrada.</p>;

  const r = room.data;
  const chatId = r.room_chats?.[0]?.chat_id;
  const accessUrl = r.access_url || (chatId ? `https://t.me/c/${String(chatId).replace(/^-?100/, "")}` : null);

  return (
    <div className="space-y-5 pb-24 xl:-mx-14 2xl:-mx-24">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="flex items-center gap-1 hover:text-foreground"><Home className="size-3.5" /> Home</Link>
        <ChevronRight className="size-3.5" />
        <Link to="/rooms" className="hover:text-foreground">Salas</Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Editar Sala</span>
      </nav>

      {/* Title */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Editar Sala - {r.name}</h1>
        {accessUrl && (
          <Button asChild size="sm" className="bg-primary">
            <a href={accessUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4 mr-1" />Acessar
            </a>
          </Button>
        )}
      </div>

      <BaseConfigCard room={r} />
      <MessagesInfoCard />
      <WindowsCard roomId={roomId} />
      <TemplatesCard roomId={roomId} />
      <SessionMessagesCard roomId={roomId} />
      <ReportsCard roomId={roomId} />
      <TimezoneCard room={r} />
      <StopLossCard room={r} />
      <MarketTipsCard room={r} />

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width,16rem)] bg-background/95 backdrop-blur border-t border-border p-4 flex justify-end gap-2 z-40">
        <Button onClick={() => toast.success("Use os botões 'Salvar' de cada seção para persistir mudanças")}>
          Salvar
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/rooms" })}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Base Config                                                   */
/* ============================================================ */

type RoomData = any;

function BaseConfigCard({ room }: { room: RoomData }) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState(room.default_account_id ?? "");
  const [premiumId, setPremiumId] = useState(room.premium_account_id ?? "");
  const [broker, setBroker] = useState(room.broker ?? "");
  const [chatId, setChatId] = useState(String(room.room_chats?.[0]?.chat_id ?? ""));

  const accounts = useQuery({
    queryKey: ["telegram-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id, label, account_type, bot_username, phone");
      return data ?? [];
    },
  });

  const bots = (accounts.data ?? []).filter((a: any) => a.account_type === "bot");
  const premiums = (accounts.data ?? []).filter((a: any) => a.account_type !== "bot");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").update({
        default_account_id: accountId || null,
        premium_account_id: premiumId || null,
        broker: broker || null,
      }).eq("id", room.id);
      if (error) throw error;

      if (chatId) {
        const existing = room.room_chats?.[0];
        if (existing) {
          await supabase.from("room_chats").update({ chat_id: Number(chatId) }).eq("id", existing.id);
        } else {
          const { data: u } = await supabase.auth.getUser();
          await supabase.from("room_chats").insert({ chat_id: Number(chatId), room_id: room.id, user_id: u.user!.id });
        }
      }
    },
    onSuccess: () => { toast.success("Configurações base salvas"); qc.invalidateQueries({ queryKey: ["room", room.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Configurações Base</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Conta do Telegram (conta do bot)</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Escolha um bot" /></SelectTrigger>
            <SelectContent>
              {bots.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.label} {a.bot_username ? `(@${a.bot_username})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Conta Premium</Label>
          <Select value={premiumId} onValueChange={setPremiumId}>
            <SelectTrigger><SelectValue placeholder="Escolha uma conta premium" /></SelectTrigger>
            <SelectContent>
              {premiums.length === 0 && <SelectItem value="__none" disabled>Nenhuma disponível</SelectItem>}
              {premiums.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.label} {a.phone ? `(${a.phone})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Conta premium para envio rápido de mensagens. Será usada em conjunto com bot para botões.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Corretora</Label>
          <div className="relative">
            <Input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="ex.: TitaniumBroker (titaniumbroker.io)" />
            {broker && (
              <button
                type="button"
                onClick={() => setBroker("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              ><X className="size-4" /></button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">ID do Grupo</Label>
          <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" />
        </div>
      </div>

      <div className="flex gap-3 p-4 rounded-md bg-blue-500/10 border border-blue-500/30">
        <Info className="size-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-foreground">💡 Sistema de Envio Híbrido</p>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            <li><span className="font-medium text-foreground">Conta Premium:</span> Envio rápido de mensagens (sem rate limits)</li>
            <li><span className="font-medium text-foreground">Bot:</span> Adição de botões inline (contas premium não suportam botões)</li>
            <li><span className="font-medium text-foreground">Resultado:</span> Velocidade + Funcionalidade completa</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar seção"}
        </Button>
      </div>
    </Card>
  );
}

function EngagementCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getRoomEngagementSettings);
  const fetchSubs = useServerFn(getMySubscriptions);
  const saveSettings = useServerFn(upsertRoomEngagementSettings);
  const sendTest = useServerFn(sendRoomTest);
  const [testingWelcome, setTestingWelcome] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["room-eng-settings", roomId],
    queryFn: () => fetchSettings({ data: { roomId } }),
  });
  const { data: subs } = useQuery({ queryKey: ["engagement-subs"], queryFn: () => fetchSubs() });

  const [autoReact, setAutoReact] = useState(false);
  const [reactionsPerSignal, setReactionsPerSignal] = useState(30);
  const [emojis, setEmojis] = useState<string[]>(["👍", "❤️", "🔥"]);
  const [emojiInput, setEmojiInput] = useState("");
  const [delayMin, setDelayMin] = useState(5);
  const [delayMax, setDelayMax] = useState(60);
  const [autoMembers, setAutoMembers] = useState(false);
  const [membersPerDay, setMembersPerDay] = useState(50);
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("Seja bem-vindo(a) ao grupo! 🎉");
  const [forwarderEnabled, setForwarderEnabled] = useState(false);
  const [forwarderSource, setForwarderSource] = useState<string>("");
  const [forwarderTargets, setForwarderTargets] = useState<string>("");

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    setAutoReact(s.auto_react_enabled);
    setReactionsPerSignal(s.reactions_per_signal);
    setEmojis(s.react_emojis ?? ["👍"]);
    setDelayMin(s.delay_seconds_min);
    setDelayMax(s.delay_seconds_max);
    setAutoMembers(s.auto_members_enabled);
    setMembersPerDay(s.members_per_day);
    setWelcomeEnabled(s.welcome_bot_enabled ?? false);
    setWelcomeMessage(s.welcome_message ?? "Seja bem-vindo(a) ao grupo! 🎉");
    setForwarderEnabled(s.forwarder_enabled ?? false);
    setForwarderSource(s.forwarder_source_chat_id ? String(s.forwarder_source_chat_id) : "");
    setForwarderTargets((s.forwarder_target_chat_ids ?? []).join(", "));
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          roomId,
          autoReactEnabled: autoReact,
          reactionsPerSignal,
          reactEmojis: emojis,
          delaySecondsMin: delayMin,
          delaySecondsMax: delayMax,
          autoMembersEnabled: autoMembers,
          membersPerDay,
          welcomeBotEnabled: welcomeEnabled,
          welcomeMessage,
          forwarderEnabled,
          forwarderSourceChatId: forwarderSource.trim() ? Number(forwarderSource.trim()) : null,
          forwarderTargetChatIds: forwarderTargets
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map(Number)
            .filter((n) => Number.isFinite(n)),
        },
      }),
    onSuccess: () => {
      toast.success("Configurações de engajamento salvas");
      qc.invalidateQueries({ queryKey: ["room-eng-settings", roomId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const subList = (subs ?? []) as any[];
  const activeBots = new Set(subList.filter((s) => s.status === "active").map((s) => s.plan?.bot_type));
  const hasReact = activeBots.has("interacoes");
  const hasMembers = activeBots.has("inscritos");
  const hasWelcome = activeBots.has("boasvindas");
  const hasForwarder = activeBots.has("encaminhador");
  const hasAnySub = activeBots.size > 0;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Engajamento Bot
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure os bots ativos para esta sala.
          </p>
        </div>
        {!hasAnySub && (
          <Button asChild size="sm" variant="outline">
            <Link to="/engagement">Ver planos</Link>
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Reações */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Heart className="size-4" /> BotInterações</Label>
            <Switch checked={autoReact} onCheckedChange={setAutoReact} disabled={!hasReact} />
          </div>
          {!hasReact && <p className="text-xs text-muted-foreground">Requer plano BotInterações ativo.</p>}
          <div className="space-y-1.5">
            <Label className="text-xs">Reações por sinal</Label>
            <Input type="number" min={1} max={10000} value={reactionsPerSignal}
              onChange={(e) => setReactionsPerSignal(Number(e.target.value))} disabled={!hasReact} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Emojis usados</Label>
            <div className="flex flex-wrap gap-1">
              {emojis.map((e, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {e}
                  <button onClick={() => setEmojis(emojis.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={emojiInput} onChange={(e) => setEmojiInput(e.target.value)} placeholder="🔥" className="w-20" disabled={!hasReact} />
              <Button size="sm" variant="outline" type="button" disabled={!hasReact || !emojiInput.trim()}
                onClick={() => { setEmojis([...emojis, emojiInput.trim()]); setEmojiInput(""); }}>
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Delay mín (s)</Label>
              <Input type="number" min={0} value={delayMin} onChange={(e) => setDelayMin(Number(e.target.value))} disabled={!hasReact} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Delay máx (s)</Label>
              <Input type="number" min={0} value={delayMax} onChange={(e) => setDelayMax(Number(e.target.value))} disabled={!hasReact} />
            </div>
          </div>
        </div>

        {/* Membros */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Users className="size-4" /> BotInscritos</Label>
            <Switch checked={autoMembers} onCheckedChange={setAutoMembers} disabled={!hasMembers} />
          </div>
          {!hasMembers && <p className="text-xs text-muted-foreground">Requer plano BotInscritos ativo.</p>}
          <div className="space-y-1.5">
            <Label className="text-xs">Membros por dia</Label>
            <Input type="number" min={1} max={50000} value={membersPerDay}
              onChange={(e) => setMembersPerDay(Number(e.target.value))} disabled={!hasMembers} />
            <p className="text-xs text-muted-foreground">
              Distribuído ao longo do dia para parecer crescimento orgânico.
            </p>
          </div>
        </div>

        {/* BotBoasVindas */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><MessageCircle className="size-4" /> BotBoasVindas</Label>
            <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} disabled={!hasWelcome} />
          </div>
          {!hasWelcome && <p className="text-xs text-muted-foreground">Requer plano BotBoasVindas ativo.</p>}
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem de boas-vindas</Label>
            <Textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              disabled={!hasWelcome}
              rows={3}
              placeholder="Seja bem-vindo(a) ao grupo! 🎉"
            />
            <p className="text-xs text-muted-foreground">
              Suporta HTML básico: &lt;b&gt;, &lt;i&gt;, &lt;a&gt;.
            </p>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasWelcome || testingWelcome}
                onClick={async () => {
                  try {
                    setTestingWelcome(true);
                    await sendTest({ data: { roomId, text: welcomeMessage } });
                    toast.success("Teste enviado");
                  } catch (e: any) { toast.error(e.message); }
                  finally { setTestingWelcome(false); }
                }}
              >
                📩 {testingWelcome ? "Enviando..." : "Enviar teste"}
              </Button>
            </div>
          </div>
        </div>

        {/* BotEncaminhador */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Forward className="size-4" /> BotEncaminhador</Label>
            <Switch checked={forwarderEnabled} onCheckedChange={setForwarderEnabled} disabled={!hasForwarder} />
          </div>
          {!hasForwarder && <p className="text-xs text-muted-foreground">Requer plano BotEncaminhador ativo.</p>}
          <div className="space-y-1.5">
            <Label className="text-xs">Chat de origem (chat_id)</Label>
            <Input
              value={forwarderSource}
              onChange={(e) => setForwarderSource(e.target.value)}
              disabled={!hasForwarder}
              placeholder="-1001234567890"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Chats de destino (separados por vírgula)</Label>
            <Input
              value={forwarderTargets}
              onChange={(e) => setForwarderTargets(e.target.value)}
              disabled={!hasForwarder}
              placeholder="-100123, -100456"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar seção"}
        </Button>
      </div>
    </Card>
  );
}

/* ============================================================ */
/* Messages Info                                                 */
/* ============================================================ */

function MessagesInfoCard() {
  return (
    <Card className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">Configurações de Mensagens</h2>
      <div className="p-3 rounded-md bg-muted/40 text-sm space-y-1">
        <p><span className="font-semibold">Tipos de arquivos suportados:</span></p>
        <p className="text-muted-foreground">Imagens: JPG, JPEG, PNG, GIF</p>
        <p className="text-muted-foreground">Stickers: WEBP (sticker estático), TGS (sticker animado), WEBM (sticker de vídeo)</p>
      </div>
      <div className="p-3 rounded-md bg-muted/40 text-sm space-y-1">
        <p><span className="font-semibold">Tags HTML:</span> <code className="text-xs">&lt;b&gt;negrito&lt;/b&gt;, &lt;i&gt;itálico&lt;/i&gt;, &lt;u&gt;sublinhado&lt;/u&gt;, &lt;s&gt;tachado&lt;/s&gt;, &lt;a href="url"&gt;link&lt;/a&gt;</code></p>
        <p><span className="font-semibold">Macros para Template de Sinal:</span> <code className="text-xs">{`{ATIVO}, {TIMEFRAME}, {DIRECAO}, {ENTRADA}, {ENTRADAGALE1}, {ENTRADAGALE2}`}</code></p>
      </div>
    </Card>
  );
}

/* ============================================================ */
/* Windows                                                       */
/* ============================================================ */

function WindowsCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["room_windows", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_windows").select("*").eq("room_id", roomId)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_windows").insert({
        room_id: roomId,
        user_id: u.user!.id,
        name: `SESSÃO ${new Date().toTimeString().slice(0, 5)}`,
        start_time: "09:00",
        end_time: "17:00",
        weekdays: [1, 2, 3, 4, 5],
        timeframes: ["M1"],
        signals_qty: 10,
        max_losses: 0,
        martingale: 2,
        signal_type: "message",
        use_all_assets: true,
        asset_filter: [],
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Janela adicionada"); qc.invalidateQueries({ queryKey: ["room_windows", roomId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Janelas de Operação</h2>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4 mr-1" />Adicionar Janela
        </Button>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {list.data?.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
          Nenhuma janela cadastrada. Clique em "Adicionar Janela".
        </div>
      )}

      <div className="space-y-4">
        {list.data?.map((w: any) => (
          <WindowItem key={w.id} window={w} roomId={roomId} />
        ))}
      </div>
    </Card>
  );
}

function WindowItem({ window: w, roomId }: { window: any; roomId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(w.name);
  const [start, setStart] = useState(w.start_time.slice(0, 5));
  const [end, setEnd] = useState(w.end_time.slice(0, 5));
  const [signalsQty, setSignalsQty] = useState(String(w.signals_qty ?? 10));
  const [maxLosses, setMaxLosses] = useState(String(w.max_losses ?? 0));
  const [martingale, setMartingale] = useState(String(w.martingale ?? 2));
  const [signalType, setSignalType] = useState(w.signal_type ?? "message");
  const [timeframes, setTimeframes] = useState<string[]>(w.timeframes ?? ["M1"]);
  const [days, setDays] = useState<number[]>(w.weekdays ?? []);
  const [useAll, setUseAll] = useState(w.use_all_assets ?? true);
  const [filter, setFilter] = useState<string[]>(w.asset_filter ?? []);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("room_windows").update({
        name,
        start_time: start,
        end_time: end,
        signals_qty: parseInt(signalsQty, 10) || 0,
        max_losses: parseInt(maxLosses, 10) || 0,
        martingale: parseInt(martingale, 10) || 0,
        signal_type: signalType,
        timeframes,
        weekdays: days,
        use_all_assets: useAll,
        asset_filter: filter,
      }).eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Janela salva"); qc.invalidateQueries({ queryKey: ["room_windows", roomId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("room_windows").delete().eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Janela removida"); qc.invalidateQueries({ queryKey: ["room_windows", roomId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runTest = useServerFn(testWindow);
  const test = useMutation({
    mutationFn: async () => runTest({ data: { windowId: w.id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Sinal de teste enviado: ${r.asset} ${r.direction === "buy" ? "🟢" : "🔴"}`);
      else toast.error(r.errors?.[0] ?? "Falha ao enviar teste");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleArr<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  return (
    <div className="border rounded-md p-4 space-y-4 bg-card/40">
      {/* Top row: Nome | Início | Fim | Qtd Sinais | Max Losses | Martingale | Tipo de Sinal | trash */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
        <div className="space-y-1 col-span-2 md:col-span-1">
          <Label className="text-xs">Nome da Sessão</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Início</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 text-center" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fim</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 text-center" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Qtd. Sinais</Label>
          <Input value={signalsQty} onChange={(e) => setSignalsQty(e.target.value)} className="h-9" inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max Losses (Stop Loss)</Label>
          <Input value={maxLosses} onChange={(e) => setMaxLosses(e.target.value)} className="h-9" inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Martingale</Label>
          <Select value={martingale} onValueChange={setMartingale}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 9 }, (_, i) => String(i + 1)).map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Tipo de Sinal</Label>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => del.mutate()} disabled={del.isPending}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
          <div className="flex items-center gap-3 h-9">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="radio" checked={signalType === "message"} onChange={() => setSignalType("message")} />
              Mensagem
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="radio" checked={signalType === "list"} onChange={() => setSignalType("list")} />
              Lista
            </label>
          </div>
        </div>
      </div>

      {/* Timeframes */}
      <div className="space-y-1.5">
        <Label className="text-xs">Timeframes</Label>
        <div className="flex flex-wrap gap-3">
          {TIMEFRAMES.map((tf) => (
            <label key={tf} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox
                checked={timeframes.includes(tf)}
                onCheckedChange={() => setTimeframes((p) => toggleArr(p, tf))}
              />
              {tf}
            </label>
          ))}
        </div>
      </div>

      {/* Weekdays */}
      <div className="space-y-1.5">
        <Label className="text-xs">Dias da Semana</Label>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((d) => (
            <label key={d.v} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox
                checked={days.includes(d.v)}
                onCheckedChange={() => setDays((p) => toggleArr(p, d.v).sort())}
              />
              {d.l}.
            </label>
          ))}
        </div>
      </div>

      {/* Use all assets */}
      <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
        <Checkbox checked={useAll} onCheckedChange={(v) => setUseAll(!!v)} />
        Usar Todos os Ativos
      </label>

      <WindowAssets selected={filter} setSelected={setFilter} roomId={roomId} windowId={w.id} useAll={useAll} setUseAll={setUseAll} />

      <div className="flex justify-end pt-2 border-t border-border">
        <Button
          size="sm"
          variant="outline"
          className="mr-2"
          onClick={() => test.mutate()}
          disabled={test.isPending}
        >
          {test.isPending ? "Enviando..." : "Testar sessão"}
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar janela"}
        </Button>
      </div>
    </div>
  );
}

/* Asset grid in 4 columns: Forex / Cripto / Ações / OTC */
function WindowAssets({
  selected, setSelected, roomId, windowId, useAll,
  setUseAll,
}: {
  selected: string[];
  setSelected: (v: string[]) => void;
  roomId: string;
  windowId: string;
  useAll: boolean;
  setUseAll: (v: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  // load per-asset open/payout from room_assets
  const assets = useQuery({
    queryKey: ["room_assets", roomId],
    queryFn: async () => {
      const { data } = await supabase.from("room_assets").select("asset_code, payout, is_open").eq("room_id", roomId);
      const map: Record<string, { payout: number; is_open: boolean }> = {};
      (data ?? []).forEach((a: any) => { map[a.asset_code] = { payout: Number(a.payout), is_open: a.is_open }; });
      return map;
    },
  });

  function toggle(code: string) {
    // Ao escolher manualmente, desliga "Usar Todos os Ativos" para fixar a seleção
    if (useAll) {
      setUseAll(false);
      setSelected([code]);
      return;
    }
    setSelected(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  const totalSelected = useAll ? "todos" : `${selected.length} selecionado${selected.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3 border rounded-md p-3 bg-background/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-medium">Ativos:</span>
          <Badge variant="outline" className="text-xs">{totalSelected}</Badge>
          {!collapsed && (
            <>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20">Aberto</Badge>
              <Badge variant="outline" className="text-muted-foreground">Fechado</Badge>
              <Badge className="bg-emerald-600/30 text-emerald-200 border-emerald-600/40">≥ 70%</Badge>
            </>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? (<><ChevronDown className="size-3.5 mr-1" />Mostrar ativos</>) : (<><ChevronUp className="size-3.5 mr-1" />Esconder ativos</>)}
        </Button>
      </div>

      {!collapsed && (
      <>
      <Input
        placeholder="Buscar ativo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(ASSETS_CATALOG) as AssetCategory[]).map((cat) => (
          <div key={cat} className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h4>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {ASSETS_CATALOG[cat]
                .filter((a) => a.toLowerCase().includes(search.toLowerCase()))
                .map((code) => {
                  const meta = assets.data?.[code];
                  const checked = selected.includes(code);
                  return (
                    <div key={code} className="flex items-center gap-2 text-xs">
                      <Checkbox checked={useAll ? false : checked} onCheckedChange={() => toggle(code)} />
                      <span className="flex-1 font-mono">{code}</span>
                      <Badge
                        variant={meta?.is_open === false ? "outline" : "default"}
                        className={meta?.is_open === false
                          ? "h-4 text-[10px] px-1.5"
                          : "h-4 text-[10px] px-1.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20"}
                      >
                        {meta?.is_open === false ? "Fechado" : "Aberto"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                        {meta ? `${(meta.payout * 100).toFixed(0)}%` : "—"}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        * Com "Usar Todos os Ativos" ligado, qualquer ativo é sorteado. Clique em um ativo para fixar a seleção manual.
      </p>
      </>
      )}
      {/* keep windowId referenced to satisfy noUnusedParams */}
      <input type="hidden" value={windowId} readOnly />
    </div>
  );
}

/* ============================================================ */
/* Timezone                                                      */
/* ============================================================ */

function TimezoneCard({ room }: { room: RoomData }) {
  const qc = useQueryClient();
  const [tz, setTz] = useState(room.timezone);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").update({ timezone: tz }).eq("id", room.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fuso salvo"); qc.invalidateQueries({ queryKey: ["room", room.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Fuso Horário</h2>
      <div className="max-w-md space-y-1.5">
        <Label className="text-xs">Selecione o Fuso Horário</Label>
        <Select value={tz} onValueChange={setTz}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((t) => (<SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Este fuso horário será usado para todos os horários da sala (sinais, sessões e mensagens agendadas).
          Os offsets UTC variam conforme horário de verão — configure os horários no horário <span className="font-semibold">local</span> do fuso escolhido.
        </p>
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar seção</Button>
      </div>
    </Card>
  );
}

/* ============================================================ */
/* Stop Loss                                                     */
/* ============================================================ */

function StopLossCard({ room }: { room: RoomData }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState(room.stop_loss_message ?? "🔴 *STOP LOSS ATINGIDO* 🔴");
  const sendTest = useServerFn(sendRoomTest);
  const [testing, setTesting] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").update({ stop_loss_message: msg }).eq("id", room.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mensagem de Stop Loss salva"); qc.invalidateQueries({ queryKey: ["room", room.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const onTest = async () => {
    try {
      setTesting(true);
      await sendTest({ data: { roomId: room.id, text: msg } });
      toast.success("Teste enviado");
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };
  return (
    <Card className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">Mensagem de Stop Loss</h2>
      <div className="space-y-1.5">
        <Label className="text-xs">Mensagem enviada quando o stop loss for atingido</Label>
        <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} />
        <p className="text-xs text-muted-foreground">
          Mensagem enviada ao grupo quando o stop loss for atingido. Deixe em branco para usar a mensagem padrão.
        </p>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onTest} disabled={testing}>📩 {testing ? "Enviando..." : "Enviar teste"}</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar seção</Button>
      </div>
    </Card>
  );
}

/* ============================================================ */
/* Market Tips                                                   */
/* ============================================================ */

function MarketTipsCard({ room }: { room: RoomData }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(room.market_tips_enabled ?? false);
  const sendTest = useServerFn(sendRoomTest);
  const [testing, setTesting] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").update({ market_tips_enabled: enabled }).eq("id", room.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dicas de Mercado salvas"); qc.invalidateQueries({ queryKey: ["room", room.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const onTest = async () => {
    try {
      setTesting(true);
      await sendTest({ data: { roomId: room.id, text: "📊 <b>Dica de Mercado (teste)</b>\nEsta é uma prévia das notícias e tendências que serão enviadas automaticamente ao grupo." } });
      toast.success("Teste enviado");
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };
  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">📊 Dicas de Mercado</h2>
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Forex / Crypto</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Envia automaticamente as <span className="font-semibold text-foreground">últimas notícias e tendências</span> do mercado financeiro
        para o grupo nos horários definidos. Escolha o <span className="font-semibold text-foreground">idioma</span> abaixo;
        as fontes RSS seguem o idioma (com fallback para inglês se necessário).
      </p>
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(!!v)} />
        <span className="text-sm">Habilitar envio de dicas de mercado</span>
      </label>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onTest} disabled={testing}>
          📩 {testing ? "Enviando..." : "Enviar teste"}
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar seção</Button>
      </div>
    </Card>
  );
}

/* ============================================================ */
/* Templates de Mensagem                                         */
/* ============================================================ */

type TemplateKind =
  | "signal" | "win" | "win_martingale" | "loss"
  | "buy_direction" | "sell_direction" | "entry" | "gain" | "event";

const SIGNAL_PLACEHOLDERS = {
  message: "🎯 SINAL: {ATIVO}\n⏱ {TIMEFRAME}\n📈 {DIRECAO}\n💰 Entrada: {ENTRADA}\n🔁 Gale 1: {ENTRADAGALE1}\n🔁 Gale 2: {ENTRADAGALE2}",
  list: "📋 LISTA DE SINAIS\n{LISTA_SINAIS}\n\nGerenciamento: {MARTINGALE} martingale(s)",
};

const RESULT_TEMPLATES: { kind: TemplateKind; title: string; placeholder: string; tone: string }[] = [
  { kind: "win", title: "Vitória", placeholder: "✅ VITÓRIA no {ATIVO} 🟢", tone: "GAIN" },
  { kind: "win_martingale", title: "Vitória Martingale", placeholder: "✅ VITÓRIA no martingale {ATIVO} 🟢", tone: "GAIN" },
  { kind: "loss", title: "Derrota", placeholder: "🔴 DERROTA no {ATIVO}", tone: "LOSS" },
];

const DIRECTION_TEMPLATES: { kind: TemplateKind; title: string; placeholder: string }[] = [
  { kind: "buy_direction", title: "Template de Compra", placeholder: "📈 COMPRA" },
  { kind: "sell_direction", title: "Template de Venda", placeholder: "📉 VENDA" },
];

function pickTemplate(list: any[] | undefined, kind: TemplateKind) {
  return list?.find((x: any) => x.kind === kind);
}

function TemplatesCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const tpls = useQuery({
    queryKey: ["room_templates", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_templates").select("*").eq("room_id", roomId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const btns = useQuery({
    queryKey: ["room_template_buttons", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_template_buttons").select("*").eq("room_id", roomId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["room_templates", roomId] });
    qc.invalidateQueries({ queryKey: ["room_template_buttons", roomId] });
  };
  const templates = tpls.data ?? [];
  const buttons = btns.data ?? [];
  const signalButtons = buttons.filter((b: any) => b.template_kind === "signal");

  return (
    <Card className="p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Templates de Mensagem</h2>
        <p className="text-xs text-muted-foreground">
          Use macros como <code>{`{ATIVO}, {TIMEFRAME}, {DIRECAO}, {ENTRADA}, {ENTRADAGALE1}, {ENTRADAGALE2}`}</code>.
        </p>
      </div>

      <Tabs defaultValue="message">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="message">Mensagem</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        {(["message", "list"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="pt-4 space-y-5">
            <TemplateEditor
              roomId={roomId}
              kind="signal"
              title="Template principal de Sinal"
              helper={tab === "message" ? "Formato enviado para cada sinal individual." : "Formato usado quando os sinais são enviados em lista."}
              placeholder={SIGNAL_PLACEHOLDERS[tab]}
              existing={pickTemplate(templates, "signal")}
              buttons={signalButtons}
              showButtonManager
              actionMode="full"
              rows={8}
              onChanged={refresh}
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {RESULT_TEMPLATES.map((item) => (
                <TemplateEditor
                  key={item.kind}
                  roomId={roomId}
                  kind={item.kind}
                  title={item.title}
                  placeholder={item.placeholder}
                  existing={pickTemplate(templates, item.kind)}
                  buttons={[]}
                  actionMode="test"
                  showImageTools
                  imageTone={item.tone}
                  rows={4}
                  onChanged={refresh}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {DIRECTION_TEMPLATES.map((item) => (
                <TemplateEditor
                  key={item.kind}
                  roomId={roomId}
                  kind={item.kind}
                  title={item.title}
                  placeholder={item.placeholder}
                  existing={pickTemplate(templates, item.kind)}
                  buttons={[]}
                  actionMode="test"
                  rows={3}
                  onChanged={refresh}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}

function TemplateEditor({
  roomId, kind, title, helper, placeholder, existing, buttons, onChanged,
  showButtonManager = false, showImageTools = false, imageTone = "GAIN", actionMode = "none", rows = 5,
}: {
  roomId: string;
  kind: TemplateKind;
  title?: string;
  helper?: string;
  placeholder: string;
  existing: any;
  buttons: any[];
  onChanged: () => void;
  showButtonManager?: boolean;
  showImageTools?: boolean;
  imageTone?: string;
  actionMode?: "full" | "test" | "none";
  rows?: number;
}) {
  const [content, setContent] = useState<string>(existing?.content ?? "");
  const [imagePath, setImagePath] = useState<string | null>(existing?.image_path ?? null);
  const [imageMime, setImageMime] = useState<string | null>(existing?.image_mime ?? null);
  const [imageExt, setImageExt] = useState<string | null>(existing?.image_ext ?? null);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const sendTest = useServerFn(sendRoomTest);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setContent(existing?.content ?? "");
    setImagePath(existing?.image_path ?? null);
    setImageMime(existing?.image_mime ?? null);
    setImageExt(existing?.image_ext ?? null);
  }, [existing?.id, existing?.content, existing?.image_path, existing?.image_mime, existing?.image_ext]);

  const saveTpl = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (existing) {
        const { error } = await supabase.from("room_templates")
          .update({ content, image_path: imagePath, image_mime: imageMime, image_ext: imageExt }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("room_templates").insert({
          room_id: roomId, user_id: u.user!.id, kind, content, parse_mode: "HTML", image_path: imagePath, image_mime: imageMime, image_ext: imageExt,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Template salvo"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBtn = useMutation({
    mutationFn: async () => {
      if (!newLabel.trim() || !newUrl.trim()) throw new Error("Preencha label e URL");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_template_buttons").insert({
        room_id: roomId, user_id: u.user!.id, template_kind: kind,
        label: newLabel.trim(), url: newUrl.trim(), sort_order: buttons.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewLabel(""); setNewUrl(""); toast.success("Botão adicionado"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delBtn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("room_template_buttons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Botão removido"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onTest = async () => {
    try {
      setTesting(true);
      await sendTest({ data: { roomId, text: content, imagePath: imagePath ?? undefined, imageMime: imageMime ?? undefined, imageExt: imageExt ?? undefined } });
      toast.success("Teste enviado");
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };

  return (
    <div className="border rounded-md p-4 space-y-4 bg-card/40">
      {(title || helper) && (
        <div className="space-y-1">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Conteúdo da mensagem</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-mono text-sm"
        />
      </div>

      {showImageTools && (
        <ImageAttachment
          tone={imageTone}
          roomId={roomId}
          value={{ path: imagePath, mime: imageMime, ext: imageExt }}
          onChange={(v) => { setImagePath(v.path); setImageMime(v.mime); setImageExt(v.ext); }}
        />
      )}

      {showButtonManager && <div className="space-y-2">
        <Label className="text-xs">Botões inline (opcional)</Label>
        {buttons.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum botão configurado.</p>
        )}
        {buttons.map((b: any) => (
          <div key={b.id} className="flex items-center gap-2 p-2 rounded-md border bg-background/40">
            <span className="text-sm font-medium flex-1">{b.label}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[40%]">{b.url}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => delBtn.mutate(b.id)} disabled={delBtn.isPending}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2 items-center">
          <Input className="h-9" placeholder="Texto do botão" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Input className="h-9" placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => addBtn.mutate()} disabled={addBtn.isPending}>
            <Plus className="size-4 mr-1" />Adicionar
          </Button>
        </div>
      </div>}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="flex flex-wrap gap-2">
          {actionMode === "full" && (
            <>
              <Button variant="secondary" size="sm" disabled><Smile className="size-4 mr-1" />Emojis</Button>
              <Button variant="outline" size="sm" onClick={() => setContent(placeholder)}><RotateCcw className="size-4 mr-1" />Restaurar</Button>
              <Button variant="secondary" size="sm" onClick={onTest} disabled={testing}>
                <Send className="size-4 mr-1" />{testing ? "Enviando..." : "Enviar teste"}
              </Button>
            </>
          )}
          {actionMode === "test" && (
            <Button variant="secondary" size="sm" onClick={onTest} disabled={testing}>
              <Send className="size-4 mr-1" />{testing ? "Enviando..." : "Enviar teste"}
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => saveTpl.mutate()} disabled={saveTpl.isPending}>
          {saveTpl.isPending ? "Salvando..." : "Salvar template"}
        </Button>
      </div>
    </div>
  );
}

function ImageAttachment({
  tone, roomId, value, onChange,
}: {
  tone: string;
  roomId: string;
  value: { path: string | null; mime?: string | null; ext?: string | null };
  onChange: (v: { path: string | null; mime: string | null; ext: string | null }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const publicUrl = value.path
    ? supabase.storage.from("room-images").getPublicUrl(value.path).data.publicUrl
    : null;

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${u.user.id}/${roomId}/templates/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("room-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      onChange({ path, mime: file.type || null, ext });
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Imagem</Label>
      <div className="rounded-md border border-dashed bg-background/50 p-3 space-y-3">
        <div className="min-h-24 rounded-md bg-muted/50 flex flex-col items-center justify-center text-muted-foreground overflow-hidden">
          {publicUrl ? (
            <img src={publicUrl} alt={`Preview ${tone}`} className="max-h-48 w-auto object-contain" />
          ) : (
            <>
              <ImageIcon className="size-6 mb-1" />
              <span className="text-xs font-semibold">Preview {tone}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => onChange({ path: null, mime: null, ext: null })} disabled={!value.path || uploading}>
            Remover arquivo
          </Button>
          <Button asChild size="sm" variant="secondary" disabled={uploading}>
            <label className="cursor-pointer">
              <Upload className="size-4 mr-1" />{uploading ? "Enviando..." : "Escolher arquivo"}
              <input
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/gif,image/webp,application/x-tgsticker,video/webm,.tgs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Mensagens de Sessão (abrir / fechar)                          */
/* ============================================================ */

function SessionMessagesCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["room_session_messages", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_session_messages").select("*").eq("room_id", roomId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const open = list.data?.find((m: any) => m.kind === "open");
  const close = list.data?.find((m: any) => m.kind === "close");
  const refresh = () => qc.invalidateQueries({ queryKey: ["room_session_messages", roomId] });

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Mensagens de Sessão</h2>
      <p className="text-xs text-muted-foreground">
        Mensagens automáticas enviadas antes da abertura e após o fechamento de cada janela de operação.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SessionMessageEditor roomId={roomId} kind="open" title="Abertura de Sessão" existing={open} onChanged={refresh} />
        <SessionMessageEditor roomId={roomId} kind="close" title="Fechamento de Sessão" existing={close} onChanged={refresh} />
      </div>
    </Card>
  );
}

function SessionMessageEditor({
  roomId, kind, title, existing, onChanged,
}: {
  roomId: string;
  kind: "open" | "close";
  title: string;
  existing: any;
  onChanged: () => void;
}) {
  const [content, setContent] = useState<string>(existing?.content ?? "");
  const [enabled, setEnabled] = useState<boolean>(existing?.enabled ?? true);
  const [lead, setLead] = useState<string>(String(existing?.lead_minutes ?? 5));
  const [imagePath, setImagePath] = useState<string | null>(existing?.image_path ?? null);
  const [imageMime, setImageMime] = useState<string | null>(existing?.image_mime ?? null);
  const [imageExt, setImageExt] = useState<string | null>(existing?.image_ext ?? null);
  const sendTest = useServerFn(sendRoomTest);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setContent(existing?.content ?? "");
    setEnabled(existing?.enabled ?? true);
    setLead(String(existing?.lead_minutes ?? 5));
    setImagePath(existing?.image_path ?? null);
    setImageMime(existing?.image_mime ?? null);
    setImageExt(existing?.image_ext ?? null);
  }, [existing?.id, existing?.content, existing?.enabled, existing?.lead_minutes, existing?.image_path, existing?.image_mime, existing?.image_ext]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        content,
        enabled,
        lead_minutes: parseInt(lead, 10) || 0,
        image_path: imagePath,
        image_mime: imageMime,
        image_ext: imageExt,
      };
      if (existing) {
        const { error } = await supabase.from("room_session_messages").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("room_session_messages").insert({
          ...payload, room_id: roomId, user_id: u.user!.id, kind,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(`${title} salva`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onTest = async () => {
    try {
      setTesting(true);
      await sendTest({ data: { roomId, text: content, imagePath: imagePath ?? undefined, imageMime: imageMime ?? undefined, imageExt: imageExt ?? undefined } });
      toast.success("Teste enviado");
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };

  return (
    <div className="border rounded-md p-4 space-y-3 bg-card/40">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-xs text-muted-foreground">{enabled ? "Ativa" : "Desativada"}</span>
        </label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{kind === "open" ? "Minutos antes da abertura" : "Minutos após o fechamento"}</Label>
        <Input value={lead} onChange={(e) => setLead(e.target.value)} className="h-9 max-w-[140px]" inputMode="numeric" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Conteúdo</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="font-mono text-sm"
          placeholder={kind === "open"
            ? "🚀 SESSÃO COMEÇA EM {MINUTOS} MIN!\nPrepare-se para os sinais!"
            : "🏁 SESSÃO ENCERRADA\nObrigado por operar conosco!"} />
      </div>
      <ImageAttachment
        tone={kind === "open" ? "INÍCIO" : "TÉRMINO"}
        roomId={roomId}
        value={{ path: imagePath, mime: imageMime, ext: imageExt }}
        onChange={(v) => { setImagePath(v.path); setImageMime(v.mime); setImageExt(v.ext); }}
      />
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onTest} disabled={testing}>
          <Send className="size-4 mr-1" />{testing ? "Enviando..." : "Enviar teste"}
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Relatório de Fim de Sessão                                    */
/* ============================================================ */

function ReportsCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const sendTest = useServerFn(sendRoomTest);
  const [testing, setTesting] = useState(false);
  const report = useQuery({
    queryKey: ["room_reports", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_reports").select("*").eq("room_id", roomId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const onTest = async () => {
    try {
      setTesting(true);
      const sample = (tpl || "📊 RELATÓRIO {SESSAO_NOME}\n✅ Wins: {TOTAL_WINS}\n🔴 Losses: {TOTAL_LOSSES}\n📈 Operações: {TOTAL_OPERACOES}\n🎯 Win rate: {WIN_RATE}%")
        .replaceAll("{SESSAO_NOME}", "Sessão Teste")
        .replaceAll("{TOTAL_WINS}", "7")
        .replaceAll("{TOTAL_LOSSES}", "3")
        .replaceAll("{TOTAL_OPERACOES}", "10")
        .replaceAll("{WIN_RATE}", "70");
      await sendTest({ data: { roomId, text: sample, imagePath: imagePath ?? undefined, imageMime: imageMime ?? undefined, imageExt: imageExt ?? undefined } });
      toast.success("Teste enviado");
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };

  const [enabled, setEnabled] = useState<boolean>(false);
  const [delay, setDelay] = useState<string>("1");
  const [tpl, setTpl] = useState<string>("");
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [imageExt, setImageExt] = useState<string | null>(null);

  useEffect(() => {
    if (!report.data) return;
    setEnabled(report.data.enabled);
    setDelay(String(report.data.delay_minutes ?? 1));
    setTpl(report.data.template ?? "");
    setIncludeStats(report.data.include_stats ?? true);
    setImagePath(report.data.image_path ?? null);
    setImageMime((report.data as any).image_mime ?? null);
    setImageExt((report.data as any).image_ext ?? null);
  }, [report.data?.id, report.data?.enabled, report.data?.delay_minutes, report.data?.template, report.data?.include_stats, report.data?.image_path, (report.data as any)?.image_mime, (report.data as any)?.image_ext]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        enabled,
        delay_minutes: parseInt(delay, 10) || 0,
        template: tpl,
        include_stats: includeStats,
        image_path: imagePath,
        image_mime: imageMime,
        image_ext: imageExt,
      };
      if (report.data) {
        const { error } = await supabase.from("room_reports").update(payload).eq("id", report.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("room_reports").insert({
          ...payload, room_id: roomId, user_id: u.user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Relatório salvo"); qc.invalidateQueries({ queryKey: ["room_reports", roomId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Relatório de Fim de Sessão</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-xs text-muted-foreground">{enabled ? "Ativo" : "Desativado"}</span>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Envia um resumo automático ao final de cada janela de operação.
        Macros disponíveis: <code>{`{SESSAO_NOME}, {TOTAL_WINS}, {TOTAL_LOSSES}, {WIN_RATE}, {TOTAL_OPERACOES}`}</code>.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Delay após fechamento (minutos)</Label>
          <Input value={delay} onChange={(e) => setDelay(e.target.value)} className="h-9" inputMode="numeric" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer w-fit self-end">
          <Checkbox checked={includeStats} onCheckedChange={(v) => setIncludeStats(!!v)} />
          <span className="text-sm">Incluir estatísticas (wins/losses/winrate)</span>
        </label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Template do relatório</Label>
        <Textarea value={tpl} onChange={(e) => setTpl(e.target.value)} rows={6} className="font-mono text-sm"
          placeholder={"📊 RELATÓRIO {SESSAO_NOME}\n✅ Wins: {TOTAL_WINS}\n🔴 Losses: {TOTAL_LOSSES}\n📈 Operações: {TOTAL_OPERACOES}\n🎯 Win rate: {WIN_RATE}%"} />
      </div>
      <ImageAttachment
        tone="RELATÓRIO"
        roomId={roomId}
        value={{ path: imagePath, mime: imageMime, ext: imageExt }}
        onChange={(v) => { setImagePath(v.path); setImageMime(v.mime); setImageExt(v.ext); }}
      />
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onTest} disabled={testing}>
          📩 {testing ? "Enviando..." : "Enviar teste"}
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar seção"}
        </Button>
      </div>
    </Card>
  );
}
