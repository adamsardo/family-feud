"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSurveySaysTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedUrlRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const endedListenerRef = useRef<(() => void) | null>(null);

  const preCache = useCallback(async (voiceId?: string) => {
    if (cachedUrlRef.current) return; // Already cached

    try {
      setIsLoading(true);
      const params = new URLSearchParams({ text: "Survey says!" });
      if (voiceId) {
        params.append("voiceId", voiceId);
      }
      const response = await fetch(`/api/tts/stream?${params.toString()}`);

      if (!response.ok) {
        console.error("Failed to pre-cache Survey Says audio");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      cachedUrlRef.current = url;

      // Pre-load audio element
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
        audioRef.current.volume = 0.8;
      } else {
        audioRef.current.src = url;
      }
    } catch (error) {
      console.error("Error pre-caching Survey Says:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const play = useCallback(async (): Promise<void> => {
    if (!audioRef.current || !cachedUrlRef.current) {
      console.warn("Survey Says audio not cached");
      return Promise.resolve();
    }

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();

      // Return promise that resolves when audio finishes
      return new Promise((resolve) => {
        const onEnded = () => {
          if (audioRef.current) {
            audioRef.current.removeEventListener("ended", onEnded);
          }
          endedListenerRef.current = null;
          resolve();
        };
        endedListenerRef.current = onEnded;
        audioRef.current?.addEventListener("ended", onEnded);
      });
    } catch (error) {
      console.error("Error playing Survey Says:", error);
      return Promise.resolve();
    }
  }, []);

  const cleanup = useCallback(() => {
    // Remove event listener if present
    if (endedListenerRef.current && audioRef.current) {
      audioRef.current.removeEventListener("ended", endedListenerRef.current);
      endedListenerRef.current = null;
    }
    if (cachedUrlRef.current) {
      URL.revokeObjectURL(cachedUrlRef.current);
      cachedUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { preCache, play, cleanup, isLoading };
}
