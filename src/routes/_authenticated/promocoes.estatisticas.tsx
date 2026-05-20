import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPromoStats, listPromoDispatches } from "@/lib/promo.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, MousePointerClick, ShoppingBag, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/promocoes/estatisticas")({
  component: PromoStatsPage,
});

function PromoStatsPage() {
  const stats = useServerFn(getPromoStats);
  const list = useServerFn(listPromoDispatches);

  const statsQ = useQuery({ queryKey: ["promo-stats"], queryFn: () => stats({ data: { days: 30 } }) });
  const listQ = useQuery({ queryKey: ["promo-dispatches"], queryFn: () => list({ data: { limit: 50 } }) });

  const s = statsQ.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estatísticas de Promoções</h1>
        <p className="text-sm text-muted-foreground">Últimos 30 dias.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<ShoppingBag className="size-5" />} label="Enviados" value={s?.sent ?? 0} />
        <Stat icon={<MousePointerClick className="size-5" />} label="Cliques" value={s?.clicks ?? 0} />
        <Stat icon={<TrendingUp className="size-5" />} label="Conversões" value={s?.conversions ?? 0} />
        <Stat icon={<DollarSign className="size-5" />} label="Comissão (R$)" value={(s?.commissionTotal ?? 0).toFixed(2)} />
      </div>

      {s && (
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Envios por loja</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(s.byStore).map(([k, v]) => (
              <Badge key={k} variant="secondary">{k}: {v}</Badge>
            ))}
            {Object.keys(s.byStore).length === 0 && <span className="text-xs text-muted-foreground">Nenhum envio ainda.</span>}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 text-sm font-medium border-b">Últimos envios</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(listQ.data?.dispatches ?? []).map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="text-xs">{new Date(d.sent_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell><Badge variant="secondary">{d.store}</Badge></TableCell>
                <TableCell className="font-mono text-xs truncate max-w-md">{d.external_id}</TableCell>
                <TableCell>{d.ok ? <Badge>OK</Badge> : <Badge variant="destructive">Erro</Badge>}</TableCell>
              </TableRow>
            ))}
            {listQ.data?.dispatches.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Sem envios ainda.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-2">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}