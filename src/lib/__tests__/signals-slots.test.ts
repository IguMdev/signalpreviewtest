import { describe, it, expect } from "vitest";
import { buildSlots } from "@/lib/signals.server";

describe("buildSlots — regressão de janelas curtas e exatas", () => {
  it("janela 10:18→10:20 (end exclusivo) usa apenas 10:18 e 10:19", () => {
    expect(buildSlots("10:18", "10:20", 4)).toEqual(["10:18", "10:19"]);
  });

  it("janela longa distribui uniformemente sem incluir o end_time", () => {
    const slots = buildSlots("09:00", "10:00", 5);
    expect(slots[0]).toBe("09:00");
    expect(slots[slots.length - 1]).not.toBe("10:00");
    // 5 sinais em 60min, end exclusivo: passo 12 → 09:00, 09:12, 09:24, 09:36, 09:48
    expect(slots).toEqual(["09:00", "09:12", "09:24", "09:36", "09:48"]);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("janela 14:30→15:30 com 10 sinais nunca inclui 15:30", () => {
    const slots = buildSlots("14:30", "15:30", 10);
    expect(slots).not.toContain("15:30");
    expect(slots[0]).toBe("14:30");
    expect(slots).toHaveLength(10);
  });

  it("retorna vazio em entradas degeneradas", () => {
    expect(buildSlots("10:00", "10:00", 4)).toEqual([]);
    expect(buildSlots("10:00", "11:00", 0)).toEqual([]);
  });

  it("nunca pula nem duplica minutos quando qty > minutos disponíveis", () => {
    // 4 minutos disponíveis (10:00..10:03, end exclusivo), 20 sinais pedidos.
    const slots = buildSlots("10:00", "10:04", 20);
    expect(slots).toEqual(["10:00", "10:01", "10:02", "10:03"]);
  });
});