"use client";

import { useCallback, useMemo } from "react";
import { useSyncExternalStore } from "react";
import type { QuestionPack, QuestionPackSnapshot } from "@/types/game";
import {
  builtinQuestionPack,
  createEmptyPack,
  decodePackFromQuery,
  deserializePack,
  duplicatePack as duplicatePackValue,
  encodePackForQuery,
  generatePackId,
  getActivePack,
  getDefaultSnapshot,
  loadQuestionPackSnapshot,
  mergeBuiltinWithCustom,
  resetQuestionPackSnapshot,
  saveQuestionPackSnapshot,
  serializePack,
  updatePackList,
} from "@/lib/question-packs";

const STORAGE_KEY = "family-feud:question-packs";

const packStore: {
  snapshot: QuestionPackSnapshot;
  listeners: Set<() => void>;
  initialized: boolean;
  storageListenerBound: boolean;
} = {
  snapshot: getDefaultSnapshot(),
  listeners: new Set(),
  initialized: false,
  storageListenerBound: false,
};

const notify = () => {
  for (const listener of packStore.listeners) {
    listener();
  }
};

const ensureInitialized = () => {
  if (!packStore.initialized) {
    packStore.snapshot = loadQuestionPackSnapshot();
    packStore.initialized = true;
  }
  if (!packStore.storageListenerBound && typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      packStore.snapshot = loadQuestionPackSnapshot();
      notify();
    });
    packStore.storageListenerBound = true;
  }
};

const persistSnapshot = (snapshot: QuestionPackSnapshot) => {
  if (typeof window === "undefined") return;
  saveQuestionPackSnapshot(snapshot);
};

const mutateStore = (updater: (snapshot: QuestionPackSnapshot) => QuestionPackSnapshot) => {
  ensureInitialized();
  const next = updater(packStore.snapshot);
  packStore.snapshot = next;
  persistSnapshot(next);
  notify();
};

const subscribe = (listener: () => void) => {
  ensureInitialized();
  packStore.listeners.add(listener);
  return () => {
    packStore.listeners.delete(listener);
  };
};

const getSnapshotClient = () => {
  ensureInitialized();
  return packStore.snapshot;
};

const getSnapshotServer = () => getDefaultSnapshot();

type UpsertOptions = {
  activate?: boolean;
  activateIfNew?: boolean;
};

const upsertPack = (
  current: QuestionPackSnapshot,
  pack: QuestionPack,
  options?: UpsertOptions
): QuestionPackSnapshot => {
  const exists = current.packs.some((entry) => entry.id === pack.id);
  const remaining = current.packs.filter((entry) => entry.id !== pack.id);
  const nextList = [...remaining, pack];
  let nextActive: string | null | undefined;
  if (options?.activate === true) {
    nextActive = pack.id;
  } else if (options?.activateIfNew && !exists) {
    nextActive = pack.id;
  }
  return updatePackList(current, nextList, nextActive);
};

const preparePackForSave = (pack: QuestionPack, originOverride?: QuestionPack["origin"]): QuestionPack => {
  const now = Date.now();
  const isBuiltinSource = pack.origin === "builtin" || pack.id === builtinQuestionPack.id;
  const createdAt =
    !isBuiltinSource && typeof pack.createdAt === "number" && Number.isFinite(pack.createdAt)
      ? pack.createdAt
      : now;
  const version =
    typeof pack.version === "number" && Number.isFinite(pack.version) ? Math.max(1, Math.floor(pack.version)) : 1;
  const origin = originOverride ?? (isBuiltinSource ? "custom" : pack.origin ?? "custom");
  const id = isBuiltinSource ? generatePackId() : pack.id ?? generatePackId();
  return {
    ...pack,
    id,
    name: (pack.name ?? "").trim() || "Untitled Pack",
    description: pack.description ?? "",
    origin,
    questions: pack.questions ?? [],
    createdAt,
    updatedAt: now,
    version,
  };
};

export type UseQuestionPacksResult = {
  packs: QuestionPack[];
  customPacks: QuestionPack[];
  activePack: QuestionPack;
  activePackId: string | null;
  builtinPack: QuestionPack;
  setActivePack: (packId: string | null) => void;
  createPack: (name: string) => QuestionPack;
  savePack: (pack: QuestionPack, options?: { activate?: boolean }) => QuestionPack;
  deletePack: (packId: string) => void;
  duplicatePack: (packId: string) => QuestionPack | null;
  importPack: (pack: QuestionPack) => QuestionPack;
  importFromJson: (json: string) => QuestionPack | null;
  exportPack: (packId: string) => string | null;
  encodeShareToken: (packId: string) => string | null;
  decodeShareToken: (token: string) => QuestionPack | null;
  resetCustomPacks: () => void;
};

export function useQuestionPacks(): UseQuestionPacksResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshotClient, getSnapshotServer);

  const packs = useMemo(() => mergeBuiltinWithCustom(snapshot), [snapshot]);
  const customPacks = useMemo(() => snapshot.packs, [snapshot]);
  const activePack = useMemo(() => getActivePack(snapshot), [snapshot]);

  const setActivePack = useCallback((packId: string | null) => {
    mutateStore((current) => updatePackList(current, current.packs, packId));
  }, []);

  const createPack = useCallback((name: string) => {
    const pack = createEmptyPack(name);
    mutateStore((current) => upsertPack(current, pack, { activate: true }));
    return pack;
  }, []);

  const savePack = useCallback(
    (pack: QuestionPack, options?: { activate?: boolean }) => {
      const normalized = preparePackForSave(pack);
      mutateStore((current) =>
        upsertPack(current, normalized, {
          activate: options?.activate,
          activateIfNew: options?.activate === undefined,
        })
      );
      return normalized;
    },
    []
  );

  const deletePack = useCallback((packId: string) => {
    mutateStore((current) => {
      const nextPacks = current.packs.filter((pack) => pack.id !== packId);
      const nextActive = current.activePackId === packId ? null : undefined;
      return updatePackList(current, nextPacks, nextActive);
    });
  }, []);

  const duplicatePack = useCallback((packId: string) => {
    let duplicated: QuestionPack | null = null;
    mutateStore((current) => {
      const source =
        current.packs.find((pack) => pack.id === packId) ||
        (packId === builtinQuestionPack.id ? builtinQuestionPack : null);
      if (!source) {
        return current;
      }
      duplicated = preparePackForSave(duplicatePackValue(source), "custom");
      return upsertPack(current, duplicated!, { activate: true });
    });
    return duplicated;
  }, []);

  const importPack = useCallback((pack: QuestionPack) => {
    const normalized = preparePackForSave(
      {
        ...pack,
        id: generatePackId(),
      },
      "imported"
    );
    mutateStore((current) => upsertPack(current, normalized, { activate: true }));
    return normalized;
  }, []);

  const importFromJson = useCallback(
    (json: string) => {
      try {
        const parsed = JSON.parse(json) as unknown;
        const pack = deserializePack(parsed);
        if (!pack) return null;
        return importPack(pack);
      } catch {
        return null;
      }
    },
    [importPack]
  );

  const exportPack = useCallback(
    (packId: string) => {
      const pack = packs.find((entry) => entry.id === packId);
      if (!pack) return null;
      return serializePack(pack);
    },
    [packs]
  );

  const encodeShareToken = useCallback(
    (packId: string) => {
      const pack = packs.find((entry) => entry.id === packId);
      if (!pack) return null;
      return encodePackForQuery(pack);
    },
    [packs]
  );

  const decodeShareToken = useCallback((token: string) => decodePackFromQuery(token), []);

  const resetCustomPacks = useCallback(() => {
    resetQuestionPackSnapshot();
    mutateStore(() => getDefaultSnapshot());
  }, []);

  return {
    packs,
    customPacks,
    activePack,
    activePackId: snapshot.activePackId,
    builtinPack: builtinQuestionPack,
    setActivePack,
    createPack,
    savePack,
    deletePack,
    duplicatePack,
    importPack,
    importFromJson,
    exportPack,
    encodeShareToken,
    decodeShareToken,
    resetCustomPacks,
  };
}
