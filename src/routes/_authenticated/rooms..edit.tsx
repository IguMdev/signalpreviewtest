
/* ============================================================ */
/* Windows Section                                              */
/* ============================================================ */

const WEEKDAYS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" },
  { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

type Window = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  asset_filter: string[];
  is_active: boolean;
};

function WindowsSection({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["room_windows", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_windows").select("*").eq("room_id", roomId)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as Window[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_windows").insert({
        room_id: roomId,
        user_id: u.user!.id,
        name: "Nova janela",
        start_time: "09:00",
        end_time: "17:00",
        weekdays: [1, 2, 3, 4, 5],
        asset_filter: [],
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela criada");
      qc.invalidateQueries({ queryKey: ["room_windows", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Janelas de Operação</h2>
          <p className="text-xs text-muted-foreground">
            Defina horários, dias e ativos permitidos para envio de sinais.
          </p>
        </div>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4 mr-1" />Nova janela
        </Button>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {list.data?.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
          Nenhuma janela cadastrada.
        </div>
      )}

      <div className="space-y-3">
        {list.data?.map((w) => (
          <WindowRow key={w.id} window={w} roomId={roomId} />
        ))}
      </div>
    </Card>
  );
}

function WindowRow({ window: w, roomId }: { window: Window; roomId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(w.name);
  const [start, setStart] = useState(w.start_time.slice(0, 5));
  const [end, setEnd] = useState(w.end_time.slice(0, 5));
  const [days, setDays] = useState<number[]>(w.weekdays);
  const [assets, setAssets] = useState<string[]>(w.asset_filter);
  const [active, setActive] = useState(w.is_active);
  const [showAssets, setShowAssets] = useState(false);

  const allAssets = Object.values(ASSETS_CATALOG).flat();

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("room_windows").update({
        name, start_time: start, end_time: end,
        weekdays: days, asset_filter: assets, is_active: active,
      }).eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela salva");
      qc.invalidateQueries({ queryKey: ["room_windows", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("room_windows").delete().eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Janela removida");
      qc.invalidateQueries({ queryKey: ["room_windows", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  }
  function toggleAsset(a: string) {
    setAssets((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  return (
    <div className="border rounded-md p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs font-medium" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Ativa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <Button variant="ghost" size="icon" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Início</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fim</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Dias da semana</Label>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d.v}
              type="button"
              onClick={() => toggleDay(d.v)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                days.includes(d.v)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >{d.l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Ativos permitidos {assets.length === 0 && <span className="text-muted-foreground">(todos)</span>}</Label>
          <Button variant="outline" size="sm" onClick={() => setShowAssets((s) => !s)}>
            {showAssets ? "Fechar" : "Editar filtro"}
          </Button>
        </div>
        {assets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assets.map((a) => (
              <Badge key={a} variant="secondary" className="cursor-pointer" onClick={() => toggleAsset(a)}>
                {a} ×
              </Badge>
            ))}
          </div>
        )}
        {showAssets && (
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 grid grid-cols-3 sm:grid-cols-5 gap-1">
            {allAssets.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAsset(a)}
                className={`px-2 py-1 text-xs rounded border ${
                  assets.includes(a)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >{a}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar janela"}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Templates Section                                            */
/* ============================================================ */

type TemplateKind = "entry" | "gain" | "loss" | "event";
const TEMPLATE_DEFS: { kind: TemplateKind; label: string; hint: string }[] = [
  { kind: "entry", label: "Entrada", hint: "Mensagem enviada quando um sinal é gerado." },
  { kind: "gain",  label: "GAIN",    hint: "Mensagem enviada quando o sinal resulta em ganho." },
  { kind: "loss",  label: "LOSS",    hint: "Mensagem enviada quando o sinal resulta em perda." },
  { kind: "event", label: "Evento",  hint: "Mensagem para eventos especiais (ex: news, mhi)." },
];

function TemplatesSection({ roomId }: { roomId: string }) {
  const list = useQuery({
    queryKey: ["room_templates", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_templates").select("*").eq("room_id", roomId);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Templates de Mensagens</h2>
        <p className="text-xs text-muted-foreground">
          Use variáveis como {"{ativo}"}, {"{direcao}"}, {"{horario}"}, {"{payout}"}.
        </p>
      </div>
      {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {list.data && (
        <div className="space-y-4">
          {TEMPLATE_DEFS.map((def) => {
            const existing = list.data.find((t) => t.kind === def.kind);
            return (
              <TemplateRow
                key={def.kind}
                roomId={roomId}
                def={def}
                existing={existing as { id: string; content: string; parse_mode: string } | undefined}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function TemplateRow({
  roomId, def, existing,
}: {
  roomId: string;
  def: { kind: TemplateKind; label: string; hint: string };
  existing?: { id: string; content: string; parse_mode: string };
}) {
  const qc = useQueryClient();
  const [content, setContent] = useState(existing?.content ?? "");
  const [parseMode, setParseMode] = useState(existing?.parse_mode ?? "HTML");

  useEffect(() => {
    setContent(existing?.content ?? "");
    setParseMode(existing?.parse_mode ?? "HTML");
  }, [existing?.id, existing?.content, existing?.parse_mode]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_templates").upsert({
        room_id: roomId,
        user_id: u.user!.id,
        kind: def.kind,
        content,
        parse_mode: parseMode,
      }, { onConflict: "room_id,kind" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Template ${def.label} salvo`);
      qc.invalidateQueries({ queryKey: ["room_templates", roomId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border rounded-md p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-sm">{def.label}</div>
          <p className="text-xs text-muted-foreground">{def.hint}</p>
        </div>
        <Select value={parseMode} onValueChange={setParseMode}>
          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="HTML">HTML</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="None">Texto puro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder={`Conteúdo do template ${def.label}...`}
        className="font-mono text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar template"}
        </Button>
      </div>
    </div>
  );
}
