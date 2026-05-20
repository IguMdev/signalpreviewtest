import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAffiliateAccounts,
  upsertAffiliateAccount,
  deleteAffiliateAccount,
  testAffiliateAccount,
} from "@/lib/promo.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/promocoes/contas")({
  component: AffiliateAccountsPage,
});

type Store = "amazon" | "shopee" | "aliexpress" | "mercadolivre";

const STORE_LABELS: Record<Store, string> = {
  amazon: "Amazon Associates",
  shopee: "Shopee Afiliados",
  aliexpress: "AliExpress Portals",
  mercadolivre: "Mercado Livre Afiliados",
};

const STORE_FIELDS: Record<Store, { key: string; label: string; help?: string; type?: "password" | "text" }[]> = {
  amazon: [
    { key: "access_key", label: "Access Key", help: "PA-API 5.0 Access Key" },
    { key: "secret_key", label: "Secret Key", type: "password" },
    { key: "partner_tag", label: "Associate Tag (ex: mysite-20)" },
    { key: "marketplace", label: "Marketplace", help: "ex: www.amazon.com.br" },
  ],
  shopee: [
    { key: "app_id", label: "App ID" },
    { key: "app_secret", label: "App Secret", type: "password" },
    { key: "sub_id", label: "SubID (opcional)" },
  ],
  aliexpress: [
    { key: "app_key", label: "App Key" },
    { key: "app_secret", label: "App Secret", type: "password" },
    { key: "tracking_id", label: "Tracking ID" },
  ],
  mercadolivre: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret", type: "password" },
    { key: "site_id", label: "Site ID", help: "MLB para Brasil" },
  ],
};

function AffiliateAccountsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAffiliateAccounts);
  const upsert = useServerFn(upsertAffiliateAccount);
  const del = useServerFn(deleteAffiliateAccount);
  const test = useServerFn(testAffiliateAccount);

  const accounts = useQuery({
    queryKey: ["affiliate-accounts"],
    queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [store, setStore] = useState<Store>("amazon");
  const [label, setLabel] = useState("");
  const [active, setActive] = useState(true);
  const [creds, setCreds] = useState<Record<string, string>>({});

  function openNew() {
    setEditing(null);
    setStore("amazon");
    setLabel("");
    setActive(true);
    setCreds({});
    setOpen(true);
  }
  function openEdit(a: any) {
    setEditing(a);
    setStore(a.store);
    setLabel(a.label);
    setActive(a.is_active);
    setCreds((a.credentials as Record<string, string>) ?? {});
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: () => upsert({
      data: {
        id: editing?.id,
        store,
        label,
        credentials: creds,
        is_active: active,
      },
    }),
    onSuccess: () => {
      toast.success("Conta salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["affiliate-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliate-accounts"] }),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Conexão OK — ${r.sampleCount} oferta(s) encontradas`);
      else toast.error(`Falhou: ${r.error}`);
      qc.invalidateQueries({ queryKey: ["affiliate-accounts"] });
    },
  });

  const fields = STORE_FIELDS[store];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas de Afiliado</h1>
          <p className="text-sm text-muted-foreground">Credenciais oficiais das lojas para o bot de promoções.</p>
        </div>
        <Button onClick={openNew}><Plus className="size-4 mr-2" />Nova conta</Button>
      </div>

      <Card className="overflow-hidden">
        {accounts.data?.accounts.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada. Adicione suas credenciais para começar a receber promoções.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último teste</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.data?.accounts.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell><Badge variant="secondary">{STORE_LABELS[a.store as Store]}</Badge></TableCell>
                  <TableCell className="font-medium">{a.label}</TableCell>
                  <TableCell>
                    {a.is_active ? <Badge>Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}
                    {a.last_error && (
                      <div className="text-xs text-destructive mt-1 max-w-xs truncate" title={a.last_error}>
                        {a.last_error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.last_check_at ? new Date(a.last_check_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => testMut.mutate(a.id)} disabled={testMut.isPending}>
                        {testMut.isPending ? <Loader2 className="size-4 animate-spin" /> :
                          a.last_error ? <XCircle className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-emerald-500" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) delMut.mutate(a.id); }}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conta" : "Nova conta de afiliado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Loja</Label>
                <Select value={store} onValueChange={(v) => { setStore(v as Store); setCreds({}); }} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STORE_LABELS) as Store[]).map((s) => (
                      <SelectItem key={s} value={s}>{STORE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rótulo</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Conta principal" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type ?? "text"}
                    value={creds[f.key] ?? ""}
                    onChange={(e) => setCreds((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                  {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label className="text-xs">Conta ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!label || saveMut.isPending}>
              {saveMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}