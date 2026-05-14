import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResendCooldown } from "@/lib/use-resend-cooldown";

describe("useResendCooldown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("inicia em 0 e permite reenvio", () => {
    const { result } = renderHook(() => useResendCooldown(5));
    expect(result.current.remaining).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it("inicia o cooldown e decrementa a cada segundo", () => {
    const { result } = renderHook(() => useResendCooldown(3));
    act(() => result.current.start());
    expect(result.current.remaining).toBe(3);
    expect(result.current.canResend).toBe(false);
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.remaining).toBe(2);
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.remaining).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it("reiniciar zera o contador anterior", () => {
    const { result } = renderHook(() => useResendCooldown(10));
    act(() => result.current.start());
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current.remaining).toBe(7);
    act(() => result.current.start());
    expect(result.current.remaining).toBe(10);
  });
});