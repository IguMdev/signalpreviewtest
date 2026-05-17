import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updatePixel, getPixel } from "@/lib/tracking.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/canal")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: CanalPage,
});

function CanalPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Send className="size-6" /> Canal</h1>
        <p className="text-sm text-muted-foreground mt-1">Vincule cada pixel a um bot do Telegram e a uma sala.</p>
      </div>
      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId && <CanalForm pixelId={effectiveId} />}
    </div>
  );
}

function CanalForm({ pixelId }: { pixelId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getPixel);
  const updFn = useServerFn(updatePixel);
  const pixel = useQuery({ queryKey: ["pixel", pixelId], queryFn: () => getFn({ data: { id: pixelId } }) });

  const accounts = useQuery({
    queryKey: ["ta-mini-canal"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id,bot_username");
      return data ?? [];
    },
  });
  const rooms = useQuery({
    queryKey: ["rooms-mini-canal"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("id,name");
      return data ?? [];
    },
  });

  const [accountId, setAccountId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");

  useEffect(() => {
    if (pixel.data) {
      setAccountId(pixel.data.account_id ?? "");
      setRoomId(pixel.data.room_id ?? "");
    }
  }, [pixel.data]);

  const save = useMutation({
    mutationFn: () => updFn({ data: {
      id: pixelId,
      account_id: accountId || null,
      room_id: roomId || null,
    } }),
    onSuccess: () => {
      toast.success("Vínculos salvos");
      qc.invalidateQueries({ queryKey: ["pixel", pixelId] });
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vínculos do pixel</CardTitle>
        <CardDescription>O bot recebe o <code>/start tk_&lt;click_id&gt;</code> e a sala é onde os usuários entram.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Bot do Telegram</Label>
          <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {accounts.data?.map(a => <SelectItem key={a.id} value={a.id}>@{a.bot_username ?? "(sem)"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sala (opcional)</Label>
          <Select value={roomId || "none"} onValueChange={(v) => setRoomId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {rooms.data?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
      </CardContent>
    </Card>
  );
}