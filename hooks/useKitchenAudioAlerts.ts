"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "darkit:kitchen-audio-enabled";

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function getAudioContext(
  ctxRef: React.MutableRefObject<AudioContext | null>,
): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctxRef.current) {
    const AudioCtx =
      window.AudioContext ||
      (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtx) return null;
    ctxRef.current = new AudioCtx();
  }
  if (ctxRef.current.state === "suspended") {
    void ctxRef.current.resume().catch(() => {
      // Browser autoplay policy requires prior gesture
    });
  }
  return ctxRef.current;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startOffsetSec: number,
  durationSec: number,
  gainPeak = 0.14,
  type: OscillatorType = "sine",
): void {
  const startTime = ctx.currentTime + startOffsetSec;
  const endTime = startTime + durationSec;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(endTime + 0.02);
}

export interface KitchenAudioAlertsApi {
  audioEnabled: boolean;
  toggleAudio: () => void;
  playNewOrderChime: (orderId?: string) => void;
  playSlaBreachAlert: (orderId?: string) => void;
}

export function useKitchenAudioAlerts(): KitchenAudioAlertsApi {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const newOrderChimedIds = useRef<Set<string>>(new Set());
  const slaBreachChimedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setAudioEnabled(true);
      }
    } catch {
      // Ignore storage access failures in restricted environments
    }
  }, []);

  const synthesizeNewOrder = useCallback(() => {
    const ctx = getAudioContext(ctxRef);
    if (!ctx) return;
    // Ascending two-note chime: D5 (587.33 Hz) -> A5 (880 Hz), 180ms each
    playTone(ctx, 587.33, 0, 0.18, 0.14, "triangle");
    playTone(ctx, 880, 0.19, 0.18, 0.16, "triangle");
  }, []);

  const synthesizeSlaBreach = useCallback(() => {
    const ctx = getAudioContext(ctxRef);
    if (!ctx) return;
    // Urgent double-pulse alert: A4 (440 Hz) -> F4 (349.23 Hz), 260ms
    playTone(ctx, 440, 0, 0.13, 0.16, "sawtooth");
    playTone(ctx, 349.23, 0.14, 0.12, 0.14, "sawtooth");
    playTone(ctx, 440, 0.32, 0.13, 0.16, "sawtooth");
    playTone(ctx, 349.23, 0.46, 0.12, 0.14, "sawtooth");
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage failures
      }
      if (next) {
        synthesizeNewOrder();
      }
      return next;
    });
  }, [synthesizeNewOrder]);

  const playNewOrderChime = useCallback(
    (orderId?: string) => {
      if (!audioEnabled) return;
      if (orderId) {
        if (newOrderChimedIds.current.has(orderId)) return;
        newOrderChimedIds.current.add(orderId);
      }
      synthesizeNewOrder();
    },
    [audioEnabled, synthesizeNewOrder],
  );

  const playSlaBreachAlert = useCallback(
    (orderId?: string) => {
      if (!audioEnabled) return;
      if (orderId) {
        if (slaBreachChimedIds.current.has(orderId)) return;
        slaBreachChimedIds.current.add(orderId);
      }
      synthesizeSlaBreach();
    },
    [audioEnabled, synthesizeSlaBreach],
  );

  return {
    audioEnabled,
    toggleAudio,
    playNewOrderChime,
    playSlaBreachAlert,
  };
}
