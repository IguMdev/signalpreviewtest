import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Search, Play, Square, Pencil, Trash2, Home, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/premium-emojis")({
  component: PremiumEmojisPage,
});

function PremiumEmojisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<string>("");
  const [capturing, setCapturing] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmojiId, setEditEmojiId] = useState("");

  const accounts = useQuery({
    queryKey: ["telegram-accounts", "premium"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_accounts")
        .select("id, label, phone")
        .eq("account_type", "premium");
      if (error) throw error;
      return data;
    },
  });

  const list = useQuery({
    queryKey: ["emojis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premium_emojis")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("premium_emojis")
        .update({ name: editName, custom_emoji_id: editEmojiId })
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Emoji atualizado");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["emojis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("premium_emojis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Emoji removido");
      qc.invalidateQueries({ queryKey: ["emojis"] });
    },
  });

  const filtered = useMemo(() => {
    if (!list.data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return list.data;
    return list.data.filter((e) => e.name.toLowerCase().includes(q));
  }, [list.data, search]);

  const startEdit = (e: { id: string; name: string; custom_emoji_id: string }) => {
    setEditingId(e.id);
    setEditName(e.name);
    setEditEmojiId(e.custom_emoji_id);
  };

  const startCapture = () => {
    if (!accountId) {
      toast.error("Selecione uma conta premium");
      return;
    }
    setCapturing(true);
    toast.info("Captura iniciada. Envie emojis premium na conta selecionada.");
  };

  const stopCapture = () => {
    setCapturing(false);
    toast.success("Captura parada");
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="size-4" />
        <span>Trading</span>
        <ChevronRight className="size-4" />
        <Sparkles className="size-4 text-amber-400" />
        <span>Emojis Premium</span>
      </div>

      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-7 text-amber-400" />
          Emojis Premium
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seus emojis premium do Telegram com nomenclaturas personalizadas
        </p>
      </div>

      {/* Captura automática */}
      <Card className="p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="size-11 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shrink-0">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Captura Automática de Emojis</h2>
            <p className="text-sm text-muted-foreground">
              Capture emojis premium diretamente das suas contas do Telegram
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Conta Premium do Telegram</label>
          <div className="flex gap-2">
            <Select value={accountId} onValueChange={setAccountId} disabled={capturing}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione uma conta premium..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.data?.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Nenhuma conta premium cadastrada
                  </div>
                )}
                {accounts.data?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label} {a.phone ? `(${a.phone})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={startCapture} disabled={capturing} className="gap-2">
              <Play className="size-4" />
              Iniciar Captura
            </Button>
            <Button onClick={stopCapture} disabled={!capturing} variant="secondary" className="gap-2">
              <Square className="size-4" />
              Parar Captura
            </Button>
          </div>
        </div>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nomenclatura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[100px_1fr_2fr_180px_100px] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Emoji</div>
          <div>Nomenclatura</div>
          <div>ID Telegram</div>
          <div>Criado</div>
          <div className="text-right">Ações</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Sparkles className="size-8 mx-auto mb-2 opacity-40" />
            Nenhum emoji encontrado.
          </div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[100px_1fr_2fr_180px_100px] gap-4 px-6 py-3 border-b border-border last:border-0 items-center hover:bg-muted/20"
            >
              <div className="text-3xl">{e.preview_char ?? "✨"}</div>
              <div>
                {editingId === e.id ? (
                  <Input
                    value={editName}
                    onChange={(ev) => setEditName(ev.target.value)}
                    className="h-8"
                  />
                ) : (
                  <code className="px-2 py-1 rounded bg-muted/50 text-sm font-mono">
                    {`{${e.name}}`}
                  </code>
                )}
              </div>
              <div>
                {editingId === e.id ? (
                  <Input
                    value={editEmojiId}
                    onChange={(ev) => setEditEmojiId(ev.target.value)}
                    className="h-8 font-mono text-sm"
                  />
                ) : (
                  <code className="block px-3 py-1.5 rounded bg-muted/50 text-sm font-mono truncate">
                    {e.custom_emoji_id}
                  </code>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
              </div>
              <div className="flex justify-end gap-1">
                {editingId === e.id ? (
                  <>
                    <Button size="sm" onClick={() => updateMut.mutate()}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      ✕
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(e)}>
                      <Pencil className="size-4 text-blue-400" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => delMut.mutate(e.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
