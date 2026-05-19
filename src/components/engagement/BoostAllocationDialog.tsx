import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Users, Heart, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listPendingBoostAllocations,
  listEligibleBoostRooms,
  allocateSubscriptionToRoom,
} from "@/lib/engagement.functions";

/**
 * Dialog global que abre automaticamente quando o usuário tem uma assinatura
 * de inscritos/interacoes recém-paga ainda sem canal vinculado. Cliente
 * escolhe 1 sala e o disparo no painel SMM acontece em seguida.
 */
export function BoostAllocationDialog() {
  const qc = useQueryClient();
  const fetchPending = useServerFn(listPendingBoostAllocations);
  const fetchRooms = useServerFn(listEligibleBoostRooms);
  const allocate = useServerFn(allocateSubscriptionToRoom);

  const pendingQuery = useQuery({
    queryKey: ["pending-boost-allocations"],
    queryFn: () => fetchPending(),
    refetchInterval: 30_000,
  });
  const pending = pendingQuery.data ?? [];
  const current = pending[0] as any | undefined;

  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(!!current);
  }, [current?.id]);

  const roomsQuery = useQuery({
    queryKey: ["eligible-boost-rooms"],
    queryFn: () => fetchRooms(),
    enabled: open,
  });
  const rooms = roomsQuery.data ?? [];

  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);

  if (!current) return null;

  const isMembers = current.bot_type === "inscritos";
  const planName = current.plan?.name ?? "Plano";
  const quota = current.plan?.monthly_quota ?? 0;

  async function handlePick(roomId: string) {
    try {
      setBusyRoomId(roomId);
      const res = await allocate({ data: { subscriptionId: current.id, roomId } });
      if ((res as any)?.mode === "dispatched") {
        toast.success(`Disparado! ${(res as any).quantity} membros enviados ao painel.`);
      } else {
        toast.success("Canal vinculado. Reações começarão a sair nos próximos sinais.");
      }
      qc.invalidateQueries({ queryKey: ["pending-boost-allocations"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alocar.");
    } finally {
      setBusyRoomId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) return; setOpen(o); }}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Escolha o canal para o {planName}
          </DialogTitle>
          <DialogDescription>
            {isMembers ? (
              <>Sua assinatura tem <b>{quota} membros</b> para entregar. Escolha 1 canal — o disparo no painel acontece em seguida e é único no mês. Para usar em outro canal, é preciso outra assinatura.</>
            ) : (
              <>Sua assinatura entrega <b>{quota} reações por sinal</b>. Escolha o canal que vai receber — todo sinal publicado nesse canal recebe reações automaticamente.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {roomsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando salas...</p>
        ) : rooms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
            <Lock className="size-6 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma sala com canal público.</p>
            <p className="text-xs text-muted-foreground">
              Vincule um canal Telegram público (com @username) a uma das suas salas em <b>Salas → Editar</b> para liberar o disparo.
            </p>
          </div>
        ) : (
          <div className="grid gap-2 max-h-[420px] overflow-y-auto">
            {rooms.map((r: any) => {
              const busy = busyRoomId === r.id;
              const anyBusy = busyRoomId !== null;
              return (
                <Card
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 p-3 transition border",
                    busy ? "border-primary bg-primary/5" : "hover:border-primary/40",
                  )}
                >
                  {r.photoUrl ? (
                    <img src={r.photoUrl} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="size-10 rounded-full bg-muted grid place-items-center text-xs font-bold text-muted-foreground">
                      {(r.name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{r.username} · {r.channelTitle ?? "—"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={anyBusy}
                    onClick={() => handlePick(r.id)}
                    className="gap-1.5"
                  >
                    {isMembers ? <Users className="size-3.5" /> : <Heart className="size-3.5" />}
                    {busy ? "Disparando..." : "Usar este canal"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        {pending.length > 1 && (
          <p className="text-xs text-muted-foreground text-center">
            Você tem mais {pending.length - 1} assinatura(s) aguardando alocação. Vão aparecer em sequência.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}