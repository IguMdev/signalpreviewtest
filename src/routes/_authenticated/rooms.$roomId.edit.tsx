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
  PlayCircle, BarChart3, Globe2, ShieldAlert, Plus, Trash2,
} from "lucide-react";
import { AssetSelectorDialog } from "@/components/AssetSelectorDialog";
import { ASSETS_CATALOG } from "@/lib/assets-catalog";
import { Badge } from "@/components/ui/badge";

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
          {section === "windows" && <WindowsSection roomId={roomId} />}
          {section === "templates" && <TemplatesSection roomId={roomId} />}
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
/* ============================================================ */
/* Windows Section                                              */
/* ============================================================ */

const WEEKDAYS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" },
  { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

type Window = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  asset_filter: string[];
  is_active: boolean;
};

function WindowsSection({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["room_windows", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_windows").select("*").eq("room_id", roomId)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as Window[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_windows").insert({
        room_id: roomId,
        user_id: u.user!.id,
        name: "Nova janela",
        start_time: "09:00",
        end_time: "17:00",
        weekdays: [1, 2, 3, 4, 5],
        asset_filter: [],
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela criada");
      qc.invalidateQueries({ queryKey: ["room_windows", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Janelas de Operação</h2>
          <p className="text-xs text-muted-foreground">
            Defina horários, dias e ativos permitidos para envio de sinais.
          </p>
        </div>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4 mr-1" />Nova janela
        </Button>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {list.data?.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
          Nenhuma janela cadastrada.
        </div>
      )}

      <div className="space-y-3">
        {list.data?.map((w) => (
          <WindowRow key={w.id} window={w} roomId={roomId} />
        ))}
      </div>
    </Card>
  );
}

function WindowRow({ window: w, roomId }: { window: Window; roomId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(w.name);
  const [start, setStart] = useState(w.start_time.slice(0, 5));
  const [end, setEnd] = useState(w.end_time.slice(0, 5));
  const [days, setDays] = useState<number[]>(w.weekdays);
  const [assets, setAssets] = useState<string[]>(w.asset_filter);
  const [active, setActive] = useState(w.is_active);
  const [showAssets, setShowAssets] = useState(false);

  const allAssets = Object.values(ASSETS_CATALOG).flat();

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("room_windows").update({
        name, start_time: start, end_time: end,
        weekdays: days, asset_filter: assets, is_active: active,
      }).eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela salva");
      qc.invalidateQueries({ queryKey: ["room_windows", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("room_windows").delete().eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela removida");
      qc.invalidateQueries({ queryKey: ["room_windows", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  }
  function toggleAsset(a: string) {
    setAssets((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  return (
    <div className="border rounded-md p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs font-medium" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Ativa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <Button variant="ghost" size="icon" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Início</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fim</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Dias da semana</Label>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d.v}
              type="button"
              onClick={() => toggleDay(d.v)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                days.includes(d.v)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >{d.l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Ativos permitidos {assets.length === 0 && <span className="text-muted-foreground">(todos)</span>}</Label>
          <Button variant="outline" size="sm" onClick={() => setShowAssets((s) => !s)}>
            {showAssets ? "Fechar" : "Editar filtro"}
          </Button>
        </div>
        {assets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assets.map((a) => (
              <Badge key={a} variant="secondary" className="cursor-pointer" onClick={() => toggleAsset(a)}>
                {a} ×
              </Badge>
            ))}
          </div>
        )}
        {showAssets && (
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 grid grid-cols-3 sm:grid-cols-5 gap-1">
            {allAssets.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAsset(a)}
                className={`px-2 py-1 text-xs rounded border ${
                  assets.includes(a)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >{a}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar janela"}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Templates Section                                            */
/* ============================================================ */

type TemplateKind = "entry" | "gain" | "loss" | "event";
const TEMPLATE_DEFS: { kind: TemplateKind; label: string; hint: string }[] = [
  { kind: "entry", label: "Entrada", hint: "Mensagem enviada quando um sinal é gerado." },
  { kind: "gain",  label: "GAIN",    hint: "Mensagem enviada quando o sinal resulta em ganho." },
  { kind: "loss",  label: "LOSS",    hint: "Mensagem enviada quando o sinal resulta em perda." },
  { kind: "event", label: "Evento",  hint: "Mensagem para eventos especiais (ex: news, mhi)." },
];

function TemplatesSection({ roomId }: { roomId: string }) {
  const list = useQuery({
    queryKey: ["room_templates", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_templates").select("*").eq("room_id", roomId);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Templates de Mensagens</h2>
        <p className="text-xs text-muted-foreground">
          Use variáveis como {"{ativo}"}, {"{direcao}"}, {"{horario}"}, {"{payout}"}.
        </p>
      </div>
      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {list.data && (
        <div className="space-y-4">
          {TEMPLATE_DEFS.map((def) => {
            const existing = list.data.find((t) => t.kind === def.kind);
            return (
              <TemplateRow
                key={def.kind}
                roomId={roomId}
                def={def}
                existing={existing as { id: string; content: string; parse_mode: string } | undefined}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function TemplateRow({
  roomId, def, existing,
}: {
  roomId: string;
  def: { kind: TemplateKind; label: string; hint: string };
  existing?: { id: string; content: string; parse_mode: string };
}) {
  const qc = useQueryClient();
  const [content, setContent] = useState(existing?.content ?? "");
  const [parseMode, setParseMode] = useState(existing?.parse_mode ?? "HTML");

  useEffect(() => {
    setContent(existing?.content ?? "");
    setParseMode(existing?.parse_mode ?? "HTML");
  }, [existing?.id, existing?.content, existing?.parse_mode]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_templates").upsert({
        room_id: roomId,
        user_id: u.user!.id,
        kind: def.kind,
        content,
        parse_mode: parseMode,
      }, { onConflict: "room_id,kind" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Template ${def.label} salvo`);
      qc.invalidateQueries({ queryKey: ["room_templates", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border rounded-md p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-sm">{def.label}</div>
          <p className="text-xs text-muted-foreground">{def.hint}</p>
        </div>
        <Select value={parseMode} onValueChange={setParseMode}>
          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="HTML">HTML</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="None">Texto puro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder={`Conteúdo do template ${def.label}...`}
        className="font-mono text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar template"}
        </Button>
      </div>
    </div>
  );
}
