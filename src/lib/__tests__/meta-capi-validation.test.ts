import { describe, it, expect } from "vitest";
import { applyMetaEventDefaults, META_EVENT_SPECS } from "../meta-capi.server";
import { META_EVENT_OPTIONS } from "../meta-capi.functions";

describe("applyMetaEventDefaults", () => {
  it("Purchase sem value/currency reporta required ausentes (mas auto-preenche para nunca enviar quebrado)", () => {
    const r = applyMetaEventDefaults("Purchase", {});
    // auto-default monetário garante value=0, currency=BRL — required passa
    expect(r.customData.value).toBe(0);
    expect(r.customData.currency).toBe("BRL");
    expect(r.missingRequired).toEqual([]);
  });

  it("Purchase com value preserva o valor", () => {
    const r = applyMetaEventDefaults("Purchase", { value: 99.9, currency: "USD" });
    expect(r.customData.value).toBe(99.9);
    expect(r.customData.currency).toBe("USD");
    expect(r.missingRequired).toEqual([]);
  });

  it("Subscribe e StartTrial são monetários", () => {
    expect(applyMetaEventDefaults("Subscribe", {}).customData.currency).toBe("BRL");
    expect(applyMetaEventDefaults("StartTrial", {}).customData.currency).toBe("BRL");
  });

  it("Search sem search_string gera warning recomendado mas não bloqueia", () => {
    const r = applyMetaEventDefaults("Search", {});
    expect(r.missingRequired).toEqual([]);
    expect(r.warnings.some((w) => w.includes("search_string"))).toBe(true);
  });

  it("Lead/CompleteRegistration/ViewContent não exigem required fields", () => {
    for (const ev of ["Lead", "CompleteRegistration", "ViewContent", "Contact"]) {
      expect(applyMetaEventDefaults(ev, {}).missingRequired).toEqual([]);
    }
  });

  it("Evento desconhecido gera warning mas não bloqueia", () => {
    const r = applyMetaEventDefaults("FooBarEvent", {});
    expect(r.missingRequired).toEqual([]);
    expect(r.warnings.some((w) => w.includes("unknown event"))).toBe(true);
  });

  it("Todas as opções expostas na UI têm spec definido (exceto 'off')", () => {
    for (const ev of META_EVENT_OPTIONS) {
      if (ev === "off") continue;
      expect(
        META_EVENT_SPECS[ev],
        `Faltou definir META_EVENT_SPECS["${ev}"]`,
      ).toBeDefined();
    }
  });

  it("Não muta o objeto customData passado", () => {
    const input = { value: 10 };
    applyMetaEventDefaults("Purchase", input);
    expect(input).toEqual({ value: 10 });
  });
});