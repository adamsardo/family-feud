import { z } from "zod";
import questionsData from "@/data/questions.json";
import type { Question, QuestionPack, QuestionPackSnapshot } from "@/types/game";
import { clearSnapshot, readSnapshot, writeSnapshot } from "@/lib/storage";

// Storage
const STORAGE_KEY = "family-feud:question-packs";
const STORAGE_VERSION = 1;

// Builtin pack built from static questions
const builtinQuestions = (questionsData as { questions: Question[] }).questions;

export const builtinQuestionPack: QuestionPack = Object.freeze({
  id: "builtin",
  name: "Default Pack",
  description: "Built-in Family Feud questions",
  origin: "builtin",
  createdAt: 0,
  updatedAt: 0,
  version: 1,
  questions: builtinQuestions,
});

// ID generation
export const generatePackId = (): string => {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `pack_${time}_${rand}`;
};

// Snapshot helpers
export const getDefaultSnapshot = (): QuestionPackSnapshot => ({
  packs: [],
  activePackId: null,
});

const sanitizePack = (value: unknown): QuestionPack | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<QuestionPack>;

  if (!Array.isArray(candidate.questions)) return null;
  const questions: Question[] = candidate.questions
    .map((q) => {
      if (!q || typeof q !== "object") return null;
      const cast = q as Partial<Question>;
      if (typeof cast.question !== "string" || !Array.isArray(cast.answers)) return null;
      const answers = cast.answers
        .map((a) => {
          if (!a || typeof a !== "object") return null;
          const aa = a as Partial<Question["answers"][number]>;
          if (typeof aa.text !== "string") return null;
          const points =
            typeof aa.points === "number" && Number.isFinite(aa.points)
              ? Math.max(0, Math.floor(aa.points))
              : 0;
          return { text: aa.text, points };
        })
        .filter((a): a is Question["answers"][number] => a !== null);
      return { question: cast.question, answers } satisfies Question;
    })
    .filter((q): q is Question => q !== null);

  const now = Date.now();
  const id = typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : generatePackId();
  const name = typeof candidate.name === "string" && candidate.name.trim().length > 0 ? candidate.name : "Untitled Pack";
  const description = typeof candidate.description === "string" ? candidate.description : "";
  const createdAt =
    typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
      ? candidate.createdAt
      : now;
  const updatedAt =
    typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : now;
  const version =
    typeof candidate.version === "number" && Number.isFinite(candidate.version)
      ? Math.max(1, Math.floor(candidate.version))
      : 1;
  const origin: QuestionPack["origin"] =
    candidate.origin === "builtin" || candidate.origin === "custom" || candidate.origin === "imported"
      ? candidate.origin
      : "custom";

  return { id, name, description, origin, createdAt, updatedAt, version, questions };
};

const sanitizeSnapshot = (value: unknown): QuestionPackSnapshot => {
  const base = getDefaultSnapshot();
  if (!value || typeof value !== "object") return base;
  const incoming = value as Partial<QuestionPackSnapshot> & Record<string, unknown>;
  const packs = Array.isArray(incoming.packs)
    ? incoming.packs
        .map(sanitizePack)
        .filter((p): p is QuestionPack => p !== null && p.id !== builtinQuestionPack.id)
    : [];
  const active = typeof incoming.activePackId === "string" ? incoming.activePackId : null;
  return { packs, activePackId: active };
};

export const loadQuestionPackSnapshot = (): QuestionPackSnapshot => {
  const snapshot = readSnapshot<QuestionPackSnapshot>(STORAGE_KEY);
  if (!snapshot || snapshot.version !== STORAGE_VERSION) return getDefaultSnapshot();
  return sanitizeSnapshot(snapshot.payload);
};

export const saveQuestionPackSnapshot = (snapshot: QuestionPackSnapshot): void => {
  writeSnapshot(STORAGE_KEY, {
    version: STORAGE_VERSION,
    timestamp: Date.now(),
    payload: sanitizeSnapshot(snapshot),
  });
};

export const resetQuestionPackSnapshot = (): void => {
  clearSnapshot(STORAGE_KEY);
};

// Merge and active selection
export const mergeBuiltinWithCustom = (snapshot: QuestionPackSnapshot): QuestionPack[] => {
  const filtered = snapshot.packs.filter((p) => p.id !== builtinQuestionPack.id);
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  return [builtinQuestionPack, ...sorted];
};

export const getActivePack = (snapshot: QuestionPackSnapshot): QuestionPack => {
  const merged = mergeBuiltinWithCustom(snapshot);
  const id = snapshot.activePackId;
  const found = id ? merged.find((p) => p.id === id) : null;
  return found ?? builtinQuestionPack;
};

export const updatePackList = (
  current: QuestionPackSnapshot,
  nextList: QuestionPack[],
  nextActive?: string | null
): QuestionPackSnapshot => {
  const packs = nextList.filter((p) => p.id !== builtinQuestionPack.id);
  let active = current.activePackId;
  if (nextActive === null) {
    active = null;
  } else if (typeof nextActive === "string") {
    active = nextActive;
  }
  const activeExists = packs.some((p) => p.id === active) || active === builtinQuestionPack.id;
  if (!activeExists) {
    active = builtinQuestionPack.id;
  }
  return { packs, activePackId: active };
};

// Pack creation/manipulation
export const createEmptyPack = (name: string): QuestionPack => {
  const now = Date.now();
  return {
    id: generatePackId(),
    name: (name ?? "").trim() || "Untitled Pack",
    description: "",
    origin: "custom",
    createdAt: now,
    updatedAt: now,
    version: 1,
    questions: [],
  };
};

export const duplicatePack = (pack: QuestionPack): QuestionPack => {
  const now = Date.now();
  return {
    ...pack,
    id: generatePackId(),
    name: `Copy of ${pack.name}`,
    origin: "custom",
    createdAt: now,
    updatedAt: now,
  };
};

// Serialization & sharing
const AnswerSchema = z.object({
  text: z.string(),
  points: z.number().int().nonnegative(),
});

const QuestionSchema = z.object({
  question: z.string(),
  answers: z.array(AnswerSchema).min(1),
});

const QuestionPackSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  origin: z.enum(["builtin", "custom", "imported"]).optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  version: z.number().int().min(1).optional(),
  questions: z.array(QuestionSchema),
});

export const serializePack = (pack: QuestionPack): string => {
  return JSON.stringify(
    {
      id: pack.id,
      name: pack.name,
      description: pack.description ?? "",
      origin: pack.origin,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
      version: pack.version,
      questions: pack.questions,
    },
    null,
    2
  );
};

export const deserializePack = (value: unknown): QuestionPack | null => {
  const parsed = QuestionPackSchema.safeParse(value);
  if (!parsed.success) return null;
  return sanitizePack(parsed.data);
};

const getBufferCtor = (): typeof Buffer | undefined => {
  const candidate = (globalThis as { Buffer?: typeof Buffer }).Buffer;
  return typeof candidate === "function" ? candidate : undefined;
};

const toBase64Url = (input: string): string => {
  const toUrlSafe = (value: string) => value.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  if (typeof window !== "undefined" && typeof window.btoa === "function" && typeof TextEncoder !== "undefined") {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return toUrlSafe(window.btoa(binary));
  }

  const BufferCtor = getBufferCtor();
  if (BufferCtor) {
    return toUrlSafe(BufferCtor.from(input, "utf8").toString("base64"));
  }

  return input;
};

const fromBase64Url = (input: string): string => {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);

  if (typeof window !== "undefined" && typeof window.atob === "function" && typeof TextDecoder !== "undefined") {
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  const BufferCtor = getBufferCtor();
  if (BufferCtor) {
    return BufferCtor.from(padded, "base64").toString("utf8");
  }

  return input;
};

export const encodePackForQuery = (pack: QuestionPack): string => toBase64Url(serializePack(pack));

export const decodePackFromQuery = (token: string): QuestionPack | null => {
  try {
    const json = fromBase64Url(token);
    const parsed = JSON.parse(json) as unknown;
    return deserializePack(parsed);
  } catch {
    return null;
  }
};
