import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/premium-emojis")({
  component: PremiumEmojisPage,
});

function PremiumEmojisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emojiId, setEmojiId] = useState("");
  const [preview, setPreview] = useState("");

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

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("premium_emojis").insert({
        user_id: user!.id,
        name,
        custom_emoji_id: emojiId,
        preview_char: preview || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Emoji adicionado");
      setOpen(false);
      setName("");
      setEmojiId("");
      setPreview("");
      qc.invalidateQueries({ queryKey: ["emojis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("premium_emojis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emojis"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emojis Premium</h1>
          <p className="text-sm text-muted-foreground">Cadastre custom_emoji_id para usar em mensagens.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Novo emoji
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo emoji premium</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: foguete_dourado" />
              </div>
              <div className="space-y-2">
                <Label>Custom Emoji ID</Label>
                <Input value={emojiId} onChange={(e) => setEmojiId(e.target.value)} placeholder="5123456789012345678" />
              </div>
              <div className="space-y-2">
                <Label>Caractere de prévia (opcional)</Label>
                <Input value={preview} onChange={(e) => setPreview(e.target.value)} placeholder="🚀" maxLength={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMut.mutate()} disabled={!name || !emojiId}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.data?.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground text-sm col-span-full">
            <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
            Nenhum emoji cadastrado.
          </Card>
        )}
        {list.data?.map((e) => {
          const tag = `<tg-emoji emoji-id="${e.custom_emoji_id}">${e.preview_char ?? "✨"}</tg-emoji>`;
          return (
            <Card key={e.id} className="p-4 flex items-center gap-3">
              <div className="text-3xl">{e.preview_char ?? "✨"}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{e.name}</p>
                <p className="text-xs text-muted-foreground truncate">{e.custom_emoji_id}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(tag);
                  toast.success("HTML copiado");
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => delMut.mutate(e.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}