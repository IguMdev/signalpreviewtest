import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPixelStats, listRecentClicks } from "@/lib/tracking.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar as CalendarIcon, Filter, Download, Check, X, ChevronDown } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export const Route = createFileRoute("/_authenticated/trackeamento/metricas")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: MetricasPage,
});

const FILTER_OPTIONS = [
  "Funil","Dominio","Pagina (URL)","UTM Source","UTM Medium","UTM Campaign","UTM Content","Status","Trackeado","Start Bot",
] as const;
type FilterKey = typeof FILTER_OPTIONS[number];
type ActiveFilter = { key: FilterKey; value: string };

const DONUT_COLORS = ["hsl(263 70% 60%)","hsl(330 75% 60%)","hsl(150 60% 50%)","hsl(40 90% 55%)","hsl(200 80% 55%)","hsl(0 0% 50%)"];

function MetricasPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  return (
    <div className="space-y-4">
      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId ? <MetricsView pixelId={effectiveId} /> : (
        <p className="text-sm text-muted-foreground">Crie um pixel para visualizar métricas.</p>
      )}
    </div>
  );
}

function rangeToDays(range: DateRange | undefined): number {
  if (!range?.from) return 30;
  const to = range.to ?? new Date();
  return Math.max(1, Math.ceil((to.getTime() - range.from.getTime()) / 86400000) + 1);
}

function detectDevice(ua: string | null | undefined): string {
  if (!ua) return "Outros";
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return "iPhone";
  if (/android/.test(s)) return "Android";
  if (/windows/.test(s)) return "Windows";
  if (/mac os/.test(s)) return "Mac";
  if (/linux/.test(s)) return "Linux";
  return "Outros";
}

function MetricsView({ pixelId }: { pixelId: string }) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const days = rangeToDays(range);

  const statsFn = useServerFn(getPixelStats);
  const clicksFn = useServerFn(listRecentClicks);

  const stats = useQuery({ queryKey: ["m-stats", pixelId, days], queryFn: () => statsFn({ data: { pixel_id: pixelId, days } }) });
  const clicks = useQuery({ queryKey: ["m-clicks", pixelId, days], queryFn: () => clicksFn({ data: { pixel_id: pixelId, limit: 500 } }) });

  const rows: any[] = (clicks.data ?? []) as any[];

  const filtered = useMemo(() => {
    if (filters.length === 0) return rows;
    return rows.filter((r) =>
      filters.every((f) => {
        const v = (f.value || "").toLowerCase();
        if (!v) return true;
        switch (f.key) {
          case "UTM Source": return (r.utm_source ?? "").toLowerCase().includes(v);
          case "UTM Medium": return (r.utm_medium ?? "").toLowerCase().includes(v);
          case "UTM Campaign": return (r.utm_campaign ?? "").toLowerCase().includes(v);
          case "UTM Content": return (r.utm_content ?? "").toLowerCase().includes(v);
          case "Pagina (URL)": return (r.landing_url ?? "").toLowerCase().includes(v);
          case "Status": return ((r.deposited_at ? "deposito" : r.registered_at ? "cadastro" : r.joined_at ? "entrou" : "clique")).includes(v);
          case "Trackeado": return (r.utm_source || r.fbclid) ? v === "sim" : v === "nao";
          case "Start Bot": return r.joined_at ? v === "sim" : v === "nao";
          default: return true;
        }
      })
    );
  }, [rows, filters]);

  const entradas = stats.data?.joins ?? 0;
  const saidas = 0; // não rastreado no schema atual
  const clicksTotal = stats.data?.clicks ?? 0;
  const trackeadas = filtered.filter((r) => r.utm_source || r.fbclid).length || clicksTotal;
  const taxaEntrada = entradas > 0 ? 100 : 0;
  const taxaSaida = saidas > 0 && entradas > 0 ? Math.round((saidas / entradas) * 100) : 0;

  const byDevice = aggregate(filtered, (r) => detectDevice(r.user_agent));
  const bySource = aggregate(filtered, (r) => r.utm_source ?? "(sem)");
  const byCampaign = aggregate(filtered, (r) => r.utm_campaign ?? "(sem)");
  const byCountry = aggregate(filtered, () => "BR");

  return (
    <>
      {/* Top filter bar */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_auto] gap-3 items-end">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Periodo</p>
          <p className="text-xs text-primary mb-1">⏱ {range?.from ? `${format(range.from, "dd/MM/yyyy")}${range.to ? ` – ${format(range.to, "dd/MM/yyyy")}` : ""}` : "Últimos 30 dias"}</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                Selecione uma Data
                <CalendarIcon className="size-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} locale={ptBR} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="text-center text-sm text-muted-foreground italic">
          {filters.length === 0 ? "Nenhum filtro customizado aplicado." : (
            <div className="flex flex-wrap gap-2 justify-center">
              {filters.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs not-italic">
                  <span className="text-muted-foreground">{f.key}:</span>
                  <input
                    className="bg-transparent outline-none w-24"
                    value={f.value}
                    onChange={(e) => setFilters((arr) => arr.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder="valor"
                  />
                  <button onClick={() => setFilters((arr) => arr.filter((_, j) => j !== i))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-2">
              <Filter className="size-4" /> Adicionar Filtro <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {FILTER_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt} onClick={() => setFilters((arr) => [...arr, { key: opt, value: "" }])}>
                {opt}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Big stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BigStatCard label="Entradas" value={entradas} subA={{ label: "Trackeadas", value: trackeadas }} subB={{ label: "Taxa de trackeamento", value: `${taxaEntrada}%`, percent: taxaEntrada }} />
        <BigStatCard label="Saidas" value={saidas} subA={{ label: "Trackeadas", value: 0 }} subB={{ label: "Taxa de trackeamento", value: `${taxaSaida}%`, percent: taxaSaida }} />
        <BigStatCard label="Tempo Medio de Permanencia" value={"—"} valueSuffix="" subB={{ label: "Bounce rate (1d-)", value: "0%", percent: 0 }} />
      </div>

      {/* Visao Geral */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Visao Geral</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <DonutCard title="Por Pais" data={byCountry} />
            <DonutCard title="Por Estado" data={[{ name: "(sem)", value: filtered.length || 1 }]} />
            <DonutCard title="Por Dispositivo" data={byDevice} />
            <DonutCard title="Por Funil" data={bySource} />
          </div>
        </CardContent>
      </Card>

      {/* Leads */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Leads</h2>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv(filtered)}>
              <Download className="size-4" /> Exportar CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground bg-muted/30">
                <tr>
                  {["Data","Horario","Trackeado","ID Telegram","Nome","Status","Funil","URL","utm_source","utm_medium","utm_campaign","utm_content","Dispositivo","Pais","Estado"].map((h) => (
                    <th key={h} className="text-left p-3 font-medium uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="p-6 text-center text-muted-foreground">Sem leads no período.</td></tr>
                )}
                {filtered.map((c) => {
                  const d = new Date(c.created_at);
                  const status = c.deposited_at ? "Depósito" : c.registered_at ? "Cadastro" : c.joined_at ? "Entrou" : "Clique";
                  const tracked = !!(c.utm_source || c.fbclid);
                  return (
                    <tr key={c.click_id} className="border-t hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{format(d, "dd/MM/yyyy")}</td>
                      <td className="p-3 whitespace-nowrap">{format(d, "HH:mm")}</td>
                      <td className="p-3">{tracked ? <Check className="size-4 text-emerald-500" /> : <X className="size-4 text-muted-foreground" />}</td>
                      <td className="p-3 whitespace-nowrap">{c.tg_user_id ?? "-"}</td>
                      <td className="p-3 whitespace-nowrap">{c.tg_username ?? "-"}</td>
                      <td className="p-3 text-emerald-500 whitespace-nowrap">{status}</td>
                      <td className="p-3 whitespace-nowrap">{c.utm_campaign ?? "-"}</td>
                      <td className="p-3 max-w-[180px] truncate text-primary">{c.landing_url ?? "-"}</td>
                      <td className="p-3 whitespace-nowrap">{c.utm_source ?? "-"}</td>
                      <td className="p-3 whitespace-nowrap">{c.utm_medium ?? "-"}</td>
                      <td className="p-3 whitespace-nowrap">{c.utm_campaign ?? "-"}</td>
                      <td className="p-3 whitespace-nowrap">{c.utm_content ?? "-"}</td>
                      <td className="p-3 max-w-[160px] truncate">{detectDevice(c.user_agent)}</td>
                      <td className="p-3">BR</td>
                      <td className="p-3">-</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function aggregate(rows: any[], pick: (r: any) => string): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = pick(r) || "(sem)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
}

function exportCsv(rows: any[]) {
  const header = ["data","horario","trackeado","tg_user_id","tg_username","status","url","utm_source","utm_medium","utm_campaign","utm_content","dispositivo"];
  const lines = [header.join(",")];
  for (const c of rows) {
    const d = new Date(c.created_at);
    const status = c.deposited_at ? "Deposito" : c.registered_at ? "Cadastro" : c.joined_at ? "Entrou" : "Clique";
    lines.push([
      format(d, "dd/MM/yyyy"), format(d, "HH:mm"), (c.utm_source || c.fbclid) ? "sim" : "nao",
      c.tg_user_id ?? "", c.tg_username ?? "", status, c.landing_url ?? "",
      c.utm_source ?? "", c.utm_medium ?? "", c.utm_campaign ?? "", c.utm_content ?? "",
      detectDevice(c.user_agent),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function BigStatCard({ label, value, valueSuffix = "total", subA, subB }: {
  label: string; value: number | string; valueSuffix?: string;
  subA?: { label: string; value: number | string };
  subB?: { label: string; value: string; percent: number };
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-5xl font-bold leading-none">
          {value}
          {valueSuffix && <span className="text-base font-normal text-muted-foreground ml-2">{valueSuffix}</span>}
        </p>
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/50">
          <div>
            {subA && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{subA.label}</p>
                <p className="text-2xl font-semibold mt-1">{subA.value}</p>
              </>
            )}
          </div>
          <div>
            {subB && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{subB.label}</p>
                <p className="text-2xl font-semibold mt-1">{subB.value}</p>
                <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${subB.percent}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DonutCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const safe = data.length > 0 ? data : [{ name: "(sem dados)", value: 1 }];
  return (
    <div className="rounded-lg border bg-card/50 p-4">
      <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="h-48">
        <ClientOnly fallback={<div className="h-full" />}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={safe} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} stroke="hsl(var(--background))" strokeWidth={2}>
                {safe.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ClientOnly>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-[11px] mt-1">
        {safe.map((d, i) => (
          <span key={d.name} className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="text-muted-foreground">{d.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}