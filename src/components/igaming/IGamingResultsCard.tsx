import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";

export function IGamingResultsCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["igaming-results", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("igaming_results" as any)
        .select("*")
        .eq("room_id", roomId)
        .order("confirmed_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const log = useMutation({
    mutationFn: async (result: "win" | "loss" | "gale_win") => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("igaming_results" as any).insert({
        user_id: u.user!.id,
        room_id: roomId,
        result,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igaming-results", roomId] });
      toast.success("Resultado registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = (q.data ?? []).reduce(
    (acc: any, r: any) => {
      acc.total += 1;
      if (r.result === "win") acc.win += 1;
      else if (r.result === "gale_win") acc.gale += 1;
      else acc.loss += 1;
      return acc;
    },
    { total: 0, win: 0, gale: 0, loss: 0 },
  );
  const assertRate = stats.total ? Math.round(((stats.win + stats.gale) / stats.total) * 100) : 0;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" /> Resultados ao Vivo
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Registre GREEN/RED dos sinais enviados. Estatística aparece no relatório da sala.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-md border p-2">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-[10px] text-muted-foreground">Total</div>
        </div>
        <div className="rounded-md border p-2 text-emerald-500">
          <div className="text-2xl font-bold">{stats.win}</div>
          <div className="text-[10px] text-muted-foreground">Win</div>
        </div>
        <div className="rounded-md border p-2 text-amber-500">
          <div className="text-2xl font-bold">{stats.gale}</div>
          <div className="text-[10px] text-muted-foreground">Gale</div>
        </div>
        <div className="rounded-md border p-2 text-destructive">
          <div className="text-2xl font-bold">{stats.loss}</div>
          <div className="text-[10px] text-muted-foreground">Loss</div>
        </div>
      </div>
      <div className="text-center text-sm">
        Assertividade (últimos 30): <span className="font-bold">{assertRate}%</span>
      </div>

      <div className="flex gap-2 justify-center pt-2 border-t">
        <Button onClick={() => log.mutate("win")} className="bg-emerald-600 hover:bg-emerald-700">✅ Green</Button>
        <Button onClick={() => log.mutate("gale_win")} className="bg-amber-600 hover:bg-amber-700">⚠️ Gale</Button>
        <Button onClick={() => log.mutate("loss")} variant="destructive">❌ Red</Button>
      </div>

      <div className="space-y-1 text-xs">
        {q.data?.slice(0, 8).map((r: any) => (
          <div key={r.id} className="flex items-center justify-between border-b pb-1">
            <Badge variant={r.result === "loss" ? "destructive" : "default"} className="text-[10px]">
              {r.result}
            </Badge>
            <span className="text-muted-foreground">{new Date(r.confirmed_at).toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}