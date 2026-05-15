// Helpers puros para agregação de relatórios e verificação de slot exato.
// Sem dependências de runtime — fáceis de testar.

export type TerminalCandidate = {
  status: string;
  gale_level?: number | null;
  max_gales?: number | null;
  entry_at: string | Date;
};

export function reportDateKey(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Considera apenas eventos terminais do ciclo:
 * - qualquer win/win_g1/win_g2 conta como vitória
 * - loss conta apenas quando esgotou os gales (gale_level >= max_gales)
 * Isso evita contar duas vezes o pai "loss" cujo filho gale venceu.
 */
export function aggregateTerminalStats(events: TerminalCandidate[], opts: { tz: string; now: Date }) {
  const todayKey = reportDateKey(opts.now, opts.tz);
  const inToday = events.filter(
    (e) => reportDateKey(new Date(e.entry_at), opts.tz) === todayKey,
  );
  const terminal = inToday.filter((e) => {
    const st = String(e.status);
    if (st === "win" || st === "win_g1" || st === "win_g2") return true;
    if (st === "loss" && Number(e.gale_level ?? 0) >= Number(e.max_gales ?? 0)) return true;
    return false;
  });
  const totalWins = terminal.filter((e) =>
    ["win", "win_g1", "win_g2"].includes(String(e.status)),
  ).length;
  const totalLosses = terminal.filter((e) => String(e.status) === "loss").length;
  const total = totalWins + totalLosses;
  const winRate = total ? Math.round((totalWins / total) * 100) : 0;
  return { totalWins, totalLosses, total, winRate };
}

/**
 * HH:MM (no tz da sala) do próximo minuto cheio para `now`.
 * Usado para garantir que os sinais disparem exatamente no minuto configurado.
 */
export function nextMinuteHHMM(now: Date, tz: string): string {
  const next = new Date(Math.ceil((now.getTime() + 1) / 60000) * 60000);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(next);
}

/** Tenta executar `fn` com retries em falhas transitórias. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; isRetryable?: (r: T | undefined, err: unknown) => boolean } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseMs ?? 400;
  let lastErr: unknown;
  let lastRes: T | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      lastRes = await fn();
      const retry = opts.isRetryable ? opts.isRetryable(lastRes, undefined) : false;
      if (!retry) return lastRes;
    } catch (e) {
      lastErr = e;
      const retry = opts.isRetryable ? opts.isRetryable(undefined, e) : true;
      if (!retry) throw e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, base * Math.pow(2, i)));
  }
  if (lastRes !== undefined) return lastRes;
  throw lastErr ?? new Error("withRetry: exhausted attempts");
}