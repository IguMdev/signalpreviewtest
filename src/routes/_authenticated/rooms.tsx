import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
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
import { Plus, Trash2, Users, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms")({
  component: RoomsPage,
});

function RoomsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [editing, setEditing] = useState<string | null>(null);
  const [chatId, setChatId] = useState("");
  const [chatTitle, setChatTitle] = useState("");

  const accounts = useQuery({
    queryKey: ["telegram-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id, label");
      return data ?? [];
    },
  });

  const rooms = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*, room_chats(id, chat_id, chat_title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").insert({
        user_id: user!.id,
        name,
        description: desc || null,
        default_account_id: accountId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo criado");
      setOpen(false);
      setName("");
      setDesc("");
      setAccountId("");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const addChat = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("room_chats").insert({
        room_id: editing,
        user_id: user!.id,
        chat_id: Number(chatId),
        chat_title: chatTitle || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setChatId("");
      setChatTitle("");
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeChat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("room_chats").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grupos</h1>
          <p className="text-sm text-muted-foreground">Listas de destinos para enviar sinais.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Novo grupo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo grupo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Conta padrão</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma conta" /></SelectTrigger>
                  <SelectContent>
                    {accounts.data?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMut.mutate()} disabled={!name}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {rooms.data?.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground text-sm">
            <Users className="size-8 mx-auto mb-2 opacity-50" />
            Crie seu primeiro grupo de destinos.
          </Card>
        )}
        {rooms.data?.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{r.name}</h3>
                {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  {r.room_chats?.length ?? 0} destinos
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(editing === r.id ? null : r.id)}>
                <Settings2 className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => delMut.mutate(r.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>

            {editing === r.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Chat ID (-1001234...)"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                  />
                  <Input
                    placeholder="Nome (opcional)"
                    value={chatTitle}
                    onChange={(e) => setChatTitle(e.target.value)}
                  />
                  <Button onClick={() => addChat.mutate()} disabled={!chatId}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {r.room_chats?.map((c: { id: string; chat_id: number; chat_title: string | null }) => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                      <span>{c.chat_title ?? c.chat_id}</span>
                      <Button size="sm" variant="ghost" onClick={() => removeChat.mutate(c.id)}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}