import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Plus, Trash2, Users, Pencil, FileText, CalendarClock, Search, RefreshCw, Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms/")({
  component: RoomsPage,
});

type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  broker: string | null;
  is_active: boolean;
  expires_at: string | null;
  default_account_id: string | null;
  telegram_accounts: { id: string; label: string; bot_first_name: string | null; bot_username: string | null } | null;
  room_chats: { id: string; chat_id: number; chat_title: string | null }[];
};

function RoomsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  // Wizard step 1 fields
  const [chatIdInput, setChatIdInput] = useState("");
  const [chatTitleInput, setChatTitleInput] = useState("");
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [welcome, setWelcome] = useState("");

  const accounts = useQuery({
    queryKey: ["telegram-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("telegram_accounts")
        .select("id, label, bot_first_name, bot_username");
      return data ?? [];
    },
  });

  const rooms = useQuery({
    queryKey: ["rooms-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select(
          "id, name, description, photo_url, broker, is_active, expires_at, default_account_id, telegram_accounts:default_account_id(id, label, bot_first_name, bot_username), room_chats(id, chat_id, chat_title)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as RoomRow[];
    },
  });

  function resetWizard() {
    setChatIdInput(""); setChatTitleInput(""); setName(""); setBroker(""); setAccountId(""); setWelcome("");
  }

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: room, error } = await supabase
        .from("rooms")
        .insert({
          user_id: user!.id,
          name,
          broker: broker || null,
          welcome_message: welcome || null,
          default_account_id: accountId || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (chatIdInput) {
        const { error: e2 } = await supabase.from("room_chats").insert({
          room_id: room.id,
          user_id: user!.id,
          chat_id: Number(chatIdInput),
          chat_title: chatTitleInput || null,
        });
        if (e2) throw e2;
      }
      return room.id as string;
    },
    onSuccess: (roomId) => {
      toast.success("Sala criada — continue a configuração");
      setOpen(false);
      resetWizard();
      qc.invalidateQueries({ queryKey: ["rooms-list"] });
      navigate({ to: "/rooms/$roomId/edit", params: { roomId: roomId! } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms-list"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async (r: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("rooms").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms-list"] }),
  });

  const renew = useMutation({
    mutationFn: async (id: string) => {
      const next = new Date();
      next.setDate(next.getDate() + 30);
      const { error } = await supabase.from("rooms").update({ expires_at: next.toISOString(), is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sala renovada por 30 dias");
      qc.invalidateQueries({ queryKey: ["rooms-list"] });
    },
  });

  const filtered = (rooms.data ?? []).filter((r) => {
    if (filter === "active" && !r.is_active) return false;
    if (filter === "inactive" && r.is_active) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} sala(s) — gerencie seus grupos de sinais.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Adicionar sala</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova sala — informações básicas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>ID do grupo / canal</Label>
                  <Input value={chatIdInput} onChange={(e) => setChatIdInput(e.target.value)} placeholder="-1001234..." />
                </div>
                <div className="space-y-2">
                  <Label>Nome do grupo</Label>
                  <Input value={chatTitleInput} onChange={(e) => setChatTitleInput(e.target.value)} placeholder="opcional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Título da sala</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sinais VIP — Manhã" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Corretora</Label>
                  <Input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Ex: Quotex" />
                </div>
                <div className="space-y-2">
                  <Label>Conta Telegram</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Escolha o bot" /></SelectTrigger>
                    <SelectContent>
                      {accounts.data?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensagem de boas-vindas</Label>
                <Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} placeholder="Mensagem enviada ao iniciar a sessão" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMut.mutate()} disabled={!name || createMut.isPending}>
                {createMut.isPending ? "Criando..." : "Próximo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar sala..." className="pl-8" />
        </div>
        <div className="flex gap-1">
          {(["all","active","inactive"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "Todas" : f === "active" ? "Ativas" : "Inativas"}
            </Button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Users className="size-8 mx-auto mb-2 opacity-50" />
            Nenhuma sala. Clique em "Adicionar sala" para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bot</TableHead>
                <TableHead>Conta Telegram</TableHead>
                <TableHead>Sala</TableHead>
                <TableHead>ID grupo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const acc = r.telegram_accounts;
                const chat = r.room_chats?.[0];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {acc?.bot_username ? `@${acc.bot_username}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{acc?.label ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        {r.photo_url ? (
                          <img src={r.photo_url} alt="" className="size-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Users className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{r.name}</div>
                          {r.broker && <div className="text-xs text-muted-foreground truncate">{r.broker}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{chat?.chat_id ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {r.expires_at ? (
                        <Badge variant={new Date(r.expires_at) < new Date() ? "destructive" : "secondary"}>
                          {fmtDate(r.expires_at)}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <Switch checked={r.is_active} onCheckedChange={() => toggleActive.mutate(r)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" title="Editar">
                          <Link to="/rooms/$roomId/edit" params={{ roomId: r.id }}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" title="Logs" disabled>
                          <FileText className="size-4" />
                        </Button>
                        <Button asChild size="sm" variant="ghost" title="Agendados">
                          <Link to="/mensagens"><CalendarClock className="size-4" /></Link>
                        </Button>
                        <Button size="sm" variant="ghost" title={r.is_active ? "Desativar" : "Ativar"} onClick={() => toggleActive.mutate(r)}>
                          <Power className={`size-4 ${r.is_active ? "text-emerald-500" : "text-muted-foreground"}`} />
                        </Button>
                        <Button size="sm" variant="ghost" title="Renovar +30 dias" onClick={() => renew.mutate(r.id)}>
                          <RefreshCw className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Excluir" onClick={() => { if (confirm(`Excluir "${r.name}"?`)) delMut.mutate(r.id); }}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}