'use client';

import { useCallback, useEffect, useRef } from 'react';

// SFX player: uses MP3 files for correct/wrong; keeps a tiny beep for "next"
export function useSfx() {
  // For the small "next" beep we keep a lightweight AudioContext path
  const ctxRef = useRef<AudioContext | null>(null);
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const audioWindow = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }
      ctxRef.current = new AudioContextCtor();
    }
    return ctxRef.current;
  }, []);

  const correctRef = useRef<HTMLAudioElement | null>(null);
  const wrongRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    correctRef.current = new Audio('/correctanswer.mp3');
    wrongRef.current = new Audio('/wronganswer.mp3');
    if (correctRef.current) {
      correctRef.current.preload = 'auto';
      correctRef.current.volume = 0.9;
    }
    if (wrongRef.current) {
      wrongRef.current.preload = 'auto';
      wrongRef.current.volume = 0.9;
    }
    return () => {
      if (correctRef.current) {
        correctRef.current.pause();
        correctRef.current.src = '';
        correctRef.current = null;
      }
      if (wrongRef.current) {
        wrongRef.current.pause();
        wrongRef.current.src = '';
        wrongRef.current = null;
      }
    };
  }, []);

  const playFromRef = useCallback((ref: React.MutableRefObject<HTMLAudioElement | null>) => {
    const el = ref.current;
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
      void el.play();
    } catch {
      // ignore playback failures (e.g., autoplay policy)
    }
  }, []);

  const playCorrect = useCallback(() => {
    playFromRef(correctRef);
  }, [playFromRef]);

  const playWrong = useCallback(() => {
    playFromRef(wrongRef);
  }, [playFromRef]);

  const beep = useCallback(
    (freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.05) => {
      const ctx = ensureCtx();
      if (!ctx) return;
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
    },
    [ensureCtx]
  );

  const playNext = useCallback(() => {
    // quick whoosh-like double blip
    beep(523.25, 60, 'sine', 0.04);
    setTimeout(() => beep(659.25, 60, 'sine', 0.04), 80);
  }, [beep]);

  return { playCorrect, playWrong, playNext };
}

