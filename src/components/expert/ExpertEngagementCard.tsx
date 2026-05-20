import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

export function ExpertEngagementCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["expert-engagement", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expert_engagement_prompts" as any)
        .select("*")
        .eq("room_id", roomId)
        .order("send_time", { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const [kind, setKind] = useState<"question" | "poll">("question");
  const [content, setContent] = useState("");
  const [opts, setOpts] = useState("");
  const [sendTime, setSendTime] = useState("10:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const options = kind === "poll"
        ? opts.split("\n").map((s) => s.trim()).filter(Boolean)
        : [];
      const { error } = await supabase.from("expert_engagement_prompts" as any).insert({
        user_id: u.user!.id,
        room_id: roomId,
        kind,
        content,
        options,
        send_time: sendTime + ":00",
        weekdays,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setContent(""); setOpts("");
      qc.invalidateQueries({ queryKey: ["expert-engagement", roomId] });
      toast.success("Prompt adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expert_engagement_prompts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert-engagement", roomId] }),
  });

  const toggle = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("expert_engagement_prompts" as any)
        .update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert-engagement", roomId] }),
  });

  const toggleWeekday = (d: number) =>
    setWeekdays((w) => w.includes(d) ? w.filter((x) => x !== d) : [...w, d]);

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="size-5 text-primary" /> Engajamento Diário
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Perguntas do dia / enquetes enviadas no horário marcado para manter a comunidade ativa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="question">Pergunta</SelectItem>
              <SelectItem value="poll">Enquete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Conteúdo</Label>
          <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Qual sua maior dificuldade essa semana?" />
        </div>
      </div>
      {kind === "poll" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Opções da enquete (uma por linha)</Label>
          <Textarea rows={3} value={opts} onChange={(e) => setOpts(e.target.value)} placeholder="Sim&#10;Não&#10;Talvez" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Horário</Label>
          <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Dias da semana</Label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => (
              <Badge
                key={d.v}
                variant={weekdays.includes(d.v) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleWeekday(d.v)}
              >{d.l}</Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => add.mutate()} disabled={!content || add.isPending}>
          <Plus className="size-4 mr-1" /> Adicionar prompt
        </Button>
      </div>

      <div className="space-y-2 pt-2 border-t">
        {q.data?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border rounded-md p-3 text-sm">
            <Badge variant="outline" className="text-[10px]">{p.kind}</Badge>
            <div className="flex-1 min-w-0">
              <div className="truncate">{p.content}</div>
              <div className="text-[10px] text-muted-foreground">
                {p.send_time?.slice(0, 5)} · {(p.weekdays ?? []).length} dias
              </div>
            </div>
            <Switch checked={p.is_active} onCheckedChange={() => toggle.mutate(p)} />
            <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhum prompt cadastrado.</p>}
      </div>
    </Card>
  );
}