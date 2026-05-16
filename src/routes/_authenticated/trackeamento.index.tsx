import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listPixels,
  createPixel,
  deletePixel,
  VERTICALS,
} from "@/lib/tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Crosshair, Plus, Trash2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trackeamento/")({
  component: TrackeamentoListPage,
});

const VERTICAL_LABEL: Record<string, string> = {
  bet: "Apostas / Bet",
  igaming: "iGaming / Cassino",
  hot: "Nicho Hot / +18",
  promo: "Promoções e descontos",
  outro: "Outro",
};

function TrackeamentoListPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPixels);
  const createFn = useServerFn(createPixel);
  const delFn = useServerFn(deletePixel);

  const pixels = useQuery({ queryKey: ["tracking-pixels"], queryFn: () => listFn() });

  const accounts = useQuery({
    queryKey: ["telegram-accounts-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_accounts").select("id,bot_username").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<(typeof VERTICALS)[number]>("bet");
  const [accountId, setAccountId] = useState<string>("");

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      name,
      vertical,
      account_id: accountId || null,
      is_active: true,
      event_on_join: "Lead",
      event_on_offer_click: "InitiateCheckout",
      event_on_register: "CompleteRegistration",
      event_on_deposit: "Purchase",
    } }),
    onSuccess: () => {
      toast.success("Pixel de trackeamento criado");
      setOpen(false); setName(""); setAccountId("");
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["tracking-pixels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crosshair className="size-6" /> Trackeamento avançado
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Crie pixels de trackeamento estilo Track4You para medir o funil completo:
            clique no anúncio → entrada no bot → clique na oferta → cadastro → depósito,
            atribuindo cada conversão ao criativo e UTM original.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> Novo pixel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo pixel de trackeamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Campanha Aviator BR" />
              </div>
              <div className="space-y-2">
                <Label>Vertical</Label>
                <Select value={vertical} onValueChange={(v) => setVertical(v as never)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABEL[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bot do Telegram <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (escolher depois)</SelectItem>
                    {accounts.data?.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        @{a.bot_username ?? "(sem username)"} {a.name ? `— ${a.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
                {create.isPending ? "Criando..." : "Criar pixel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pixels.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : pixels.data && pixels.data.length > 0 ? (
        <div className="grid gap-3">
          {pixels.data.map(p => (
            <Card key={p.id} className="hover:bg-accent/30 transition">
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <Link to="/trackeamento/$pixelId" params={{ pixelId: p.id }} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary">{VERTICAL_LABEL[p.vertical] ?? p.vertical}</Badge>
                        {p.is_active ? <Badge variant="default">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                        {p.bot_username && <Badge variant="outline">@{p.bot_username}</Badge>}
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm(`Remover pixel "${p.name}"? Os cliques e conversões serão perdidos.`)) {
                      remove.mutate(p.id);
                    }
                  }}>
                    <Trash2 className="size-4" />
                  </Button>
                  <Link to="/trackeamento/$pixelId" params={{ pixelId: p.id }}>
                    <Button variant="ghost" size="icon"><ChevronRight className="size-4" /></Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum pixel ainda</CardTitle>
            <CardDescription>
              Crie o primeiro pixel para começar a rastrear suas campanhas com atribuição completa.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}