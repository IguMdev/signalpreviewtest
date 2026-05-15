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
  META_EVENT_OPTIONS,
  type MetaEventOption,
} from "@/lib/meta-capi.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [joinEvent, setJoinEvent] = useState<MetaEventOption>("CompleteRegistration");
  const [leaveEvent, setLeaveEvent] = useState<MetaEventOption>("off");
  const [kickedEvent, setKickedEvent] = useState<MetaEventOption>("off");

  useEffect(() => {
    if (integ.data) {
      setPixelId(integ.data.pixel_id ?? "");
      setAccessToken(integ.data.access_token ?? "");
      setTestEventCode(integ.data.test_event_code ?? "");
      setIsActive(integ.data.is_active ?? true);
      const m = (integ.data.event_mappings ?? {}) as Record<string, string>;
      setJoinEvent((m.join as MetaEventOption) ?? "CompleteRegistration");
      setLeaveEvent((m.leave as MetaEventOption) ?? "off");
      setKickedEvent((m.kicked as MetaEventOption) ?? "off");
    }
  }, [integ.data]);

  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      pixelId, accessToken, testEventCode: testEventCode || null, isActive,
      eventMappings: { join: joinEvent, leave: leaveEvent, kicked: kickedEvent },
    } }),
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
            Escolha qual evento padrão do Meta enviar para cada acontecimento no Telegram. Selecione "Desativado" para não enviar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EventMappingRow
            label="Novo membro entra no grupo / canal"
            description="Disparado quando alguém entra em um grupo ou canal monitorado pelo bot."
            value={joinEvent}
            onChange={setJoinEvent}
          />
          <EventMappingRow
            label="Membro sai do grupo / canal"
            description="Disparado quando alguém sai voluntariamente."
            value={leaveEvent}
            onChange={setLeaveEvent}
          />
          <EventMappingRow
            label="Membro removido / banido"
            description="Disparado quando um membro é expulso ou banido."
            value={kickedEvent}
            onChange={setKickedEvent}
          />
          <p className="text-xs text-muted-foreground">
            Lembre de clicar em <strong>Salvar</strong> acima após alterar.
          </p>
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

function EventMappingRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: MetaEventOption;
  onChange: (v: MetaEventOption) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Select value={value} onValueChange={(v) => onChange(v as MetaEventOption)}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {META_EVENT_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt === "off" ? "Desativado" : opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
