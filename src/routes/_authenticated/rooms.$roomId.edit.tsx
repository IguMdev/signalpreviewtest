import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Settings, Clock, CandlestickChart, MessageSquare, Image as ImageIcon,
  PlayCircle, BarChart3, Globe2, ShieldAlert,
} from "lucide-react";
import { AssetSelectorDialog } from "@/components/AssetSelectorDialog";

export const Route = createFileRoute("/_authenticated/rooms/$roomId/edit")({
  component: EditRoomPage,
});

type Section = "config" | "windows" | "assets" | "templates" | "images" | "session" | "reports" | "timezone" | "stoploss";

const SECTIONS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "config", label: "Configurações", icon: Settings },
  { key: "windows", label: "Janelas de Operação", icon: Clock },
  { key: "assets", label: "Ativos", icon: CandlestickChart },
  { key: "templates", label: "Templates de Mensagens", icon: MessageSquare },
  { key: "images", label: "Imagens GAIN/LOSS", icon: ImageIcon },
  { key: "session", label: "Mensagens de Sessão", icon: PlayCircle },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "timezone", label: "Fuso horário", icon: Globe2 },
  { key: "stoploss", label: "Stop Loss", icon: ShieldAlert },
];

const TIMEZONES = [
  "America/Sao_Paulo","America/Manaus","America/Bahia","America/Fortaleza",
  "America/Recife","America/Belem","America/Cuiaba","America/New_York",
  "America/Los_Angeles","Europe/Lisbon","Europe/London","UTC",
];

function EditRoomPage() {
  const { roomId } = useParams({ from: "/_authenticated/rooms/$roomId/edit" });
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("config");
  const [assetsOpen, setAssetsOpen] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/rooms"><ArrowLeft className="size-4 mr-1" />Voltar</Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{room.data?.name ?? "Sala"}</h1>
          <p className="text-xs text-muted-foreground">Editar configuração da sala</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <Card className="p-2 h-fit lg:sticky lg:top-4">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => key === "assets" ? setAssetsOpen(true) : setSection(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left whitespace-nowrap transition-colors ${
                  section === key && key !== "assets"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </Card>

        <div className="min-w-0">
          {section === "config" && room.data && <ConfigSection room={room.data} />}
          {section === "timezone" && room.data && <TimezoneSection room={room.data} />}
          {section === "stoploss" && room.data && <StopLossSection room={room.data} />}
          {section === "windows" && <PlaceholderSection title="Janelas de Operação" />}
          {section === "templates" && <PlaceholderSection title="Templates de Mensagens" />}
          {section === "images" && <PlaceholderSection title="Imagens GAIN / LOSS" />}
          {section === "session" && <PlaceholderSection title="Mensagens de Sessão" />}
          {section === "reports" && <PlaceholderSection title="Relatórios de fim de sessão" />}
        </div>
      </div>

      <AssetSelectorDialog
        roomId={assetsOpen ? roomId : null}
        roomName={room.data?.name}
        onClose={() => { setAssetsOpen(false); qc.invalidateQueries({ queryKey: ["room", roomId] }); }}
      />
    </div>
  );

  function PlaceholderSection({ title }: { title: string }) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">Esta seção será habilitada em breve.</p>
      </Card>
    );
  }
}

/* ============================================================ */
/* Config Section                                                */
/* ============================================================ */

type RoomData = {
  id: string;
  name: string;
  description: string | null;
  broker: string | null;
  welcome_message: string | null;
  default_account_id: string | null;
  timezone: string;
  stop_loss_enabled: boolean;
  stop_loss_value: number | null;
  room_chats: { id: string; chat_id: number; chat_title: string | null }[];
};

function ConfigSection({ room }: { room: RoomData }) {
  const qc = useQueryClient();
  const [name, setName] = useState(room.name);
  const [broker, setBroker] = useState(room.broker ?? "");
  const [welcome, setWelcome] = useState(room.welcome_message ?? "");
  const [accountId, setAccountId] = useState(room.default_account_id ?? "");
  const [chatId, setChatId] = useState(String(room.room_chats[0]?.chat_id ?? ""));
  const [chatTitle, setChatTitle] = useState(room.room_chats[0]?.chat_title ?? "");

  useEffect(() => {
    setName(room.name);
    setBroker(room.broker ?? "");
    setWelcome(room.welcome_message ?? "");
    setAccountId(room.default_account_id ?? "");
    setChatId(String(room.room_chats[0]?.chat_id ?? ""));
    setChatTitle(room.room_chats[0]?.chat_title ?? "");
  }, [room]);

  const accounts = useQuery({
    queryKey: ["telegram-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id, label");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").update({
        name,
        broker: broker || null,
        welcome_message: welcome || null,
        default_account_id: accountId || null,
      }).eq("id", room.id);
      if (error) throw error;

      const existing = room.room_chats[0];
      if (chatId) {
        const payload = { chat_id: Number(chatId), chat_title: chatTitle || null };
        if (existing) {
          const { error: e2 } = await supabase.from("room_chats").update(payload).eq("id", existing.id);
          if (e2) throw e2;
        } else {
          const { data: u } = await supabase.auth.getUser();
          const { error: e2 } = await supabase.from("room_chats").insert({ ...payload, room_id: room.id, user_id: u.user!.id });
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["room", room.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Configurações</h2>
        <p className="text-xs text-muted-foreground">Dados básicos da sala.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Título da sala</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Corretora</Label>
          <Input value={broker} onChange={(e) => setBroker(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Conta Telegram (Bot)</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Escolha um bot" /></SelectTrigger>
            <SelectContent>
              {accounts.data?.map((a) => (<SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>ID do grupo / canal</Label>
          <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234..." />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Nome do grupo (apelido)</Label>
          <Input value={chatTitle} onChange={(e) => setChatTitle(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Mensagem de boas-vindas</Label>
          <Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={4} />
        </div>
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar seção"}
        </Button>
      </div>
    </Card>
  );
}

/* ============================================================ */
/* Timezone                                                      */
/* ============================================================ */

function TimezoneSection({ room }: { room: RoomData }) {
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
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Fuso horário</h2>
        <p className="text-xs text-muted-foreground">Define o fuso usado nos horários de envio.</p>
      </div>
      <div className="max-w-sm space-y-2">
        <Label>Timezone</Label>
        <Select value={tz} onValueChange={setTz}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar seção</Button>
      </div>
    </Card>
  );
}

/* ============================================================ */
/* Stop Loss                                                     */
/* ============================================================ */

function StopLossSection({ room }: { room: RoomData }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(room.stop_loss_enabled);
  const [value, setValue] = useState<string>(room.stop_loss_value !== null ? String(room.stop_loss_value) : "");
  const save = useMutation({
    mutationFn: async () => {
      const v = parseFloat(value.replace(",", "."));
      const { error } = await supabase.from("rooms").update({
        stop_loss_enabled: enabled,
        stop_loss_value: isNaN(v) ? null : v,
      }).eq("id", room.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Stop Loss salvo"); qc.invalidateQueries({ queryKey: ["room", room.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Stop Loss</h2>
        <p className="text-xs text-muted-foreground">Limite de perdas consecutivas — encerra a sessão automaticamente.</p>
      </div>
      <div className="flex items-center justify-between p-3 rounded-md bg-muted/40">
        <Label className="font-medium">Ativar Stop Loss</Label>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {enabled && (
        <div className="max-w-xs space-y-2">
          <Label>Limite (perdas seguidas)</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="3" inputMode="decimal" />
        </div>
      )}
      <div className="flex justify-end pt-2 border-t border-border">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar seção</Button>
      </div>
    </Card>
  );
}