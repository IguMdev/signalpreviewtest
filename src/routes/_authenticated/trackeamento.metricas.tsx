import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPixelStats, listRecentClicks, getAttribution } from "@/lib/tracking.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart3, MousePointerClick, UserPlus, LogIn, DollarSign } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/metricas")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: MetricasPage,
});

function MetricasPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="size-6" /> Métricas</h1>
        <p className="text-sm text-muted-foreground mt-1">Funil completo e atribuição por UTM.</p>
      </div>
      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId && <MetricsView pixelId={effectiveId} />}
    </div>
  );
}

function MetricsView({ pixelId }: { pixelId: string }) {
  const [days, setDays] = useState(30);
  const [groupCol, setGroupCol] = useState<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term">("utm_source");

  const statsFn = useServerFn(getPixelStats);
  const clicksFn = useServerFn(listRecentClicks);
  const attrFn = useServerFn(getAttribution);

  const stats = useQuery({ queryKey: ["stats", pixelId, days], queryFn: () => statsFn({ data: { pixel_id: pixelId, days } }) });
  const clicks = useQuery({ queryKey: ["clicks", pixelId], queryFn: () => clicksFn({ data: { pixel_id: pixelId, limit: 50 } }) });
  const attr = useQuery({ queryKey: ["attr", pixelId, groupCol, days], queryFn: () => attrFn({ data: { pixel_id: pixelId, group_col: groupCol, days } }) });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 justify-end">
        <Label className="text-sm">Período:</Label>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<MousePointerClick className="size-4" />} label="Cliques" value={stats.data?.clicks ?? 0} />
        <StatCard icon={<LogIn className="size-4" />} label="Entradas bot" value={stats.data?.joins ?? 0} />
        <StatCard icon={<MousePointerClick className="size-4" />} label="Cliques oferta" value={stats.data?.offerClicks ?? 0} />
        <StatCard icon={<UserPlus className="size-4" />} label="Cadastros" value={stats.data?.registers ?? 0} />
        <StatCard icon={<DollarSign className="size-4" />} label="Depósitos" value={stats.data?.deposits ?? 0} sub={`R$ ${(stats.data?.revenue ?? 0).toFixed(2)}`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Atribuição</CardTitle>
          <Select value={groupCol} onValueChange={(v) => setGroupCol(v as never)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="utm_source">utm_source</SelectItem>
              <SelectItem value="utm_medium">utm_medium</SelectItem>
              <SelectItem value="utm_campaign">utm_campaign</SelectItem>
              <SelectItem value="utm_content">utm_content</SelectItem>
              <SelectItem value="utm_term">utm_term</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {attr.data && attr.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2">{groupCol}</th>
                    <th className="text-right">Cliques</th>
                    <th className="text-right">Entradas</th>
                    <th className="text-right">Ofertas</th>
                    <th className="text-right">Cadastros</th>
                    <th className="text-right">Depósitos</th>
                    <th className="text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {attr.data.map((r: any) => (
                    <tr key={r.dimension} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs truncate max-w-[200px]">{r.dimension}</td>
                      <td className="text-right">{r.clicks}</td>
                      <td className="text-right">{r.joins}</td>
                      <td className="text-right">{r.offer_clicks}</td>
                      <td className="text-right">{r.registers}</td>
                      <td className="text-right">{r.deposits}</td>
                      <td className="text-right">R$ {Number(r.revenue).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos cliques</CardTitle></CardHeader>
        <CardContent>
          {clicks.data && clicks.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2">Data</th>
                    <th className="text-left">click_id</th>
                    <th className="text-left">Fonte</th>
                    <th className="text-left">Campanha</th>
                    <th className="text-left">Estágio</th>
                  </tr>
                </thead>
                <tbody>
                  {clicks.data.map((c: any) => {
                    const stage = c.deposited_at ? "Depósito" : c.registered_at ? "Cadastro" : c.clicked_offer_at ? "Oferta" : c.joined_at ? "Bot" : "Clique";
                    return (
                      <tr key={c.click_id} className="border-b last:border-0">
                        <td className="py-2">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                        <td className="font-mono">{c.click_id}</td>
                        <td>{c.utm_source ?? "-"}</td>
                        <td>{c.utm_campaign ?? "-"}</td>
                        <td><Badge variant="outline">{stage}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem cliques registrados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}