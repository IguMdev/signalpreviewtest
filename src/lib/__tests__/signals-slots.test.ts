import { describe, it, expect } from "vitest";
import { buildSlots } from "@/lib/signals.server";

describe("buildSlots — regressão de janelas curtas e exatas", () => {
  it("janela 10:18→10:20 com 4 sinais distribui em 3 minutos sem duplicar", () => {
    expect(buildSlots("10:18", "10:20", 4)).toEqual(["10:18", "10:19", "10:20"]);
  });

  it("janela longa distribui uniformemente", () => {
    const slots = buildSlots("09:00", "10:00", 5);
    expect(slots[0]).toBe("09:00");
    expect(slots[slots.length - 1]).toBe("10:00");
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("retorna vazio em entradas degeneradas", () => {
    expect(buildSlots("10:00", "10:00", 4)).toEqual([]);
    expect(buildSlots("10:00", "11:00", 0)).toEqual([]);
  });

  it("nunca pula nem duplica minutos quando qty > minutos disponíveis", () => {
    // 5 minutos disponíveis (10:00..10:04), 20 sinais pedidos.
    const slots = buildSlots("10:00", "10:04", 20);
    expect(slots).toEqual(["10:00", "10:01", "10:02", "10:03", "10:04"]);
  });
});