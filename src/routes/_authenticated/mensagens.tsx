import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertSchedule,
  toggleSchedule,
  deleteSchedule,
  testSchedule,
  testMessage,
} from "@/lib/recurring-schedules.functions";
import {
  upsertFolder,
  deleteFolder,
  moveScheduleToFolder,
} from "@/lib/schedule-folders.functions";
import { syncRoomPhoto } from "@/lib/room-photos.functions";
import { createVideoThumbnailBlob, thumbnailPathForVideoPath } from "@/lib/video-thumbnail.client";
import { QuickTemplatesBar } from "@/components/QuickTemplatesBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PremiumEmojiPicker } from "@/components/PremiumEmojiPicker";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Calendar as CalendarIcon,
  CheckCircle2,
  Users,
  Search,
  Pencil,
  Trash2,
  Clock,
  Sparkles,
  X,
  RefreshCw,
  ImageIcon,
  Loader2,
  Send,
  Copy,
  Folder,
  FolderPlus,
  FolderOpen,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: MensagensPage,
});

const WEEKDAYS = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 7, label: "Domingo", short: "Dom" },
];

type Schedule = {
  id: string;
  room_id: string;
  account_id: string | null;
  title: string;
  content: string | null;
  video_id: string | null;
  image_path: string | null;
  image_mime: string | null;
  parse_mode: string;
  times: string[];
  weekdays: number[];
  weekday_overrides: Record<string, string[]> | null;
  follow_ups: Array<{
    delay_minutes: number;
    delay_seconds?: number | null;
    content: string | null;
    image_path: string | null;
    image_mime: string | null;
    video_id: string | null;
    button_text?: string | null;
    button_url?: string | null;
  }> | null;
  is_premium: boolean;
  is_active: boolean;
  timezone: string;
  last_sent_at: string | null;
  button_text?: string | null;
  button_url?: string | null;
  folder_id?: string | null;
};

type Room = {
  id: string;
  name: string;
  default_account_id: string | null;
  photo_url: string | null;
};

type ScheduleFolder = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

type VideoOption = {
  id: string;
  title: string;
  kind: string | null;
  storage_path: string;
};

function MensagensPage() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertSchedule);
  const toggleFn = useServerFn(toggleSchedule);
  const delFn = useServerFn(deleteSchedule);
  const testFn = useServerFn(testSchedule);
  const syncPhotoFn = useServerFn(syncRoomPhoto);
  const upsertFolderFn = useServerFn(upsertFolder);
  const deleteFolderFn = useServerFn(deleteFolder);
  const moveFolderFn = useServerFn(moveScheduleToFolder);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [presetRoomId, setPresetRoomId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>("all"); // "all" | "none" | folder id
  const [manageOpen, setManageOpen] = useState(false);

  const folders = useQuery({
    queryKey: ["schedule-folders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("schedule_folders")
        .select("id, name, color, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as ScheduleFolder[];
    },
  });

  const rooms = useQuery({
    queryKey: ["rooms-min"],
    queryFn: async () =>
      ((await supabase.from("rooms").select("id, name, default_account_id, photo_url")).data ?? []) as Room[],
  });

  const accounts = useQuery({
    queryKey: ["accounts-min"],
    queryFn: async () =>
      (await supabase.from("telegram_accounts").select("id, label")).data ?? [],
  });

  const videos = useQuery({
    queryKey: ["videos-min"],
    queryFn: async () =>
      ((await supabase.from("videos").select("id, title, kind, storage_path")).data ?? []) as VideoOption[],
  });

  const list = useQuery({
    queryKey: ["recurring-schedules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("recurring_schedules")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Schedule[];
    },
  });

  const all = list.data ?? [];

  const folderFiltered = useMemo(() => {
    if (activeFolder === "all") return all;
    if (activeFolder === "none") return all.filter((s) => !s.folder_id);
    return all.filter((s) => s.folder_id === activeFolder);
  }, [all, activeFolder]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folderFiltered;
    return folderFiltered.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.content ?? "").toLowerCase().includes(q),
    );
  }, [folderFiltered, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of filtered) {
      const arr = map.get(s.room_id) ?? [];
      arr.push(s);
      map.set(s.room_id, arr);
    }
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const total = all.length;
    const active = all.filter((s) => s.is_active).length;
    const roomsWithSchedules = new Set(all.map((s) => s.room_id)).size;
    return { total, active, rooms: roomsWithSchedules };
  }, [all]);

  const toggleMut = useMutation({
    mutationFn: async (vars: { id: string; isActive: boolean }) => {
      await toggleFn({ data: vars });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      await delFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Agendamento removido");
      qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: async (vars: { id: string; folderId: string | null }) => {
      await moveFolderFn({ data: vars });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const syncPhotoMut = useMutation({
    mutationFn: async (roomId: string) => {
      const res = await syncPhotoFn({ data: { roomId } });
      if (!res.ok) throw new Error(res.message ?? "Falha ao sincronizar foto");
      return res;
    },
    onSuccess: () => {
      toast.success("Foto atualizada");
      qc.invalidateQueries({ queryKey: ["rooms-min"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: async (id: string) => {
      return await testFn({ data: { id } });
    },
    onSuccess: (res) => {
      if (res.ok) toast.success(`Teste enviado (${res.sent} grupo${res.sent === 1 ? "" : "s"})`);
      else toast.error(res.error ?? "Falha ao enviar teste");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ensureVideoThumbnail = async (videoIdToFix: string) => {
    const video = videos.data?.find((v) => v.id === videoIdToFix);
    if (!video || video.kind !== "normal" || !video.storage_path) return;
    const thumbPath = thumbnailPathForVideoPath(video.storage_path);
    const existing = await supabase.storage.from("videos").download(thumbPath);
    if (existing.data) return;
    const signed = await supabase.storage.from("videos").createSignedUrl(video.storage_path, 300);
    if (!signed.data?.signedUrl) return;
    const res = await fetch(signed.data.signedUrl);
    if (!res.ok) return;
    const thumb = await createVideoThumbnailBlob(await res.blob());
    await supabase.storage.from("videos").upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: true });
  };

  // Auto-sync photos for rooms missing one (once per session per room)
  const triedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const list = rooms.data ?? [];
    for (const r of list) {
      if (!r.photo_url && !triedRef.current.has(r.id)) {
        triedRef.current.add(r.id);
        syncPhotoFn({ data: { roomId: r.id } })
          .then(() => qc.invalidateQueries({ queryKey: ["rooms-min"] }))
          .catch(() => {});
      }
    }
  }, [rooms.data, syncPhotoFn, qc]);

  const openNew = (roomId?: string) => {
    setPresetRoomId(roomId ?? null);
    setEditing({
      id: "",
      room_id: roomId ?? "",
      account_id: null,
      title: "",
      content: "",
      video_id: null,
      image_path: null,
      image_mime: null,
      parse_mode: "HTML",
      times: [],
      weekdays: [],
      weekday_overrides: {},
      follow_ups: [],
      is_premium: false,
      is_active: true,
      timezone: "America/Sao_Paulo",
      last_sent_at: null,
    });
  };

  const openDuplicate = (s: Schedule) => {
    setPresetRoomId(s.room_id);
    setEditing({
      ...s,
      id: "",
      title: `${s.title} (cópia)`,
      is_active: true,
      last_sent_at: null,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Mensagens Agendadas</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Gerencie mensagens automáticas enviadas nos horários e dias que você definir.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={<CalendarIcon className="size-5" />} value={stats.total} label="Total" tone="primary" />
        <StatCard icon={<CheckCircle2 className="size-5" />} value={stats.active} label="Ativas" tone="success" />
        <StatCard icon={<Users className="size-5" />} value={stats.rooms} label="Salas" tone="info" />
        <Card className="p-4 sm:p-5 flex items-center text-xs sm:text-sm text-muted-foreground col-span-2 lg:col-span-1">
          Execução automática a cada minuto pelo sistema
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap -mx-1 px-1 overflow-x-auto sm:overflow-visible">
        <FolderChip
          active={activeFolder === "all"}
          onClick={() => setActiveFolder("all")}
          icon={<FolderOpen className="size-4" />}
          label="Todas"
          count={all.length}
        />
        <FolderChip
          active={activeFolder === "none"}
          onClick={() => setActiveFolder("none")}
          icon={<Folder className="size-4" />}
          label="Sem pasta"
          count={all.filter((s) => !s.folder_id).length}
        />
        {(folders.data ?? []).map((f) => (
          <FolderChip
            key={f.id}
            active={activeFolder === f.id}
            onClick={() => setActiveFolder(f.id)}
            icon={<Folder className="size-4" style={{ color: f.color }} />}
            label={f.name}
            count={all.filter((s) => s.folder_id === f.id).length}
            color={f.color}
          />
        ))}
        <Button size="sm" variant="outline" onClick={() => setManageOpen(true)} className="shrink-0">
          <FolderPlus className="size-4" />
          <span className="hidden sm:inline">Gerenciar pastas</span>
          <span className="sm:hidden">Pastas</span>
        </Button>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou conteúdo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <QuickTemplatesBar
        rooms={(rooms.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          default_account_id: r.default_account_id,
        }))}
        accounts={(accounts.data ?? []) as { id: string; label: string }[]}
      />

      {(rooms.data ?? []).length === 0 && (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          Crie um grupo (sala) primeiro para poder agendar mensagens.
        </Card>
      )}

      <div className="space-y-4">
        {(rooms.data ?? []).map((room) => {
          const items = grouped.get(room.id) ?? [];
          if (search && items.length === 0) return null;
          return (
            <Card key={room.id} className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {room.photo_url ? (
                    <img
                      src={room.photo_url}
                      alt={room.name}
                      className="size-10 rounded-full object-cover shrink-0 bg-muted"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Users className="size-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-sm sm:text-base">{room.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5">
                        <span className="size-1.5 rounded-full bg-emerald-400" /> Ativa
                      </span>
                      <span className="truncate">
                        {items.length} {items.length === 1 ? "mensagem agendada" : "mensagens agendadas"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncPhotoMut.mutate(room.id)}
                    disabled={syncPhotoMut.isPending && syncPhotoMut.variables === room.id}
                    title="Atualizar foto do grupo"
                    className="flex-1 sm:flex-none"
                  >
                    <RefreshCw
                      className={`size-4 ${syncPhotoMut.isPending && syncPhotoMut.variables === room.id ? "animate-spin" : ""}`}
                    />
                    Foto
                  </Button>
                  <Button size="sm" onClick={() => openNew(room.id)} data-tour="add-schedule" className="flex-1 sm:flex-none">
                    <Plus className="size-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agendamento nesta sala ainda.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {items.map((s) => (
                    <div key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span
                          className={`mt-1.5 size-2 rounded-full shrink-0 ${
                            s.is_active ? "bg-emerald-400" : "bg-muted-foreground/40"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base break-words">{s.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          {s.times.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock className="size-3" />
                              {t}
                            </span>
                          ))}
                          {s.weekdays.map((w) => {
                            const wd = WEEKDAYS.find((x) => x.value === w);
                            return (
                              <Badge key={w} variant="secondary" className="bg-sky-500/15 text-sky-300 border-0 font-normal">
                                <span className="hidden sm:inline">{wd?.label}</span>
                                <span className="sm:hidden">{wd?.short}</span>
                              </Badge>
                            );
                          })}
                          {s.is_premium && (
                            <Badge className="bg-amber-500/15 text-amber-400 border-0 font-normal">
                              <Sparkles className="size-3 mr-1" />
                              Premium
                            </Badge>
                          )}
                          {(() => {
                            const f = (folders.data ?? []).find((x) => x.id === s.folder_id);
                            return f ? (
                              <Badge
                                variant="secondary"
                                className="border-0 font-normal"
                                style={{ backgroundColor: `${f.color}26`, color: f.color }}
                              >
                                <Folder className="size-3 mr-1" />
                                {f.name}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                        {s.last_sent_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Último envio: {new Date(s.last_sent_at).toLocaleString("pt-BR")}
                          </p>
                        )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap justify-end pl-5 sm:pl-0">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={(v) => toggleMut.mutate({ id: s.id, isActive: v })}
                        />
                        <Select
                          value={s.folder_id ?? "__none__"}
                          onValueChange={(v) =>
                            moveMut.mutate({ id: s.id, folderId: v === "__none__" ? null : v })
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px] sm:w-[140px] text-xs sm:text-sm" title="Mover para pasta">
                            <SelectValue placeholder="Pasta" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sem pasta</SelectItem>
                            {(folders.data ?? []).map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Enviar teste agora"
                          onClick={() => testMut.mutate(s.id)}
                          disabled={testMut.isPending && testMut.variables === s.id}
                          className="h-8"
                        >
                          {testMut.isPending && testMut.variables === s.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                          <span className="hidden sm:inline">Testar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Duplicar agendamento"
                          onClick={() => openDuplicate(s)}
                          className="h-8"
                        >
                          <Copy className="size-4" />
                          <span className="hidden sm:inline">Duplicar</span>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Excluir este agendamento?")) delMut.mutate(s.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <ScheduleDialog
        editing={editing}
        rooms={rooms.data ?? []}
        accounts={accounts.data ?? []}
        videos={videos.data ?? []}
        folders={folders.data ?? []}
        presetRoomId={presetRoomId}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          try {
            await upsertFn({ data: payload });
            toast.success(payload.id ? "Agendamento atualizado" : "Agendamento criado");
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <ManageFoldersDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        folders={folders.data ?? []}
        onCreate={async (name, color) => {
          await upsertFolderFn({ data: { name, color, sortOrder: (folders.data?.length ?? 0) } });
          await qc.invalidateQueries({ queryKey: ["schedule-folders"] });
        }}
        onRename={async (id, name, color) => {
          await upsertFolderFn({ data: { id, name, color, sortOrder: 0 } });
          await qc.invalidateQueries({ queryKey: ["schedule-folders"] });
        }}
        onDelete={async (id) => {
          await deleteFolderFn({ data: { id } });
          await qc.invalidateQueries({ queryKey: ["schedule-folders"] });
          await qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
          if (activeFolder === id) setActiveFolder("all");
        }}
      />
    </div>
  );
}

function FolderChip({
  active,
  onClick,
  icon,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-muted border-border"
      }`}
      style={active && color ? { backgroundColor: color, borderColor: color, color: "#fff" } : undefined}
    >
      {icon}
      <span>{label}</span>
      <span className={`text-xs ${active ? "opacity-80" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
}

function ManageFoldersDialog({
  open,
  onClose,
  folders,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  folders: ScheduleFolder[];
  onCreate: (name: string, color: string) => Promise<void>;
  onRename: (id: string, name: string, color: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Pastas de agendamentos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-[60%] space-y-1">
              <Label>Nova pasta</Label>
              <Input
                placeholder="Ex: Manhã, Sinais, Promo…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 rounded border border-border bg-transparent shrink-0"
            />
            <Button
              className="shrink-0"
              disabled={!name.trim() || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onCreate(name.trim(), color);
                  setName("");
                  toast.success("Pasta criada");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-72 overflow-auto">
            {folders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma pasta criada.</p>
            ) : (
              folders.map((f) => (
                <FolderRow
                  key={f.id}
                  folder={f}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderRow({
  folder,
  onRename,
  onDelete,
}: {
  folder: ScheduleFolder;
  onRename: (id: string, name: string, color: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2">
      {editing ? (
        <>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-10 rounded border border-border bg-transparent"
          />
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
          <Button
            size="sm"
            onClick={async () => {
              try {
                await onRename(folder.id, name.trim(), color);
                setEditing(false);
                toast.success("Pasta atualizada");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            OK
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(folder.name); setColor(folder.color); }}>
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="size-4 rounded-full" style={{ backgroundColor: folder.color }} />
          <span className="flex-1 truncate">{folder.name}</span>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={async () => {
              if (!confirm(`Excluir pasta "${folder.name}"? Os agendamentos não serão excluídos.`)) return;
              try {
                await onDelete(folder.id);
                toast.success("Pasta removida");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "primary" | "success" | "info";
}) {
  const toneCls =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-400"
      : tone === "info"
        ? "bg-sky-500/15 text-sky-400"
        : "bg-primary/15 text-primary";
  return (
    <Card className="p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className={`size-9 sm:size-11 rounded-xl grid place-items-center shrink-0 ${toneCls}`}>{icon}</div>
      <div>
        <p className="text-xl sm:text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </Card>
  );
}

function ScheduleDialog({
  editing,
  rooms,
  accounts,
  videos,
  folders,
  presetRoomId,
  onClose,
  onSave,
}: {
  editing: Schedule | null;
  rooms: Room[];
  accounts: { id: string; label: string }[];
  videos: { id: string; title: string; kind?: string | null }[];
  folders: ScheduleFolder[];
  presetRoomId: string | null;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    roomId: string;
    accountId: string | null;
    title: string;
    content: string | null;
    videoId: string | null;
    imagePath: string | null;
    imageMime: string | null;
    parseMode: "HTML" | "Markdown" | "MarkdownV2";
    times: string[];
    weekdays: number[];
    weekdayOverrides: Record<string, string[]>;
    followUps: Array<{
      delayMinutes: number;
      delaySeconds?: number | null;
      content: string | null;
      imagePath: string | null;
      imageMime: string | null;
      videoId: string | null;
      buttonText?: string | null;
      buttonUrl?: string | null;
    }>;
    isPremium: boolean;
    isActive: boolean;
    timezone: string;
    buttonText?: string | null;
    buttonUrl?: string | null;
    folderId?: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const testMsgFn = useServerFn(testMessage);
  const [testingPart, setTestingPart] = useState<string | null>(null);
  const [roomId, setRoomId] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [content, setContent] = useState("");
  const [videoId, setVideoId] = useState<string>("");
  const [imagePath, setImagePath] = useState<string>("");
  const [imageMime, setImageMime] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weekdayOverrides, setWeekdayOverrides] = useState<Record<string, string[]>>({});
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
  const [followUps, setFollowUps] = useState<
    Array<{ delayValue: number; delayUnit: "seconds" | "minutes"; content: string; imagePath: string; imageMime: string; videoId: string; buttonText: string; buttonUrl: string }>
  >([]);
  const [followUpUploading, setFollowUpUploading] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [newTime, setNewTime] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [folderId, setFolderId] = useState<string>("");

  const open = !!editing;
  const videoKindById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of videos) m.set(v.id, (v.kind ?? "round") as string);
    return m;
  }, [videos]);
  const isRoundVideo = (vid: string) =>
    !!vid && (videoKindById.get(vid) ?? "round") === "round";

  useMemo(() => {
    if (editing) {
      setTitle(editing.title);
      setRoomId(editing.room_id || presetRoomId || "");
      setAccountId(editing.account_id ?? "");
      setContent(editing.content ?? "");
      setVideoId(editing.video_id ?? "");
      setImagePath(editing.image_path ?? "");
      setImageMime(editing.image_mime ?? "");
      setTimes(editing.times);
      setWeekdays(editing.weekdays);
      setWeekdayOverrides(editing.weekday_overrides ?? {});
      setOverrideInputs({});
      setFollowUps(
        (editing.follow_ups ?? []).map((f) => ({
          delayValue: f.delay_seconds && f.delay_seconds > 0 ? f.delay_seconds : f.delay_minutes,
          delayUnit: (f.delay_seconds && f.delay_seconds > 0 ? "seconds" : "minutes") as
            | "seconds"
            | "minutes",
          content: f.content ?? "",
          imagePath: f.image_path ?? "",
          imageMime: f.image_mime ?? "",
          videoId: f.video_id ?? "",
          buttonText: f.button_text ?? "",
          buttonUrl: f.button_url ?? "",
        })),
      );
      setIsPremium(editing.is_premium);
      setIsActive(editing.is_active);
      setNewTime("");
      setButtonText(editing.button_text ?? "");
      setButtonUrl(editing.button_url ?? "");
      setFolderId(editing.folder_id ?? "");
    } else {
      setButtonText("");
      setButtonUrl("");
      setFolderId("");
    }
  }, [editing, presetRoomId]);

  const imagePublicUrl = useMemo(() => {
    if (!imagePath) return "";
    const { data } = supabase.storage.from("room-images").getPublicUrl(imagePath);
    return data.publicUrl;
  }, [imagePath]);

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `messages/${uid}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("room-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setImagePath(path);
      setImageMime(file.type);
      setVideoId("");
      toast.success("Imagem carregada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const addTime = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) return;
    if (times.includes(newTime)) return;
    setTimes([...times, newTime].sort());
    setNewTime("");
  };

  const toggleWeekday = (v: number) => {
    setWeekdays((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort()));
  };

  const canSave = title.trim() && roomId && times.length > 0 && weekdays.length > 0;

  async function runPartTest(
    key: string,
    payload: {
      content: string;
      videoId: string;
      imagePath: string;
      imageMime: string;
      buttonText: string;
      buttonUrl: string;
    },
  ) {
    if (!roomId) {
      toast.error("Selecione uma sala antes de testar");
      return;
    }
    setTestingPart(key);
    try {
      const res = await testMsgFn({
        data: {
          roomId,
          accountId: accountId || null,
          content: payload.content || null,
          videoId: payload.videoId || null,
          imagePath: payload.videoId ? null : payload.imagePath || null,
          imageMime: payload.videoId ? null : payload.imageMime || null,
          parseMode: "HTML",
          isPremium,
          buttonText: payload.buttonText?.trim() || null,
          buttonUrl: payload.buttonUrl?.trim() || null,
        },
      });
      if (res.ok)
        toast.success(`Teste enviado (${res.sent} grupo${res.sent === 1 ? "" : "s"})`);
      else toast.error(res.error ?? "Falha ao enviar teste");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTestingPart(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 w-[calc(100vw-1rem)] sm:w-auto">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Editar mensagem" : "Nova mensagem"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Identificação */}
            <Card className="p-4 sm:p-5 space-y-4">
              <h3 className="font-semibold">Identificação</h3>
              <div className="space-y-2">
                <Label>
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Bom dia traders!"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>
                    Sala <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={roomId}
                    onValueChange={(v) => {
                      setRoomId(v);
                      if (!accountId) {
                        const r = rooms.find((x) => x.id === v);
                        if (r?.default_account_id) setAccountId(r.default_account_id);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta Telegram</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Padrão da sala" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pasta</Label>
                <Select
                  value={folderId || "__none__"}
                  onValueChange={(v) => setFolderId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Sem pasta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem pasta</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                  <span className="text-sm font-medium">Ativo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPremium}
                    onChange={(e) => setIsPremium(e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                  <span className="text-sm font-medium">Usar emoji premium</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Processa emojis premium da sala antes do envio
              </p>
            </Card>

            {/* Conteúdo */}
            <Card className="p-4 sm:p-5 space-y-4">
              <h3 className="font-semibold">Conteúdo</h3>
              <div className="space-y-2">
                <Label>
                  Mensagem <span className="text-destructive">*</span>
                </Label>
                <div className="flex justify-end -mb-1">
                  <PremiumEmojiPicker value={content} onChange={setContent} />
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder={
                    imagePath
                      ? "Legenda da imagem (opcional)"
                      : videoId
                      ? isRoundVideo(videoId)
                        ? "Vídeos redondos não suportam texto"
                        : "Legenda do vídeo (opcional)"
                      : "Texto da mensagem. Use {NOME} para emojis premium."
                  }
                  disabled={!!videoId && isRoundVideo(videoId)}
                />
                <p className="text-xs text-muted-foreground">
                  Suporta HTML do Telegram: &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;code&gt;. Para emojis premium, use{" "}
                  <code className="px-1 py-0.5 rounded bg-muted">{"{NOME}"}</code>.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Imagem (opcional — texto vira legenda)</Label>
                {imagePath ? (
                  <div className="flex items-start gap-3">
                    <img
                      src={imagePublicUrl}
                      alt="Preview"
                      className="size-24 rounded-md object-cover border border-border"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setImagePath("");
                        setImageMime("");
                      }}
                    >
                      <X className="size-4" /> Remover imagem
                    </Button>
                  </div>
                ) : (
                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer hover:bg-muted/40 text-sm ${
                      videoId ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImageIcon className="size-4" />
                    )}
                    <span>{uploading ? "Enviando..." : "Selecionar imagem"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="space-y-2">
                <Label>Vídeo da biblioteca (opcional — substitui texto/imagem)</Label>
                <Select
                  value={videoId || "none"}
                  onValueChange={(v) => {
                    const next = v === "none" ? "" : v;
                    setVideoId(next);
                    if (next) {
                      setImagePath("");
                      setImageMime("");
                      void ensureVideoThumbnail(next);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhum (enviar texto)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (enviar texto)</SelectItem>
                    {videos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={testingPart === "main" || !roomId}
                  onClick={() =>
                    runPartTest("main", {
                      content,
                      videoId,
                      imagePath,
                      imageMime,
                      buttonText,
                      buttonUrl,
                    })
                  }
                >
                  {testingPart === "main" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Testar esta mensagem
                </Button>
              </div>
            </Card>

            {/* Follow-ups */}
            <Card className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-semibold">Mensagens em sequência</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Envie mais mensagens após a primeira, com um intervalo em minutos.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={followUps.length >= 10}
                  className="shrink-0"
                  onClick={() =>
                    setFollowUps([
                      ...followUps,
                      { delayValue: 1, delayUnit: "minutes", content: "", imagePath: "", imageMime: "", videoId: "", buttonText: "", buttonUrl: "" },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Adicionar conteúdo</span>
                  <span className="sm:hidden">Adicionar</span>
                </Button>
              </div>
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma mensagem em sequência.
                </p>
              ) : (
                <div className="space-y-3">
                  {followUps.map((f, idx) => {
                    const update = (
                      patch: Partial<{
                        delayValue: number;
                        delayUnit: "seconds" | "minutes";
                        content: string;
                        imagePath: string;
                        imageMime: string;
                        videoId: string;
                        buttonText: string;
                        buttonUrl: string;
                      }>,
                    ) => {
                      const next = [...followUps];
                      next[idx] = { ...next[idx], ...patch };
                      setFollowUps(next);
                    };
                    const remove = () =>
                      setFollowUps(followUps.filter((_, i) => i !== idx));
                    const previewUrl = f.imagePath
                      ? supabase.storage.from("room-images").getPublicUrl(f.imagePath).data
                          .publicUrl
                      : "";
                    return (
                      <div key={idx} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            Mensagem #{idx + 2}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={remove}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label className="text-xs whitespace-nowrap">Após:</Label>
                          <Input
                            type="number"
                            min={1}
                            max={f.delayUnit === "seconds" ? 86400 : 1440}
                            value={f.delayValue}
                            onChange={(e) => {
                              const max = f.delayUnit === "seconds" ? 86400 : 1440;
                              update({
                                delayValue: Math.max(1, Math.min(max, Number(e.target.value) || 1)),
                              });
                            }}
                            className="max-w-[100px]"
                          />
                          <Select
                            value={f.delayUnit}
                            onValueChange={(v: "seconds" | "minutes") => {
                              const max = v === "seconds" ? 86400 : 1440;
                              update({
                                delayUnit: v,
                                delayValue: Math.max(1, Math.min(max, f.delayValue)),
                              });
                            }}
                          >
                            <SelectTrigger className="max-w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="seconds">segundos</SelectItem>
                              <SelectItem value="minutes">minutos</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">
                            depois da mensagem anterior
                          </span>
                        </div>
                        <div className="flex justify-end -mb-1">
                          <PremiumEmojiPicker
                            value={f.content}
                            onChange={(v) => update({ content: v })}
                          />
                        </div>
                        <Textarea
                          rows={3}
                          value={f.content}
                          onChange={(e) => update({ content: e.target.value })}
                          placeholder={
                            f.videoId
                              ? isRoundVideo(f.videoId)
                                ? "Vídeos redondos não suportam texto"
                                : "Legenda do vídeo (opcional)"
                              : "Texto desta mensagem (ou legenda da imagem)"
                          }
                          disabled={!!f.videoId && isRoundVideo(f.videoId)}
                        />
                        {f.imagePath ? (
                          <div className="flex items-start gap-3">
                            <img
                              src={previewUrl}
                              alt="Preview"
                              className="size-20 rounded-md object-cover border border-border"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => update({ imagePath: "", imageMime: "" })}
                            >
                              <X className="size-4" /> Remover imagem
                            </Button>
                          </div>
                        ) : (
                          <label
                            className={`flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer hover:bg-muted/40 text-sm w-fit ${
                              f.videoId ? "opacity-50 pointer-events-none" : ""
                            }`}
                          >
                            {followUpUploading === idx ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ImageIcon className="size-4" />
                            )}
                            <span>
                              {followUpUploading === idx
                                ? "Enviando..."
                                : "Imagem (opcional)"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                setFollowUpUploading(idx);
                                try {
                                  const { data: u } = await supabase.auth.getUser();
                                  const uid = u.user?.id;
                                  if (!uid) throw new Error("Sessão expirada");
                                  const ext = (
                                    file.name.split(".").pop() || "jpg"
                                  ).toLowerCase();
                                  const path = `messages/${uid}/${Date.now()}-fu.${ext}`;
                                  const { error } = await supabase.storage
                                    .from("room-images")
                                    .upload(path, file, {
                                      contentType: file.type,
                                      upsert: false,
                                    });
                                  if (error) throw error;
                                  update({ imagePath: path, imageMime: file.type, videoId: "" });
                                  toast.success("Imagem carregada");
                                } catch (err) {
                                  toast.error((err as Error).message);
                                } finally {
                                  setFollowUpUploading(null);
                                }
                              }}
                            />
                          </label>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Vídeo da biblioteca (substitui texto/imagem)
                          </Label>
                          <Select
                            value={f.videoId || "none"}
                            onValueChange={(v) => {
                              const next = v === "none" ? "" : v;
                              if (next) {
                                update({ videoId: next, imagePath: "", imageMime: "" });
                              } else {
                                update({ videoId: "" });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Nenhum (enviar texto/imagem)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum (enviar texto/imagem)</SelectItem>
                              {videos.map((v) => (
                                <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={testingPart === `fu-${idx}` || !roomId}
                            onClick={() =>
                              runPartTest(`fu-${idx}`, {
                                content: f.content,
                                videoId: f.videoId,
                                imagePath: f.imagePath,
                                imageMime: f.imageMime,
                                buttonText: f.buttonText,
                                buttonUrl: f.buttonUrl,
                              })
                            }
                          >
                            {testingPart === `fu-${idx}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Send className="size-4" />
                            )}
                            Testar esta mensagem
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {/* Dias da semana */}
            <Card className="p-4 sm:p-5 space-y-3">
              <h3 className="font-semibold">
                Dias da semana <span className="text-destructive">*</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEEKDAYS.map((d) => {
                  const on = weekdays.includes(d.value);
                  return (
                    <label
                      key={d.value}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-md border cursor-pointer transition ${
                        on
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleWeekday(d.value)}
                        className="size-4 rounded accent-primary"
                      />
                      <span className="text-sm font-medium">{d.label}</span>
                    </label>
                  );
                })}
              </div>
            </Card>

            {/* Horários */}
            <Card className="p-4 sm:p-5 space-y-3">
              <h3 className="font-semibold">
                Horários <span className="text-destructive">*</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Adicione um ou mais horários de envio. A mensagem será enviada a cada horário marcado nos dias configurados.
              </p>
              {times.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum horário adicionado.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {times.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 pr-1">
                      <Clock className="size-3" />
                      {t}
                      <button
                        type="button"
                        onClick={() => setTimes(times.filter((x) => x !== t))}
                        className="ml-1 hover:bg-background/40 rounded p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="max-w-[140px]"
                />
                <Button type="button" onClick={addTime}>
                  <Plus className="size-4" />
                  Adicionar
                </Button>
              </div>
            </Card>

            {/* Horários por dia (override) */}
            {weekdays.length > 0 && (
              <Card className="p-4 sm:p-5 space-y-3">
                <h3 className="font-semibold">Horários específicos por dia (opcional)</h3>
                <p className="text-xs text-muted-foreground">
                  Defina horários diferentes para um dia da semana. Quando houver
                  horários aqui, o horário padrão acima <strong>não</strong> será
                  enviado nesse dia.
                </p>
                <div className="space-y-2">
                  {WEEKDAYS.filter((d) => weekdays.includes(d.value)).map((d) => {
                    const key = String(d.value);
                    const list = weekdayOverrides[key] ?? [];
                    const input = overrideInputs[key] ?? "";
                    const addOverride = () => {
                      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input)) return;
                      if (list.includes(input)) return;
                      setWeekdayOverrides({
                        ...weekdayOverrides,
                        [key]: [...list, input].sort(),
                      });
                      setOverrideInputs({ ...overrideInputs, [key]: "" });
                    };
                    return (
                      <div key={key} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{d.label}</span>
                          {list.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              usa padrão
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...weekdayOverrides };
                                delete next[key];
                                setWeekdayOverrides(next);
                              }}
                              className="text-xs text-destructive hover:underline"
                            >
                              limpar
                            </button>
                          )}
                        </div>
                        {list.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {list.map((t) => (
                              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                                <Clock className="size-3" />
                                {t}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = list.filter((x) => x !== t);
                                    const copy = { ...weekdayOverrides };
                                    if (next.length === 0) delete copy[key];
                                    else copy[key] = next;
                                    setWeekdayOverrides(copy);
                                  }}
                                  className="ml-1 hover:bg-background/40 rounded p-0.5"
                                >
                                  <X className="size-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            type="time"
                            value={input}
                            onChange={(e) =>
                              setOverrideInputs({ ...overrideInputs, [key]: e.target.value })
                            }
                            className="max-w-[140px]"
                          />
                          <Button type="button" size="sm" variant="secondary" onClick={addOverride}>
                            <Plus className="size-4" />
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            disabled={!canSave}
            onClick={() =>
              onSave({
                id: editing?.id || undefined,
                roomId,
                accountId: accountId || null,
                title: title.trim(),
                content: content || null,
                videoId: videoId || null,
                imagePath: videoId ? null : imagePath || null,
                imageMime: videoId ? null : imageMime || null,
                parseMode: "HTML",
                times,
                weekdays,
                weekdayOverrides,
                followUps: followUps.map((f) => ({
                  delayMinutes:
                    f.delayUnit === "seconds"
                      ? Math.max(1, Math.ceil(f.delayValue / 60))
                      : f.delayValue,
                  delaySeconds:
                    f.delayUnit === "seconds" ? f.delayValue : null,
                  content: f.content || null,
                  imagePath: f.imagePath || null,
                  imageMime: f.imageMime || null,
                  videoId: f.videoId || null,
                  buttonText: f.buttonText?.trim() || null,
                  buttonUrl: f.buttonUrl?.trim() || null,
                })),
                isPremium,
                isActive,
                timezone: "America/Sao_Paulo",
                buttonText: buttonText.trim() || null,
                buttonUrl: buttonUrl.trim() || null,
                folderId: folderId || null,
              })
            }
          >
            {editing?.id ? "Salvar alterações" : "Criar mensagem"}
          </Button>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
