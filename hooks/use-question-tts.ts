"use client";

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

export function useQuestionTTS(enabled: boolean, text: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // singleton audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "none";
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const warnedRef = useRef(false);

  // play on question change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!enabled || !text || !text.trim()) return;

    // stop any previous playback
    audio.pause();
    audio.currentTime = 0;
    const url = `/api/tts/stream?text=${encodeURIComponent(text)}`;
    audio.src = url;
    audio.play().catch(() => {
      // Autoplay blocked or user hasn't interacted
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast("Enable audio by tapping after interaction.", { description: "Autoplay was blocked by the browser." });
      }
    });
  }, [enabled, text]);

  const api = useMemo(
    () => ({
      speak: (t: string) => {
        const audio = audioRef.current;
        if (!audio) return;
        if (!enabled) return;
        audio.pause();
        audio.currentTime = 0;
        audio.src = `/api/tts/stream?text=${encodeURIComponent(t)}`;
        void audio.play();
      },
      stop: () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
      },
    }),
    [enabled]
  );

  return api;
}


