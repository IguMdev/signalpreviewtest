
/* ============================================================ */
/* Templates de Mensagem                                         */
/* ============================================================ */

type TemplateKind =
  | "signal" | "win" | "win_martingale" | "loss"
  | "buy_direction" | "sell_direction" | "entry" | "gain" | "event";

const TEMPLATE_TABS: { kind: TemplateKind; label: string; placeholder: string }[] = [
  { kind: "signal",         label: "Sinal",         placeholder: "🎯 SINAL: {ATIVO}\n⏱ {TIMEFRAME}\n📈 {DIRECAO}\n💰 Entrada: {ENTRADA}" },
  { kind: "win",            label: "Vitória",       placeholder: "✅ VITÓRIA no {ATIVO} 🟢" },
  { kind: "win_martingale", label: "Vitória MG",    placeholder: "✅ VITÓRIA no martingale {ATIVO} 🟢" },
  { kind: "loss",           label: "Derrota",       placeholder: "🔴 DERROTA no {ATIVO}" },
  { kind: "buy_direction",  label: "Direção COMPRA", placeholder: "📈 COMPRA" },
  { kind: "sell_direction", label: "Direção VENDA",  placeholder: "📉 VENDA" },
];

function TemplatesCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const tpls = useQuery({
    queryKey: ["room_templates", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_templates").select("*").eq("room_id", roomId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const btns = useQuery({
    queryKey: ["room_template_buttons", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_template_buttons").select("*").eq("room_id", roomId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Templates de Mensagem</h2>
      <p className="text-xs text-muted-foreground">
        Use macros como <code>{`{ATIVO}, {TIMEFRAME}, {DIRECAO}, {ENTRADA}, {ENTRADAGALE1}, {ENTRADAGALE2}`}</code>.
      </p>
      <Tabs defaultValue="signal">
        <TabsList className="flex flex-wrap h-auto">
          {TEMPLATE_TABS.map((t) => (
            <TabsTrigger key={t.kind} value={t.kind}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {TEMPLATE_TABS.map((t) => {
          const existing = tpls.data?.find((x: any) => x.kind === t.kind);
          const tabBtns = (btns.data ?? []).filter((b: any) => b.template_kind === t.kind);
          return (
            <TabsContent key={t.kind} value={t.kind} className="pt-4">
              <TemplateEditor
                roomId={roomId}
                kind={t.kind}
                placeholder={t.placeholder}
                existing={existing}
                buttons={tabBtns}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: ["room_templates", roomId] });
                  qc.invalidateQueries({ queryKey: ["room_template_buttons", roomId] });
                }}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </Card>
  );
}

function TemplateEditor({
  roomId, kind, placeholder, existing, buttons, onChanged,
}: {
  roomId: string;
  kind: TemplateKind;
  placeholder: string;
  existing: any;
  buttons: any[];
  onChanged: () => void;
}) {
  const [content, setContent] = useState<string>(existing?.content ?? "");
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const saveTpl = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (existing) {
        const { error } = await supabase.from("room_templates")
          .update({ content }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("room_templates").insert({
          room_id: roomId, user_id: u.user!.id, kind, content, parse_mode: "HTML",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Template salvo"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBtn = useMutation({
    mutationFn: async () => {
      if (!newLabel.trim() || !newUrl.trim()) throw new Error("Preencha label e URL");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_template_buttons").insert({
        room_id: roomId, user_id: u.user!.id, template_kind: kind,
        label: newLabel.trim(), url: newUrl.trim(), sort_order: buttons.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewLabel(""); setNewUrl(""); toast.success("Botão adicionado"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delBtn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("room_template_buttons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Botão removido"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Conteúdo da mensagem</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={6}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Botões inline (opcional)</Label>
        {buttons.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum botão configurado.</p>
        )}
        {buttons.map((b: any) => (
          <div key={b.id} className="flex items-center gap-2 p-2 rounded-md border bg-background/40">
            <span className="text-sm font-medium flex-1">{b.label}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[40%]">{b.url}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => delBtn.mutate(b.id)} disabled={delBtn.isPending}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2 items-center">
          <Input className="h-9" placeholder="Texto do botão" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Input className="h-9" placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => addBtn.mutate()} disabled={addBtn.isPending}>
            <Plus className="size-4 mr-1" />Adicionar
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => saveTpl.mutate()} disabled={saveTpl.isPending}>
          {saveTpl.isPending ? "Salvando..." : "Salvar template"}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Mensagens de Sessão (abrir / fechar)                          */
/* ============================================================ */

function SessionMessagesCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["room_session_messages", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_session_messages").select("*").eq("room_id", roomId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const open = list.data?.find((m: any) => m.kind === "open");
  const close = list.data?.find((m: any) => m.kind === "close");
  const refresh = () => qc.invalidateQueries({ queryKey: ["room_session_messages", roomId] });

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Mensagens de Sessão</h2>
      <p className="text-xs text-muted-foreground">
        Mensagens automáticas enviadas antes da abertura e após o fechamento de cada janela de operação.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SessionMessageEditor roomId={roomId} kind="open" title="Abertura de Sessão" existing={open} onChanged={refresh} />
        <SessionMessageEditor roomId={roomId} kind="close" title="Fechamento de Sessão" existing={close} onChanged={refresh} />
      </div>
    </Card>
  );
}

function SessionMessageEditor({
  roomId, kind, title, existing, onChanged,
}: {
  roomId: string;
  kind: "open" | "close";
  title: string;
  existing: any;
  onChanged: () => void;
}) {
  const [content, setContent] = useState<string>(existing?.content ?? "");
  const [enabled, setEnabled] = useState<boolean>(existing?.enabled ?? true);
  const [lead, setLead] = useState<string>(String(existing?.lead_minutes ?? 5));

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        content,
        enabled,
        lead_minutes: parseInt(lead, 10) || 0,
      };
      if (existing) {
        const { error } = await supabase.from("room_session_messages").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("room_session_messages").insert({
          ...payload, room_id: roomId, user_id: u.user!.id, kind,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(`${title} salva`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border rounded-md p-4 space-y-3 bg-card/40">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-xs text-muted-foreground">{enabled ? "Ativa" : "Desativada"}</span>
        </label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{kind === "open" ? "Minutos antes da abertura" : "Minutos após o fechamento"}</Label>
        <Input value={lead} onChange={(e) => setLead(e.target.value)} className="h-9 max-w-[140px]" inputMode="numeric" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Conteúdo</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="font-mono text-sm"
          placeholder={kind === "open"
            ? "🚀 SESSÃO COMEÇA EM {MINUTOS} MIN!\nPrepare-se para os sinais!"
            : "🏁 SESSÃO ENCERRADA\nObrigado por operar conosco!"} />
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Relatório de Fim de Sessão                                    */
/* ============================================================ */

function ReportsCard({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const report = useQuery({
    queryKey: ["room_reports", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_reports").select("*").eq("room_id", roomId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [enabled, setEnabled] = useState<boolean>(false);
  const [delay, setDelay] = useState<string>("1");
  const [tpl, setTpl] = useState<string>("");
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  if (report.data && !hydrated) {
    setEnabled(report.data.enabled);
    setDelay(String(report.data.delay_minutes ?? 1));
    setTpl(report.data.template ?? "");
    setIncludeStats(report.data.include_stats ?? true);
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        enabled,
        delay_minutes: parseInt(delay, 10) || 0,
        template: tpl,
        include_stats: includeStats,
      };
      if (report.data) {
        const { error } = await supabase.from("room_reports").update(payload).eq("id", report.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("room_reports").insert({
          ...payload, room_id: roomId, user_id: u.user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Relatório salvo"); qc.invalidateQueries({ queryKey: ["room_reports", roomId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Relatório de Fim de Sessão</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-xs text-muted-foreground">{enabled ? "Ativo" : "Desativado"}</span>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Envia um resumo automático ao final de cada janela de operação.
        Macros disponíveis: <code>{`{TOTAL}, {WINS}, {LOSSES}, {WINRATE}, {SESSAO}`}</code>.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Delay após fechamento (minutos)</Label>
          <Input value={delay} onChange={(e) => setDelay(e.target.value)} className="h-9" inputMode="numeric" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer w-fit self-end">
          <Checkbox checked={includeStats} onCheckedChange={(v) => setIncludeStats(!!v)} />
          <span className="text-sm">Incluir estatísticas (wins/losses/winrate)</span>
        </label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Template do relatório</Label>
        <Textarea value={tpl} onChange={(e) => setTpl(e.target.value)} rows={6} className="font-mono text-sm"
          placeholder={"📊 RELATÓRIO {SESSAO}\n✅ Wins: {WINS}\n🔴 Losses: {LOSSES}\n🎯 Winrate: {WINRATE}%"} />
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar seção"}
        </Button>
      </div>
    </Card>
  );
}
