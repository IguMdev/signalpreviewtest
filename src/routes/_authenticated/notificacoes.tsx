import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPushSettings, updatePushSettings, PushSettings } from "@/lib/webpush.server";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { WebPushButton } from "@/components/WebPushButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getSettingsFn = useServerFn(getPushSettings);
  const updateSettingsFn = useServerFn(updatePushSettings);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["push_settings", user?.id],
    enabled: !!user,
    queryFn: () => getSettingsFn(),
  });

  const [form, setForm] = useState<PushSettings>({
    sales_pending: false,
    sales_approved: true,
    sale_value: "total",
    show_product: false,
    show_utm: false,
    show_dashboard: true,
    report_times: [],
    report_style: "profit",
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const updateMut = useMutation({
    mutationFn: async (newData: PushSettings) => {
      await updateSettingsFn({ data: newData });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["push_settings"] });
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const handleChange = (key: keyof PushSettings, value: any) => {
    const newData = { ...form, [key]: value };
    setForm(newData);
    updateMut.mutate(newData);
  };

  const handleTimeToggle = (time: string, checked: boolean) => {
    const times = new Set(form.report_times);
    if (checked) times.add(time);
    else times.delete(time);
    handleChange("report_times", Array.from(times));
  };

  if (isLoading) return <div className="p-4 text-muted-foreground">Carregando configurações...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
        <p className="text-muted-foreground">
          Configure as notificações de vendas e de relatório da sua conta.
        </p>
      </div>

      <div className="mb-6">
        <WebPushButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna 1: Notificações de Venda */}
        <div className="space-y-6">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Notificações de Venda</CardTitle>
              <p className="text-sm text-muted-foreground">Seja notificado no app sempre que for realizada uma nova venda:</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <h3 className="font-semibold text-lg">Opções</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Enviar vendas pendentes</Label>
                  <Select value={form.sales_pending ? "enabled" : "disabled"} onValueChange={(v) => handleChange("sales_pending", v === "enabled")}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Habilitado</SelectItem>
                      <SelectItem value="disabled">Desabilitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Enviar vendas aprovadas</Label>
                  <Select value={form.sales_approved ? "enabled" : "disabled"} onValueChange={(v) => handleChange("sales_approved", v === "enabled")}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Habilitado</SelectItem>
                      <SelectItem value="disabled">Desabilitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor da venda</Label>
                  <Select value={form.sale_value} onValueChange={(v) => handleChange("sale_value", v)}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="hide">Esconder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nome do produto</Label>
                  <Select value={form.show_product ? "show" : "hide"} onValueChange={(v) => handleChange("show_product", v === "show")}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="show">Mostrar</SelectItem>
                      <SelectItem value="hide">Esconder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor de utm_campaign</Label>
                  <Select value={form.show_utm ? "show" : "hide"} onValueChange={(v) => handleChange("show_utm", v === "show")}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="show">Mostrar</SelectItem>
                      <SelectItem value="hide">Esconder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nome do dashboard</Label>
                  <Select value={form.show_dashboard ? "show" : "hide"} onValueChange={(v) => handleChange("show_dashboard", v === "show")}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="show">Mostrar</SelectItem>
                      <SelectItem value="hide">Esconder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Prévia de Notificação</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/public/wiven/webhook", {
                          method: "POST",
                          body: JSON.stringify({ action: "TEST_PUSH", userId: user?.id })
                        });
                        if (res.ok) toast.success("Notificação enviada! Olhe seu celular.");
                      } catch (e) {
                        toast.error("Erro ao testar");
                      }
                    }}
                  >
                    Testar Notificação
                  </Button>
                </div>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex items-start gap-4 shadow-xl">
                  <div className="shrink-0 size-10 bg-black rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden">
                    <img src="/push-icon.jpg" alt="logo" className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1 text-sm text-zinc-100">
                    <p className="font-semibold text-white text-base">
                      Venda aprovada! {form.show_dashboard && "| igu.ads"}
                    </p>
                    {form.show_product && <p className="text-zinc-300">Nome do Produto Aqui</p>}
                    <div className="flex flex-col gap-0.5 text-zinc-400">
                      {form.sale_value === "total" && <span>Valor: R$ 99,90</span>}
                      {form.show_utm && <span>UTM: nome_da_campanha</span>}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 2: Notificações de Relatório */}
        <div className="space-y-6">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle>Notificações de Relatório</CardTitle>
              <p className="text-sm text-muted-foreground">Configure as notificações de relatório que quer visualizar:</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <h3 className="font-semibold text-lg">Horários</h3>
              
              <div className="space-y-4">
                {["08:00", "12:00", "18:00", "23:00"].map((time) => (
                  <div key={time} className="flex items-center justify-between">
                    <Label className="text-base font-normal">Notificação das {time}</Label>
                    <Switch 
                      checked={form.report_times.includes(time)}
                      onCheckedChange={(c) => handleTimeToggle(time, c)}
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-4">
                <h3 className="font-semibold text-lg">Padrão de Notificação</h3>
                <RadioGroup value={form.report_style} onValueChange={(v) => handleChange("report_style", v as any)}>
                  <div className="space-y-3">
                    <Label className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-white/5 cursor-pointer transition">
                      <RadioGroupItem value="profit" />
                      Status de Lucro
                    </Label>
                    <Label className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-white/5 cursor-pointer transition">
                      <RadioGroupItem value="summary" />
                      Resumo Detalhado
                    </Label>
                    <Label className="flex items-center gap-3 p-4 rounded-lg border border-primary/50 bg-primary/10 hover:bg-primary/20 cursor-pointer transition">
                      <RadioGroupItem value="creative" />
                      Notificações Criativas
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="pt-4 space-y-4">
                <h3 className="font-semibold text-lg">Prévia de Notificação</h3>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex items-start gap-4 shadow-xl">
                  <div className="shrink-0 size-10 bg-black rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden">
                    <img src="/push-icon.jpg" alt="logo" className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1 text-sm text-zinc-100">
                    {form.report_style === "creative" && (
                      <>
                        <p className="font-semibold text-white text-base">Dois reais ou um lucro misterioso?</p>
                        <p className="text-zinc-400">Parabéns! Você teve R$ 149,43 de lucro até agora... 🤑</p>
                      </>
                    )}
                    {form.report_style === "profit" && (
                      <>
                        <p className="font-semibold text-white text-base">Status de Lucro Diário</p>
                        <p className="text-zinc-400">Você já lucrou R$ 149,43 hoje.</p>
                      </>
                    )}
                    {form.report_style === "summary" && (
                      <>
                        <p className="font-semibold text-white text-base">Resumo do dia</p>
                        <p className="text-zinc-400">Vendas: 12 | Lucro: R$ 149,43 | ROI: 45%</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
