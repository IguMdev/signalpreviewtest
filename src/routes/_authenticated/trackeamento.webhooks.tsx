import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Copy, Link as LinkIcon, CheckCircle2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { testNativeWebhook } from "@/lib/tracking.functions";

export const Route = createFileRoute("/_authenticated/trackeamento/webhooks")({
  component: WebhooksPage,
});

const PLATFORMS = [
  "Hotmart", "Kiwify", "Cakto", "Appmax", "PerfectPay", "Wiven", 
  "Kirvano", "IronPay", "GGCheckout", "Wiapy", "Greenn", "Lastlink", "GoatPay"
];

function WebhooksPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedPixelId, setSelectedPixelId] = useState<string>("");
  const testFn = useServerFn(testNativeWebhook);
  const [isTesting, setIsTesting] = useState(false);

  const { data: pixels = [] } = useQuery({
    queryKey: ["tracking-pixels-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tracking_pixels").select("id, name, postback_secret").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedPixel = pixels.find(p => p.id === selectedPixelId);
  const baseHost = typeof window !== "undefined" ? window.location.origin : "https://telesignal.com.br";
  
  const generatedUrl = selectedPlatform && selectedPixel 
    ? `${baseHost}/api/public/webhook/${selectedPlatform.toLowerCase()}/${selectedPixel.id}?token=${selectedPixel.postback_secret}`
    : "";

  const handleTest = async () => {
    if (!generatedUrl || !selectedPixel || !selectedPlatform) return;
    setIsTesting(true);
    try {
      await testFn({ pixel_id: selectedPixel.id, webhook_url: generatedUrl, platform: selectedPlatform });
      toast.success("Teste enviado! Verifique as Métricas do seu pixel, deve aparecer uma Venda Fictícia de 97,50.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao testar webhook.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Webhooks (Integrações Nativas)</h1>
        <p className="text-muted-foreground">
          Gere URLs de Webhook específicas para cada plataforma de pagamento.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecione uma plataforma para começar</CardTitle>
          <CardDescription>O Telesignal já traduz automaticamente os eventos das plataformas abaixo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map(p => (
              <Button
                key={p}
                variant={selectedPlatform === p ? "default" : "outline"}
                className={`min-w-[120px] transition-all ${selectedPlatform === p ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                onClick={() => setSelectedPlatform(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedPlatform && (
        <Card className="border-primary/50 shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="size-5 text-primary" />
              Configurar Integração com {selectedPlatform}
            </CardTitle>
            <CardDescription>
              Siga os passos abaixo para conectar o Telesignal à sua conta da {selectedPlatform}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 max-w-md">
              <Label>Selecione o Pixel de Destino</Label>
              <Select value={selectedPixelId} onValueChange={setSelectedPixelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um Pixel..." />
                </SelectTrigger>
                <SelectContent>
                  {pixels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {generatedUrl && (
              <div className="space-y-3 p-4 bg-muted/30 border rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-1 w-full">
                    <p className="font-medium text-sm">URL do Webhook Gerada</p>
                    <p className="text-xs text-muted-foreground">
                      Copie a URL abaixo e cole nas configurações de Webhook/Postback dentro da {selectedPlatform}.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 bg-background border p-2 rounded text-xs font-mono break-all text-primary">
                        {generatedUrl}
                      </code>
                      <Button
                        size="sm"
                        className="shrink-0 gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedUrl);
                          toast.success("URL copiada com sucesso!");
                        }}
                      >
                        <Copy className="size-4" /> Copiar
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground">
                    Quer saber se está funcionando? Faça um disparo simulado para essa URL.
                  </p>
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto gap-2" onClick={handleTest} disabled={isTesting}>
                    <PlayCircle className="size-4" />
                    {isTesting ? "Testando..." : "Testar Integração"}
                  </Button>
                </div>
              </div>
            )}
            
            {!generatedUrl && (
              <p className="text-sm text-muted-foreground italic">
                Selecione um pixel acima para gerar a URL.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
