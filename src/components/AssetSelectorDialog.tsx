import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ASSETS_CATALOG, DEFAULT_PAYOUT, type AssetCategory } from "@/lib/assets-catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Eraser } from "lucide-react";

type RoomAssetRow = {
  id?: string;
  asset_code: string;
  category: AssetCategory;
  payout: number;
  is_open: boolean;
};

type Props = {
  roomId: string | null;
  roomName?: string;
  onClose: () => void;
};

const TABS: (AssetCategory | "Todos")[] = ["Todos", "Forex", "Cripto", "Ações", "OTC"];

export function AssetSelectorDialog({ roomId, roomName, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Todos");
  const [state, setState] = useState<Record<string, RoomAssetRow>>({});
  const [bulkPayout, setBulkPayout] = useState<string>("");

  const existing = useQuery({
    queryKey: ["room-assets", roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from("room_assets")
        .select("id, asset_code, category, payout, is_open")
        .eq("room_id", roomId);
      if (error) throw error;
      return data as RoomAssetRow[];
    },
    enabled: !!roomId,
  });

  useEffect(() => {
    if (!existing.data) return;
    const map: Record<string, RoomAssetRow> = {};
    for (const row of existing.data) map[row.asset_code] = row;
    setState(map);
  }, [existing.data]);

  const allAssets = useMemo(() => {
    const list: { code: string; category: AssetCategory }[] = [];
    (Object.keys(ASSETS_CATALOG) as AssetCategory[]).forEach((cat) => {
      ASSETS_CATALOG[cat].forEach((code) => list.push({ code, category: cat }));
    });
    return list;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return allAssets.filter((a) => {
      if (tab !== "Todos" && a.category !== tab) return false;
      if (q && !a.code.includes(q)) return false;
      return true;
    });
  }, [allAssets, search, tab]);

  const grouped = useMemo(() => {
    const g: Record<AssetCategory, { code: string; category: AssetCategory }[]> = {
      Forex: [], Cripto: [], "Ações": [], OTC: [],
    };
    filtered.forEach((a) => g[a.category].push(a));
    return g;
  }, [filtered]);

  const selectedCount = Object.values(state).filter((r) => !!r).length;

  function toggle(code: string, category: AssetCategory) {
    setState((s) => {
      const next = { ...s };
      if (next[code]) delete next[code];
      else next[code] = { asset_code: code, category, payout: DEFAULT_PAYOUT, is_open: true };
      return next;
    });
  }

  function selectAllVisible() {
    setState((s) => {
      const next = { ...s };
      filtered.forEach((a) => {
        if (!next[a.code]) next[a.code] = { asset_code: a.code, category: a.category, payout: DEFAULT_PAYOUT, is_open: true };
      });
      return next;
    });
  }

  function clearAll() {
    setState({});
  }

  function applyBulkPayout() {
    const v = parseFloat(bulkPayout.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setState((s) => {
      const next: typeof s = {};
      for (const k of Object.keys(s)) next[k] = { ...s[k], payout: v };
      return next;
    });
    setBulkPayout("");
  }

  function setPayout(code: string, value: string) {
    const v = parseFloat(value.replace(",", "."));
    setState((s) => ({ ...s, [code]: { ...s[code], payout: isNaN(v) ? 0 : v } }));
  }

  function setOpen(code: string, open: boolean) {
    setState((s) => ({ ...s, [code]: { ...s[code], is_open: open } }));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!roomId || !user) return;
      const desired = Object.values(state);
      const desiredCodes = new Set(desired.map((d) => d.asset_code));
      const previousCodes = new Set((existing.data ?? []).map((d) => d.asset_code));

      const toDelete = [...previousCodes].filter((c) => !desiredCodes.has(c));
      if (toDelete.length) {
        const { error } = await supabase
          .from("room_assets")
          .delete()
          .eq("room_id", roomId)
          .in("asset_code", toDelete);
        if (error) throw error;
      }

      if (desired.length) {
        const rows = desired.map((d) => ({
          user_id: user.id,
          room_id: roomId,
          asset_code: d.asset_code,
          category: d.category,
          payout: d.payout,
          is_open: d.is_open,
        }));
        const { error } = await supabase
          .from("room_assets")
          .upsert(rows, { onConflict: "room_id,asset_code" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Ativos salvos");
      qc.invalidateQueries({ queryKey: ["room-assets", roomId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!roomId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Ativos {roomName ? `· ${roomName}` : ""}
            <Badge variant="secondary" className="ml-2">{selectedCount} selecionados</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ativo..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <Input
              value={bulkPayout}
              onChange={(e) => setBulkPayout(e.target.value)}
              placeholder="Payout %"
              className="w-24"
            />
            <Button size="sm" variant="secondary" onClick={applyBulkPayout} disabled={!bulkPayout}>
              Aplicar a todos
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={selectAllVisible}>Marcar visíveis</Button>
          <Button size="sm" variant="ghost" onClick={clearAll}>
            <Eraser className="size-4 mr-1" /> Limpar
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="self-start">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="flex-1 overflow-y-auto mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1">
              {(Object.keys(grouped) as AssetCategory[]).map((cat) =>
                grouped[cat].length === 0 ? null : (
                  <div key={cat} className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background py-1">
                      {cat}
                    </div>
                    {grouped[cat].map((a) => {
                      const sel = state[a.code];
                      return (
                        <div
                          key={a.code}
                          className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={!!sel}
                            onCheckedChange={() => toggle(a.code, a.category)}
                          />
                          <span className="text-sm flex-1 font-mono">{a.code}</span>
                          {sel && (
                            <>
                              <button
                                type="button"
                                onClick={() => setOpen(a.code, !sel.is_open)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  sel.is_open
                                    ? "bg-emerald-500/20 text-emerald-500"
                                    : "bg-destructive/20 text-destructive"
                                }`}
                              >
                                {sel.is_open ? "Aberto" : "Fechado"}
                              </button>
                              <Input
                                value={String(sel.payout)}
                                onChange={(e) => setPayout(a.code, e.target.value)}
                                className="h-6 w-14 text-xs px-1.5"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-sm text-muted-foreground py-10">
                  Nenhum ativo encontrado.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Salvando..." : "Salvar ativos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}