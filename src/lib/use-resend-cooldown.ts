import { useCallback, useEffect, useRef, useState } from "react";

// Hook para cooldown de reenvio de código (Premium account).
// Mantém um contador regressivo em segundos e expõe `start()`.
export function useResendCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clear();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [clear, seconds]);

  useEffect(() => clear, [clear]);

  return { remaining, start, canResend: remaining === 0 };
}