import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listPostbacks, createPostback, deletePostback, testPostback, POSTBACK_EVENTS,
} from "@/lib/tracking.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Repeat, Plus, Trash2, FileText, MousePointer, Megaphone, DoorOpen } from "lucide-react";
import { PixelFilterBar, usePixelFilter } from "@/components/tracking/PixelFilter";

export const Route = createFileRoute("/_authenticated/trackeamento/postbacks")({
  validateSearch: (s: Record<string, unknown>) => ({ pixel: typeof s.pixel === "string" ? s.pixel : undefined }),
  component: PostbacksPage,
});

const EVENT_META: Record<typeof POSTBACK_EVENTS[number], { label: string; icon: React.ReactNode; color: string }> = {
  viewpage:        { label: "ViewPage",        icon: <FileText className="size-6" />,    color: "text-slate-300" },
  click_button:    { label: "Clique no Botão", icon: <MousePointer className="size-6" />, color: "text-slate-300" },
  channel_enter:   { label: "Entrada no Canal", icon: <Megaphone className="size-6" />,  color: "text-pink-500" },
  channel_leave:   { label: "Saída do Canal",  icon: <DoorOpen className="size-6" />,    color: "text-amber-500" },
};

function PostbacksPage() {
  const { pixelId, pixels, setPixel } = usePixelFilter();
  const effectiveId = pixelId ?? pixels[0]?.id ?? null;
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Repeat className="size-6" /> Postbacks</h1>
          <p className="text-sm text-muted-foreground mt-1">Dispare webhooks customizados nos eventos do seu funil.</p>
        </div>
        {effectiveId && <NewPostbackDialog pixelId={effectiveId} />}
      </div>
      <PixelFilterBar pixelId={effectiveId} pixels={pixels} setPixel={setPixel} />
      {effectiveId ? <PostbacksList pixelId={effectiveId} /> : (
        <p className="text-sm text-muted-foreground">Crie um pixel para configurar postbacks.</p>
      )}
    </div>
  );
}

function PostbacksList({ pixelId }: { pixelId: string }) {
  const listFn = useServerFn(listPostbacks);
  const delFn = useServerFn(deletePostback);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["postbacks", pixelId], queryFn: () => listFn({ data: { pixel_id: pixelId } }) });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["postbacks", pixelId] }); toast.success("Postback removido"); },
  });

  if (!q.data || q.data.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        Nenhum postback configurado. Clique em "Novo Postback".
      </CardContent></Card>
    );
  }
  return (
    <div className="grid gap-2">
      {q.data.map((p: any) => {
        const meta = EVENT_META[p.event as keyof typeof EVENT_META];
        return (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={meta?.color}>{meta?.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{p.name}</p>
                  <Badge variant="outline" className="text-[10px]">{meta?.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{p.url}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function NewPostbackDialog({ pixelId }: { pixelId: string }) {
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<typeof POSTBACK_EVENTS[number] | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const createFn = useServerFn(createPostback);
  const testFn = useServerFn(testPostback);
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => createFn({ data: { pixel_id: pixelId, name, url, event: event!, is_active: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["postbacks", pixelId] });
      toast.success("Postback criado");
      setOpen(false); setEvent(null); setName(""); setUrl("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { url } }),
    onSuccess: (r) => r.ok ? toast.success(`Postback OK (HTTP ${r.status})`) : toast.error(`Falhou (HTTP ${r.status})`),
    onError: (e: any) => toast.error(e?.message ?? "Erro de teste"),
  });

  const canSave = !!event && name.trim().length > 0 && /^https?:\/\//.test(url);
  const canTest = /^https?:\/\//.test(url);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="size-4" /> Novo Postback</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo Postback</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Event picker */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Escolha o evento do Postback</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {POSTBACK_EVENTS.map((ev) => {
                const m = EVENT_META[ev];
                const active = event === ev;
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => setEvent(ev)}
                    className={`rounded-lg border p-4 flex flex-col items-center gap-2 text-sm transition-colors ${
                      active ? "border-primary bg-primary/10" : "bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    <span className={m.color}>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite o Nome do Postback" />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.exemplo.com" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" disabled={!canTest || test.isPending} onClick={() => test.mutate()}>
              {test.isPending ? "Testando..." : "Testar Postback"}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
