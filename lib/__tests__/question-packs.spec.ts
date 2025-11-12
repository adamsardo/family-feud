import { describe, expect, it } from "vitest";
import {
  builtinQuestionPack,
  createEmptyPack,
  decodePackFromQuery,
  encodePackForQuery,
  getDefaultSnapshot,
  mergeBuiltinWithCustom,
  serializePack,
  updatePackList,
  deserializePack,
} from "../question-packs";
import type { QuestionPack } from "../../types/game";

const makePack = (overrides: Partial<QuestionPack> = {}): QuestionPack => ({
  id: overrides.id ?? "pack_test",
  name: overrides.name ?? "Test Pack",
  description: overrides.description ?? "",
  origin: overrides.origin ?? "custom",
  createdAt: overrides.createdAt ?? Date.now(),
  updatedAt: overrides.updatedAt ?? Date.now(),
  version: overrides.version ?? 1,
  questions:
    overrides.questions ??
    [
      {
        question: "Name a fruit",
        answers: [
          { text: "Apple", points: 30 },
          { text: "Banana", points: 20 },
        ],
      },
    ],
});

describe("question pack utilities", () => {
  it("merges builtin pack with custom packs sorted by name", () => {
    const snapshot = getDefaultSnapshot();
    const packB = makePack({ id: "pack_b", name: "Zeta" });
    const packA = makePack({ id: "pack_a", name: "Alpha" });
    const merged = mergeBuiltinWithCustom({ ...snapshot, packs: [packB, packA] });
    expect(merged.map((pack) => pack.name)).toEqual([
      builtinQuestionPack.name,
      "Alpha",
      "Zeta",
    ]);
  });

  it("encodes and decodes share tokens symmetrically", () => {
    const custom = makePack({ id: "pack_123" });
    const token = encodePackForQuery(custom);
    const decoded = decodePackFromQuery(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.name).toBe(custom.name);
    expect(decoded?.questions).toHaveLength(custom.questions.length);
  });

  it("returns null when decoding invalid share tokens", () => {
    expect(decodePackFromQuery("not-base64")).toBeNull();
  });

  it("serializes packs with stable, pretty formatting", () => {
    const custom = makePack();
    const serialized = serializePack(custom);
    expect(serialized).toContain("\n  \"questions\"");
    expect(serialized.trim().startsWith("{")).toBe(true);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it("ensures builtin pack remains active when custom pack is removed", () => {
    const customPack = makePack({ id: "pack_remove" });
    const snapshot = updatePackList(getDefaultSnapshot(), [customPack], customPack.id);
    const next = updatePackList(snapshot, [], undefined);
    const merged = mergeBuiltinWithCustom(next);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(builtinQuestionPack.id);
  });

  it("deserializes JSON payloads that match the schema", () => {
    const raw = {
      id: "share_pack",
      name: "Shared Pack",
      origin: "imported",
      version: 2,
      questions: [
        {
          question: "Name a sport",
          answers: [
            { text: "Soccer", points: 30 },
            { text: "Basketball", points: 20 },
          ],
        },
      ],
    };
    const pack = deserializePack(raw);
    expect(pack).not.toBeNull();
    expect(pack?.id).toBe("share_pack");
    expect(pack?.questions[0]?.answers).toHaveLength(2);
  });

  it("creates empty packs with safe defaults", () => {
    const pack = createEmptyPack(" New Pack ");
    expect(pack.name).toBe("New Pack");
    expect(pack.questions).toEqual([]);
    expect(pack.origin).toBe("custom");
  });
});
