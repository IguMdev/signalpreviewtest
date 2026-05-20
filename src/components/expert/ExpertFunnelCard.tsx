import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

export function ExpertFunnelCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["expert-funnel", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expert_funnel" as any)
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [productName, setProductName] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [price, setPrice] = useState("");
  const [cta, setCta] = useState("Quero participar 🎓");
  const [welcome, setWelcome] = useState("");

  useEffect(() => {
    if (!q.data) return;
    setEnabled(!!q.data.enabled);
    setProductName(q.data.product_name ?? "");
    setCheckoutUrl(q.data.checkout_url ?? "");
    setPrice(q.data.price_brl?.toString() ?? "");
    setCta(q.data.cta_button_text ?? "Quero participar 🎓");
    setWelcome(q.data.welcome_message ?? "");
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("expert_funnel" as any)
        .upsert(
          {
            room_id: roomId,
            user_id: u.user!.id,
            enabled,
            product_name: productName || null,
            checkout_url: checkoutUrl || null,
            price_brl: price ? Number(price) : null,
            cta_button_text: cta,
            welcome_message: welcome || null,
          } as any,
          { onConflict: "room_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Funil de mentoria salvo");
      qc.invalidateQueries({ queryKey: ["expert-funnel", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" /> Funil de Mentoria / Curso
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            CTA recorrente para o checkout do seu produto (mentoria, curso, comunidade paga).
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome do produto</Label>
          <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Mentoria Trader 360" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL do checkout</Label>
          <Input value={checkoutUrl} onChange={(e) => setCheckoutUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Preço (R$)</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="497.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Texto do botão CTA</Label>
          <Input value={cta} onChange={(e) => setCta(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Mensagem de boas-vindas</Label>
        <Textarea rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} />
      </div>
      <div className="flex justify-end pt-2 border-t">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar funil"}
        </Button>
      </div>
    </Card>
  );
}