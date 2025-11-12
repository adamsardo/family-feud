"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";

// Small client-side LRU cache of pre-fetched audio blobs
type CacheKey = string; // currently just the text
const MAX_CACHE = 3;
const audioCache = new Map<CacheKey, string>(); // key -> object URL
const inFlight = new Map<CacheKey, Promise<string>>();

const makeKey = (text: string): CacheKey => text.trim();

const getCachedUrl = (key: CacheKey): string | null => {
  const url = audioCache.get(key) || null;
  if (url) {
    // refresh LRU order
    audioCache.delete(key);
    audioCache.set(key, url);
  }
  return url;
};

const putCache = (key: CacheKey, url: string) => {
  if (audioCache.has(key)) {
    const old = audioCache.get(key)!;
    if (old !== url) URL.revokeObjectURL(old);
    audioCache.delete(key);
  }
  audioCache.set(key, url);
  // Evict oldest
  if (audioCache.size > MAX_CACHE) {
    const [evictKey, evictUrl] = audioCache.entries().next().value as [string, string];
    audioCache.delete(evictKey);
    URL.revokeObjectURL(evictUrl);
  }
};

export function useQuestionTTS(enabled: boolean, text: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentKeyRef = useRef<CacheKey | null>(null);

  // Create a single audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  

  const preCache = useCallback(async (t: string): Promise<void> => {
    if (!t || !t.trim()) return;
    const key = makeKey(t);
    if (getCachedUrl(key)) return;
    if (inFlight.has(key)) {
      await inFlight.get(key);
      return;
    }
    const task = (async () => {
      try {
        const res = await fetch(`/api/tts/stream?text=${encodeURIComponent(t)}`);
        if (!res.ok) throw new Error("preCache fetch failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        putCache(key, url);
        return url;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, task);
    await task;
  }, []);

  // Auto play when question changes and voice is enabled
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!enabled || !text || !text.trim()) return;

    const key = makeKey(text);
    const cached = getCachedUrl(key);

    const url = cached || ("/api/tts/stream?text=" + encodeURIComponent(text));
    const absoluteUrl = new URL(url, window.location.origin).href;
    const isSame = currentKeyRef.current === key && audio.currentSrc === absoluteUrl;

    if (!isSame) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = url;
      currentKeyRef.current = key;
    }
    audio.play().catch(() => {});
  }, [enabled, text]);

  const api = useMemo(
    () => ({
      preCache,
      speak: (t: string) => {
        const audio = audioRef.current;
        if (!audio) return;
        if (!enabled) return;
        const key = makeKey(t);
        const cached = getCachedUrl(key);
        const url = cached || ("/api/tts/stream?text=" + encodeURIComponent(t));
        const absoluteUrl = new URL(url, window.location.origin).href;
        const isSame = currentKeyRef.current === key && audio.currentSrc === absoluteUrl;
        if (!isSame) {
          audio.pause();
          audio.currentTime = 0;
          audio.src = url;
          currentKeyRef.current = key;
        }
        audio.play().catch(() => {});
      },
      stop: () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
      },
    }),
    [enabled, preCache]
  );

  return api;
}
