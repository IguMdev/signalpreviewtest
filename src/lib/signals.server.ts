import { ASSETS_CATALOG, type AssetCategory } from "./assets-catalog";

// ╔══════════════════════════════════════════════════════════╗
// ║  LIB SERVER — SIGNALS (helpers de sinais)                ║
// ║  Slots de envio, escolha de ativo/binário e candle M1.   ║
// ║  Usado por dispatch-signals.                             ║
// ╚══════════════════════════════════════════════════════════╝

// Mapeia assets do catálogo para símbolos da Binance Spot (somente cripto reais)
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  ADAUSDT: "ADAUSDT", BNBUSDT: "BNBUSDT", BTCUSDT: "BTCUSDT",
  DOGEUSDT: "DOGEUSDT", ETHUSDT: "ETHUSDT", LTCUSDT: "LTCUSDT",
  SOLUSDT: "SOLUSDT", SUIUSDT: "SUIUSDT", XRPUSDT: "XRPUSDT",
  Litecoin: "LTCUSDT", Bitcoin: "BTCUSDT", Ethereum: "ETHUSDT",
};

export function categoryFor(assetCode: string): AssetCategory | null {
  for (const [cat, list] of Object.entries(ASSETS_CATALOG) as [AssetCategory, string[]][]) {
    if (list.includes(assetCode)) return cat;
  }
  return null;
}

/**
 * Busca preços real-time da Binance (grátis, sem API key).
 * Retorna preço de abertura da vela M1 que contém `entryAt` e fechamento da mesma vela.
 */
export async function getBinanceM1Candle(asset: string, entryAt: Date): Promise<{ open: number; close: number } | null> {
  const symbol = BINANCE_SYMBOL_MAP[asset];
  if (!symbol) return null;
  // alinha ao minuto da entrada
  const minuteStart = Math.floor(entryAt.getTime() / 60000) * 60000;
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${minuteStart}&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = (await res.json()) as unknown[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const k = arr[0] as (string | number)[];
    return { open: Number(k[1]), close: Number(k[4]) };
  } catch {
    return null;
  }
}

/** Calcula resultado de um trade binário (alta/baixa) */
export function resolveBinary(direction: "buy" | "sell", open: number, close: number): "win" | "loss" | "draw" {
  if (close === open) return "draw";
  const up = close > open;
  if (direction === "buy" && up) return "win";
  if (direction === "sell" && !up) return "win";
  return "loss";
}

/** Substitui macros no template de mensagem */
export function renderTemplate(
  tpl: string,
  vars: {
    ATIVO: string;
    TIMEFRAME: string;
    DIRECAO: string;
    ENTRADA: string;
    ENTRADAGALE1?: string;
    ENTRADAGALE2?: string;
    MARTINGALE?: string;
  },
): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v ?? `{${key}}`;
  });
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Retorna lista de horários (HH:MM) distribuídos uniformemente entre start e end */
export function buildSlots(startHHMM: string, endHHMM: string, qty: number): string[] {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMin(startHHMM);
  const end = toMin(endHHMM);
  const total = Math.max(0, end - start);
  if (qty <= 0 || total <= 0) return [];
  // end_time é EXCLUSIVO: o último sinal cai antes do fim da janela
  // (uma janela 14:30→15:30 nunca dispara às 15:30).
  // Minutos disponíveis: start .. end-1.
  const available = total;
  const effectiveQty = Math.min(qty, available);
  const slots = new Set<string>();
  for (let i = 0; i < effectiveQty; i++) {
    // distribuição uniforme: passo = total / qty, primeiro slot em start,
    // último slot em start + total*(qty-1)/qty (sempre < end).
    const offset = Math.floor((i * total) / effectiveQty);
    const m = start + offset;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.add(`${hh}:${mm}`);
  }
  return Array.from(slots);
}

export function nowParts(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // Convenção JS (Date.getDay): Dom=0, Seg=1 ... Sáb=6 — bate com a UI das janelas.
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: wdMap[get("weekday")] ?? 0,
    hhmm: `${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}`,
  };
}