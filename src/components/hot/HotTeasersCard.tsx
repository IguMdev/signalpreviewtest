import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export function HotTeasersCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["hot-teasers", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hot_teasers" as any)
        .select("*")
        .eq("room_id", roomId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("hot_teasers" as any).insert({
        user_id: u.user!.id,
        room_id: roomId,
        caption,
        image_path: imageUrl || null,
        sort_order: (q.data?.length ?? 0),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setCaption(""); setImageUrl("");
      qc.invalidateQueries({ queryKey: ["hot-teasers", roomId] });
      toast.success("Prévia adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hot_teasers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hot-teasers", roomId] }),
  });

  const toggle = useMutation({
    mutationFn: async (t: any) => {
      const { error } = await supabase.from("hot_teasers" as any).update({ is_active: !t.is_active }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hot-teasers", roomId] }),
  });

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="size-5 text-primary" /> Prévias Agendadas
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Mídias rotacionadas que o bot envia no grupo free a cada intervalo definido no Funil VIP.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Legenda</Label>
          <Textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Texto da prévia (com CTA pro VIP)" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL da imagem/vídeo (opcional)</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>
        <Button onClick={() => add.mutate()} disabled={!caption || add.isPending}>
          <Plus className="size-4 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {q.data?.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border rounded-md p-3 text-sm">
            {t.image_path && <img src={t.image_path} alt="" className="size-12 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="truncate">{t.caption}</div>
              <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                {t.is_active ? "ativo" : "inativo"}
              </Badge>
            </div>
            <Switch checked={t.is_active} onCheckedChange={() => toggle.mutate(t)} />
            <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma prévia cadastrada ainda.</p>}
      </div>
    </Card>
  );
}