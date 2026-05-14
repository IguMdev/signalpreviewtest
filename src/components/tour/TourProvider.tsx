import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, ArrowRight, Check } from "lucide-react";

export type TourStep = {
  id: string;
  title: string;
  description: ReactNode;
  /** CSS selector for the element to highlight. If omitted, shows a centered modal. */
  selector?: string;
  /** Route to navigate to before showing this step. */
  route?: string;
  /** Tooltip placement relative to the highlighted element. */
  placement?: "right" | "left" | "top" | "bottom" | "center";
};

type TourContextValue = {
  start: (steps: TourStep[]) => void;
  stop: () => void;
  isActive: boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}

const PADDING = 8;

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [, setTick] = useState(0);
  const targetRef = useRef<Element | null>(null);

  const step = active ? steps[index] : null;

  const start = useCallback((s: TourStep[]) => {
    setSteps(s);
    setIndex(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setSteps([]);
    setIndex(0);
    setRect(null);
    targetRef.current = null;
  }, []);

  // Navigate to step's route if needed
  useEffect(() => {
    if (!step?.route) return;
    if (location.pathname !== step.route) {
      navigate({ to: step.route });
    }
  }, [step, location.pathname, navigate]);

  // Find target element and compute rect (poll briefly because route may still be loading)
  useLayoutEffect(() => {
    if (!active || !step) return;
    if (!step.selector) {
      setRect(null);
      targetRef.current = null;
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector!);
      if (el) {
        targetRef.current = el;
        const r = el.getBoundingClientRect();
        setRect(r);
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } catch {
          /* ignore */
        }
      } else if (attempts < 30) {
        attempts++;
        setTimeout(find, 100);
      } else {
        targetRef.current = null;
        setRect(null);
      }
    };
    find();
    return () => {
      cancelled = true;
    };
  }, [active, step, location.pathname]);

  // Recompute rect on resize/scroll
  useEffect(() => {
    if (!active) return;
    const recompute = () => {
      if (targetRef.current) {
        setRect(targetRef.current.getBoundingClientRect());
      }
      setTick((t) => t + 1);
    };
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [active]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        setActive(false);
        return 0;
      }
      return i + 1;
    });
  }, [steps.length]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard support
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, prev, stop]);

  const value = useMemo(() => ({ start, stop, isActive: active }), [start, stop, active]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && step && typeof document !== "undefined"
        ? createPortal(
            <TourOverlay
              step={step}
              stepIndex={index}
              total={steps.length}
              rect={rect}
              onNext={next}
              onPrev={prev}
              onClose={stop}
            />,
            document.body,
          )
        : null}
    </TourContext.Provider>
  );
}

function TourOverlay({
  step,
  stepIndex,
  total,
  rect,
  onNext,
  onPrev,
  onClose,
}: {
  step: TourStep;
  stepIndex: number;
  total: number;
  rect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const isLast = stepIndex === total - 1;
  const isFirst = stepIndex === 0;
  const placement = step.placement ?? (rect ? "right" : "center");

  const TOOLTIP_W = 360;
  const tooltipStyle: React.CSSProperties = {};
  if (rect && placement !== "center") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;
    if (placement === "right") {
      tooltipStyle.left = Math.min(rect.right + margin, vw - TOOLTIP_W - margin);
      tooltipStyle.top = Math.max(margin, Math.min(rect.top, vh - 240));
    } else if (placement === "left") {
      tooltipStyle.left = Math.max(margin, rect.left - TOOLTIP_W - margin);
      tooltipStyle.top = Math.max(margin, Math.min(rect.top, vh - 240));
    } else if (placement === "bottom") {
      tooltipStyle.left = Math.max(
        margin,
        Math.min(rect.left, vw - TOOLTIP_W - margin),
      );
      tooltipStyle.top = rect.bottom + margin;
    } else if (placement === "top") {
      tooltipStyle.left = Math.max(
        margin,
        Math.min(rect.left, vw - TOOLTIP_W - margin),
      );
      tooltipStyle.top = Math.max(margin, rect.top - 240);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Spotlight via SVG mask, allows underneath to remain visible but blocks clicks */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onClick={(e) => {
          // click on dim area = no-op (don't close accidentally)
          e.stopPropagation();
        }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={Math.max(0, rect.left - PADDING)}
                y={Math.max(0, rect.top - PADDING)}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-mask)"
        />
        {rect && (
          <rect
            x={Math.max(0, rect.left - PADDING)}
            y={Math.max(0, rect.top - PADDING)}
            width={rect.width + PADDING * 2}
            height={rect.height + PADDING * 2}
            rx={12}
            ry={12}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className="pointer-events-auto absolute"
        style={
          placement === "center"
            ? {
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: TOOLTIP_W,
              }
            : { ...tooltipStyle, width: TOOLTIP_W }
        }
      >
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Passo {stepIndex + 1} de {total}
              </p>
              <h3 className="font-semibold text-base mt-0.5">{step.title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fechar tutorial"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={isFirst}
            >
              <ArrowLeft className="size-4" />
              Anterior
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Pular
              </Button>
              <Button size="sm" onClick={onNext}>
                {isLast ? (
                  <>
                    <Check className="size-4" /> Concluir
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}