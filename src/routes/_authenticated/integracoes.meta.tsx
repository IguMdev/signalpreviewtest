import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMetaIntegration,
  upsertMetaIntegration,
  deleteMetaIntegration,
  sendMetaTestEvent,
  listMetaEventLogs,
} from "@/lib/meta-capi.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/integracoes/meta")({
  component: MetaIntegrationPage,
});

function MetaIntegrationPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMetaIntegration);
  const upsertFn = useServerFn(upsertMetaIntegration);
  const deleteFn = useServerFn(deleteMetaIntegration);
  const testFn = useServerFn(sendMetaTestEvent);
  const logsFn = useServerFn(listMetaEventLogs);

  const integ = useQuery({ queryKey: ["meta-integ"], queryFn: () => getFn() });
  const logs = useQuery({ queryKey: ["meta-logs"], queryFn: () => logsFn() });

  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (integ.data) {
      setPixelId(integ.data.pixel_id ?? "");
      setAccessToken(integ.data.access_token ?? "");
      setTestEventCode(integ.data.test_event_code ?? "");
      setIsActive(integ.data.is_active ?? true);
    }
  }, [integ.data]);

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { pixelId, accessToken, testEventCode: testEventCode || null, isActive } }),
    onSuccess: () => {
      toast.success("Integração salva");
      qc.invalidateQueries({ queryKey: ["meta-integ"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      toast.success("Integração removida");
      setPixelId(""); setAccessToken(""); setTestEventCode("");
      qc.invalidateQueries({ queryKey: ["meta-integ"] });
    },
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: () => {
      toast.success("Evento de teste enviado ao Meta");
      qc.invalidateQueries({ queryKey: ["meta-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Conectar Meta (Conversions API)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie eventos do Telegram (novos membros, vendas, leads) direto para o seu Pixel do Facebook/Instagram, atribuindo às suas campanhas de Ads.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Credenciais do Pixel
            {integ.data?.is_active && <Badge variant="default" className="gap-1"><CheckCircle2 className="size-3" />Ativo</Badge>}
          </CardTitle>
          <CardDescription>
            Obtenha em <a href="https://business.facebook.com/events_manager" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">Events Manager <ExternalLink className="size-3" /></a> → seu Pixel → Configurações → Conversions API → Gerar token de acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pixel ID</Label>
            <Input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="123456789012345" />
          </div>
          <div className="space-y-2">
            <Label>Access Token (CAPI)</Label>
            <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAB..." />
          </div>
          <div className="space-y-2">
            <Label>Test Event Code <span className="text-muted-foreground text-xs">(opcional, só pra debug)</span></Label>
            <Input value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} placeholder="TEST12345" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Integração ativa</p>
              <p className="text-xs text-muted-foreground">Quando desligado, nenhum evento é enviado ao Meta.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !pixelId || !accessToken}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending || !integ.data}>
              {test.isPending ? "Enviando..." : "Enviar evento de teste"}
            </Button>
            {integ.data && (
              <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos disparados automaticamente</CardTitle>
          <CardDescription>
            Estes eventos são enviados ao seu Pixel quando ocorrem na plataforma:
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between border-b pb-2"><span>Novo membro entra no grupo do Telegram</span><Badge variant="outline">CompleteRegistration</Badge></div>
          <div className="flex justify-between border-b pb-2"><span>Venda aprovada (Kirvano)</span><Badge variant="outline">Purchase</Badge></div>
          <div className="flex justify-between"><span>Cancelamento / reembolso</span><Badge variant="outline">Subscribe (canceled)</Badge></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos envios</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.data && logs.data.length > 0 ? (
            <div className="space-y-1 text-sm max-h-80 overflow-auto">
              {logs.data.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-b-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {l.ok ? <CheckCircle2 className="size-4 text-green-500 shrink-0" /> : <XCircle className="size-4 text-destructive shrink-0" />}
                    <span className="font-medium">{l.event_name}</span>
                    {l.error && <span className="text-xs text-muted-foreground truncate">{l.error}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum evento enviado ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
