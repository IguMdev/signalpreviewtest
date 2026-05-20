import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPromoBotSettings,
  upsertPromoBotSettings,
  previewPromoOffers,
} from "@/lib/promo.functions";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Eye, ShoppingBag, AlertTriangle } from "lucide-react";

import { STORE_LABELS, type AffiliateStore } from "@/lib/promo/types";

const DEFAULT_STORES: AffiliateStore[] = ["amazon", "shopee", "aliexpress", "mercadolivre"];

type Store = AffiliateStore;

const DEFAULT_TEMPLATE = `🔥 <b>{title}</b>\n\n<s>De R$ {old_price}</s> por <b>R$ {price}</b>\n💰 {discount}% OFF\n\n👉 {link}`;

export function PromoBotCard({
  roomId,
  allowedStores = DEFAULT_STORES,
  title = "Bot de Promoções",
  description = "Envia ofertas automaticamente a partir das APIs oficiais (Amazon, Shopee, AliExpress, Mercado Livre).",
}: {
  roomId: string;
  allowedStores?: AffiliateStore[];
  title?: string;
  description?: string;
}) {
  const qc = useQueryClient();
  const getSettings = useServerFn(getPromoBotSettings);
  const saveSettings = useServerFn(upsertPromoBotSettings);
  const preview = useServerFn(previewPromoOffers);

  const q = useQuery({
    queryKey: ["promo-bot-settings", roomId],
    queryFn: () => getSettings({ data: { room_id: roomId } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(4);
  const [stores, setStores] = useState<Store[]>([]);
  const [minDiscount, setMinDiscount] = useState(0);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [keywords, setKeywords] = useState("");
  const [blacklist, setBlacklist] = useState("");
  const [categories, setCategories] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [sendImage, setSendImage] = useState(true);

  useEffect(() => {
    const s = q.data?.settings;
    if (!s) return;
    setEnabled(!!s.enabled);
    setIntervalHours(s.interval_hours ?? 4);
    setStores((s.stores ?? []) as Store[]);
    setMinDiscount(s.min_discount_pct ?? 0);
    setMinPrice(s.min_price?.toString() ?? "");
    setMaxPrice(s.max_price?.toString() ?? "");
    setKeywords((s.keywords ?? []).join(", "));
    setBlacklist((s.blacklist_keywords ?? []).join(", "));
    setCategories((s.categories ?? []).join(", "));
    setTemplate(s.message_template || DEFAULT_TEMPLATE);
    setSendImage(s.send_image ?? true);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          room_id: roomId,
          enabled,
          interval_hours: intervalHours,
          stores,
          min_discount_pct: minDiscount,
          min_price: minPrice ? Number(minPrice) : null,
          max_price: maxPrice ? Number(maxPrice) : null,
          categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
          keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
          blacklist_keywords: blacklist.split(",").map((s) => s.trim()).filter(Boolean),
          message_template: template,
          parse_mode: "HTML",
          send_image: sendImage,
          premium_account_id: null,
          premium_enabled: false,
        },
      }),
    onSuccess: () => {
      toast.success("Configurações do bot de promoções salvas");
      qc.invalidateQueries({ queryKey: ["promo-bot-settings", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewMut = useMutation({
    mutationFn: () => preview({ data: { room_id: roomId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleStore(s: Store) {
    setStores((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Ativo</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="rounded-md border border-dashed p-3 text-xs flex items-start gap-2 bg-muted/40">
        <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          Para receber ofertas, cadastre suas credenciais em{" "}
          <Link to="/promocoes/contas" className="underline text-primary">Promoções → Contas de afiliado</Link>.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Intervalo (horas)</Label>
          <Input type="number" min={1} max={168} value={intervalHours} onChange={(e) => setIntervalHours(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Desconto mínimo (%)</Label>
          <Input type="number" min={0} max={100} value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Enviar imagem do produto</Label>
          <div className="h-9 flex items-center"><Switch checked={sendImage} onCheckedChange={setSendImage} /></div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Preço mínimo (R$)</Label>
          <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="opcional" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Preço máximo (R$)</Label>
          <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="opcional" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Lojas habilitadas</Label>
        <div className="flex flex-wrap gap-2">
          {allowedStores.map((v) => {
            const active = stores.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleStore(v)}
                className={`px-3 py-1.5 rounded-md text-xs border transition ${
                  active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"
                }`}
              >
                {STORE_LABELS[v]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="celular, fone, notebook" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Categorias</Label>
          <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="eletronicos, casa" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Blacklist (não enviar)</Label>
          <Input value={blacklist} onChange={(e) => setBlacklist(e.target.value)} placeholder="usado, recondicionado" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Template da mensagem</Label>
        <Textarea rows={6} value={template} onChange={(e) => setTemplate(e.target.value)} />
        <p className="text-[11px] text-muted-foreground">
          Variáveis: <code>{`{title} {price} {old_price} {discount} {link} {store} {category}`}</code>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
        <Button variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
          <Eye className="size-4 mr-1.5" />
          {previewMut.isPending ? "Buscando..." : "Pré-visualizar ofertas"}
        </Button>
      </div>

      {previewMut.data && (
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium">Amostra ({previewMut.data.offers.length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-auto">
            {previewMut.data.offers.map((o, i) => (
              <div key={i} className="border rounded-md p-2 text-xs flex gap-2">
                {o.imageUrl && <img src={o.imageUrl} alt="" className="size-14 object-cover rounded" />}
                <div className="min-w-0 flex-1">
                  <Badge variant="secondary" className="mb-1">{o.store}</Badge>
                  {o.error ? (
                    <div className="text-destructive">{o.error}</div>
                  ) : (
                    <>
                      <div className="font-medium line-clamp-2">{o.title}</div>
                      <div className="text-muted-foreground">
                        {o.oldPrice && <s className="mr-1">R$ {o.oldPrice}</s>}
                        <strong>R$ {o.price}</strong>
                        {o.discountPct ? <span className="ml-1 text-emerald-600">-{o.discountPct}%</span> : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}