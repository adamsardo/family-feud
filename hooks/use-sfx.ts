'use client';

import { useCallback, useRef } from 'react';

// Lightweight WebAudio-based SFX to avoid bundling audio files.
export function useSfx() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return ctxRef.current!;
  };

  const beep = useCallback((freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.05) => {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  }, []);

  const playCorrect = useCallback(() => {
    // small up-chirp
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 440;
    g.gain.value = 0.06;
    osc.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(660, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.18);
  }, []);

  const playWrong = useCallback(() => {
    // short buzzer
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 110;
    g.gain.value = 0.05;
    osc.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.3);
  }, []);

  const playNext = useCallback(() => {
    // quick whoosh-like double blip
    beep(523.25, 60, 'sine', 0.04);
    setTimeout(() => beep(659.25, 60, 'sine', 0.04), 80);
  }, [beep]);

  return { playCorrect, playWrong, playNext };
}


