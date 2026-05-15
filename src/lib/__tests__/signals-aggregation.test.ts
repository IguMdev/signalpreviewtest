import { describe, it, expect } from "vitest";
import {
  aggregateTerminalStats,
  nextMinuteHHMM,
  reportDateKey,
  withRetry,
} from "@/lib/signals-aggregation";

describe("aggregateTerminalStats", () => {
  const tz = "America/Sao_Paulo";
  const now = new Date("2026-05-15T13:30:00Z"); // 10:30 BRT

  it("conta apenas eventos terminais do dia, ignorando pais não-terminais", () => {
    const events = [
      // pai loss seguido de filho win — só o filho conta
      { status: "loss", gale_level: 0, max_gales: 2, entry_at: "2026-05-15T13:00:00Z" },
      { status: "win_g1", gale_level: 1, max_gales: 2, entry_at: "2026-05-15T13:01:00Z" },
      // loss esgotou os gales → conta como derrota
      { status: "loss", gale_level: 2, max_gales: 2, entry_at: "2026-05-15T13:05:00Z" },
      // win simples
      { status: "win", gale_level: 0, max_gales: 2, entry_at: "2026-05-15T13:10:00Z" },
      // dia anterior — ignorado
      { status: "win", gale_level: 0, max_gales: 2, entry_at: "2026-05-14T13:10:00Z" },
      // ainda enviado / em andamento — ignorado
      { status: "sent", gale_level: 0, max_gales: 2, entry_at: "2026-05-15T13:15:00Z" },
    ];
    const r = aggregateTerminalStats(events, { tz, now });
    expect(r).toEqual({ totalWins: 2, totalLosses: 1, total: 3, winRate: 67 });
  });

  it("retorna zero quando não há eventos terminais hoje", () => {
    expect(aggregateTerminalStats([], { tz, now })).toEqual({
      totalWins: 0,
      totalLosses: 0,
      total: 0,
      winRate: 0,
    });
  });
});

describe("reportDateKey + nextMinuteHHMM (timezone)", () => {
  it("respeita timezone da sala", () => {
    const utc = new Date("2026-05-16T02:30:00Z");
    expect(reportDateKey(utc, "America/Sao_Paulo")).toBe("2026-05-15");
    expect(reportDateKey(utc, "UTC")).toBe("2026-05-16");
  });

  it("nextMinuteHHMM aponta para o próximo minuto cheio no tz", () => {
    const at = new Date("2026-05-15T13:18:30Z"); // 10:18:30 BRT
    expect(nextMinuteHHMM(at, "America/Sao_Paulo")).toBe("10:19");
    // edge: já no segundo 0 do minuto X, próximo minuto cheio é X+1
    const at2 = new Date("2026-05-15T13:19:00Z");
    expect(nextMinuteHHMM(at2, "America/Sao_Paulo")).toBe("10:20");
  });
});

describe("withRetry", () => {
  it("repete em falha e devolve resultado bem-sucedido", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) return { ok: false } as { ok: boolean; value?: number };
        return { ok: true, value: 42 };
      },
      { attempts: 3, baseMs: 1, isRetryable: (res) => !res?.ok },
    );
    expect(calls).toBe(3);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it("para após N tentativas e devolve último resultado", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        return { ok: false };
      },
      { attempts: 2, baseMs: 1, isRetryable: (res) => !res?.ok },
    );
    expect(calls).toBe(2);
    expect(r).toEqual({ ok: false });
  });

  it("não repete quando isRetryable=false", async () => {
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        return { ok: true };
      },
      { attempts: 5, baseMs: 1, isRetryable: () => false },
    );
    expect(calls).toBe(1);
  });
});