import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { toast } from "sonner";

export function HotVipFunnelCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["hot-vip-funnel", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hot_vip_funnel" as any)
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [price, setPrice] = useState("");
  const [interval, setInterval] = useState(3);
  const [cta, setCta] = useState("Entrar no VIP 🔥");
  const [welcome, setWelcome] = useState("");

  useEffect(() => {
    if (!q.data) return;
    setEnabled(!!q.data.enabled);
    setCheckoutUrl(q.data.vip_checkout_url ?? "");
    setPrice(q.data.vip_price_brl?.toString() ?? "");
    setInterval(q.data.teaser_interval_hours ?? 3);
    setCta(q.data.cta_button_text ?? "Entrar no VIP 🔥");
    setWelcome(q.data.welcome_message ?? "");
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        room_id: roomId,
        user_id: u.user!.id,
        enabled,
        vip_checkout_url: checkoutUrl || null,
        vip_price_brl: price ? Number(price) : null,
        teaser_interval_hours: interval,
        cta_button_text: cta,
        welcome_message: welcome || null,
      };
      const { error } = await supabase
        .from("hot_vip_funnel" as any)
        .upsert(payload as any, { onConflict: "room_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Funil VIP salvo");
      qc.invalidateQueries({ queryKey: ["hot-vip-funnel", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Crown className="size-5 text-primary" /> Funil VIP (free → pago)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Empurra membros do grupo gratuito para o checkout do VIP via prévias agendadas + welcome bot.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">URL do checkout VIP</Label>
          <Input value={checkoutUrl} onChange={(e) => setCheckoutUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Preço VIP (R$)</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29.90" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Intervalo entre prévias (h)</Label>
          <Input type="number" min={1} max={48} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Texto do botão CTA</Label>
          <Input value={cta} onChange={(e) => setCta(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Mensagem de boas-vindas (free)</Label>
        <Textarea rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} placeholder="Bem-vinda(o)! Aqui é a prévia. Para o conteúdo completo entre no VIP 🔥" />
      </div>
      <div className="flex justify-end pt-2 border-t">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar funil VIP"}
        </Button>
      </div>
    </Card>
  );
}