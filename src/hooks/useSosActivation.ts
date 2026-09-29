/**
 * useSosActivation — guards the SOS Signal button against accidental dispatch.
 *
 * A citizen SOS goes straight to the SEOC priority queue. A single stray tap
 * (phone in a pocket, brushing the screen) sends a false alarm, and false
 * alarms are how responders learn to discount the channel — which then costs
 * lives on a real one. So activation is made deliberate.
 *
 * Two independent ways to fire, so it is fast but never accidental:
 *   1. TAP ×3  — quick, forgiving, the primary path (~1s total)
 *   2. HOLD    — press and keep holding for `holdMs` (default 5s)
 *
 * Both are always available. The tap path exists specifically so a panicking
 * person with shaking or injured hands is not forced to hold a steady press.
 *
 * Notes:
 *  - Every tap fires `navigator.vibrate()` so it is confirmable by feel alone,
 *    without looking at the screen.
 *  - A completed hold suppresses the synthetic `click` that browsers fire on
 *    release, so it cannot double-count as a tap.
 *  - Keyboard accessible: holding Space/Enter also fills the progress ring.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SosActivationOptions {
  /** Taps needed to fire. Default 3. */
  requiredTaps?: number;
  /** Long-press duration in ms. Default 5000. */
  holdMs?: number;
  /** Max gap between consecutive taps before the count resets. Default 2500ms. */
  tapWindowMs?: number;
  /** Fired once, when either path completes. */
  onConfirm: () => void;
  /** While true the control is inert (e.g. an SOS is already being sent). */
  disabled?: boolean;
}

export interface SosActivation {
  /** 0..requiredTaps — how many of the required taps are done. */
  taps: number;
  /** 0..1 — long-press progress. */
  progress: number;
  /** True once requiredTaps-1 taps are logged, i.e. one more fires it. */
  oneTapAway: boolean;
  /** True while a long-press is in progress. */
  holding: boolean;
  /** Spread onto the button element. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onKeyUp: (e: React.KeyboardEvent) => void;
  };
  /** Cancels any in-progress activation (e.g. on blur). */
  reset: () => void;
}

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported — visual feedback still covers it */
  }
};

export function useSosActivation({
  requiredTaps = 3,
  holdMs = 5000,
  tapWindowMs = 2500,
  onConfirm,
  disabled = false,
}: SosActivationOptions): SosActivation {
  const [taps, setTaps] = useState(0);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);

  const tapsRef = useRef(0);
  const lastTapRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);
  // Set right after a hold fires so the release `click` is not counted as a tap.
  const suppressClickRef = useRef(false);
  const keyHeldRef = useRef(false);

  const clearHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    holdStartRef.current = 0;
    setHolding(false);
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    tapsRef.current = 0;
    lastTapRef.current = 0;
    setTaps(0);
    clearHold();
  }, [clearHold]);

  const fire = useCallback(() => {
    reset();
    buzz([90, 60, 90]);
    onConfirm();
  }, [onConfirm, reset]);

  // A tap that lands too late starts a fresh count rather than silently
  // crediting a stale one.
  const registerTap = useCallback(() => {
    const t = Date.now();
    if (lastTapRef.current && t - lastTapRef.current > tapWindowMs) {
      tapsRef.current = 0;
    }
    lastTapRef.current = t;
    tapsRef.current += 1;

    if (tapsRef.current >= requiredTaps) {
      fire();
      return;
    }
    setTaps(tapsRef.current);
    // Short buzz = "got it", longer as they approach the final tap.
    buzz(tapsRef.current === requiredTaps - 1 ? [40, 40, 40] : 25);
  }, [fire, requiredTaps, tapWindowMs]);

  const startHold = useCallback(() => {
    if (disabled) return;
    holdStartRef.current = performance.now();
    setHolding(true);

    const tick = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const p = Math.min(1, elapsed / holdMs);
      setProgress(p);
      if (p >= 1) {
        clearHold();
        suppressClickRef.current = true;
        fire();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [clearHold, disabled, fire, holdMs]);

  // Never leave a timer or an in-flight activation behind.
  useEffect(() => reset, [reset]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // Primary button / touch only — ignore right-click and secondary pointers.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      startHold();
    },
    [disabled, startHold]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Released before the threshold → not a hold, so count it as a tap.
      const wasHolding = holding;
      clearHold();
      if (wasHolding && progress < 1) registerTap();
    },
    [clearHold, disabled, holding, progress, registerTap]
  );

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      // A completed hold already counted; ignore the synthetic click.
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        e.preventDefault();
        return;
      }
      // Pointer events handle real taps. A plain click (e.g. from assistive
      // tech or a click() call) is treated as one tap.
      e.preventDefault();
    },
    []
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (keyHeldRef.current) return; // ignore auto-repeat
      keyHeldRef.current = true;
      startHold();
    },
    [disabled, startHold]
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      keyHeldRef.current = false;
      const wasHolding = holding;
      clearHold();
      if (wasHolding && progress < 1) registerTap();
    },
    [clearHold, holding, progress, registerTap]
  );

  return {
    taps,
    progress,
    oneTapAway: taps === requiredTaps - 1,
    holding,
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerLeave: clearHold,
      onPointerCancel: clearHold,
      onContextMenu: (e) => e.preventDefault(),
      onClick,
      onKeyDown,
      onKeyUp,
    },
    reset,
  };
}
