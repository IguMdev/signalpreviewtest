import { describe, it, expect } from "vitest";
import { translatePremiumError, premiumStrings as S } from "@/lib/premium-strings";

describe("translatePremiumError", () => {
  it("traduz código inválido", () => {
    expect(translatePremiumError(new Error("PHONE_CODE_INVALID"))).toBe(
      S.errors.invalidCode,
    );
  });

  it("traduz código expirado", () => {
    expect(translatePremiumError(new Error("PHONE_CODE_EXPIRED"))).toBe(
      S.errors.expiredCode,
    );
  });

  it("traduz 2FA inválido", () => {
    expect(translatePremiumError(new Error("PASSWORD_HASH_INVALID"))).toBe(
      S.errors.invalid2fa,
    );
  });

  it("traduz timeout/rede", () => {
    expect(translatePremiumError(new Error("fetch failed"))).toBe(S.errors.timeout);
    expect(translatePremiumError(new Error("ETIMEDOUT"))).toBe(S.errors.timeout);
  });

  it("extrai segundos do FLOOD_WAIT", () => {
    expect(translatePremiumError(new Error("FLOOD_WAIT_42"))).toContain("42");
  });

  it("retorna fallback para erro genérico", () => {
    expect(translatePremiumError(new Error("algo deu errado"))).toBe("algo deu errado");
    expect(translatePremiumError(undefined)).toBe(S.toasts.genericFail);
  });

  it("nenhuma string contém escapes \\u00xx literais", () => {
    const all = JSON.stringify(S);
    expect(all).not.toMatch(/\\u00[0-9a-fA-F]{2}/);
  });
});