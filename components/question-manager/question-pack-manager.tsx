"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuestionPacks } from "@/hooks/use-question-packs";
import type { Question, QuestionPack } from "@/types/game";

const generateLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

type EditableAnswer = {
  id: string;
  text: string;
  points: string;
};

type EditableQuestion = {
  id: string;
  prompt: string;
  answers: EditableAnswer[];
};

type EditablePack = {
  id: string;
  name: string;
  description: string;
  origin: QuestionPack["origin"];
  createdAt: number;
  updatedAt: number;
  version: number;
  questions: EditableQuestion[];
};

const createEditableAnswer = (answer?: Question["answers"][number]): EditableAnswer => ({
  id: generateLocalId(),
  text: answer?.text ?? "",
  points: typeof answer?.points === "number" ? String(answer.points) : "0",
});

const createEditableQuestion = (question?: Question): EditableQuestion => ({
  id: generateLocalId(),
  prompt: question?.question ?? "",
  answers:
    question?.answers?.map(createEditableAnswer) ?? [createEditableAnswer(), createEditableAnswer()],
});

const createEditablePack = (pack: QuestionPack): EditablePack => ({
  id: pack.id,
  name: pack.name,
  description: pack.description ?? "",
  origin: pack.origin,
  createdAt: pack.createdAt,
  updatedAt: pack.updatedAt,
  version: pack.version,
  questions: pack.questions.map(createEditableQuestion),
});

const toQuestionPack = (draft: EditablePack): QuestionPack => ({
  id: draft.id,
  name: draft.name.trim(),
  description: draft.description.trim(),
  origin: draft.origin,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  version: draft.version,
  questions: draft.questions
    .map<Question | null>((question) => {
      const prompt = question.prompt.trim();
      if (!prompt) return null;
      const answers = question.answers
        .map((answer) => {
          const text = answer.text.trim();
          const value = Number(answer.points);
          if (!text || Number.isNaN(value) || !Number.isFinite(value) || value < 0) return null;
          return { text, points: Math.round(value) };
        })
        .filter((answer): answer is Question["answers"][number] => answer !== null);
      if (answers.length === 0) return null;
      return { question: prompt, answers };
    })
    .filter((question): question is Question => question !== null),
});

const collectIssues = (draft: EditablePack): string[] => {
  const issues: string[] = [];
  if (!draft.name.trim()) {
    issues.push("Pack name is required.");
  }
  draft.questions.forEach((question, questionIndex) => {
    if (!question.prompt.trim()) {
      issues.push(`Question ${questionIndex + 1} is missing its prompt.`);
    }
    const validAnswers = question.answers.filter((answer) => {
      const text = answer.text.trim();
      const value = Number(answer.points);
      return text.length > 0 && Number.isFinite(value) && !Number.isNaN(value);
    });
    if (validAnswers.length === 0) {
      issues.push(`Question ${questionIndex + 1} needs at least one answer.`);
    }
    question.answers.forEach((answer, answerIndex) => {
      const text = answer.text.trim();
      const points = Number(answer.points);
      if (text.length === 0) {
        issues.push(`Question ${questionIndex + 1}, Answer ${answerIndex + 1} has no text.`);
      }
      if (!Number.isFinite(points) || Number.isNaN(points) || points < 0) {
        issues.push(`Question ${questionIndex + 1}, Answer ${answerIndex + 1} has invalid points.`);
      }
    });
  });
  return Array.from(new Set(issues));
};

const useBeforeUnload = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "You have unsaved changes.";
      return "You have unsaved changes.";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [enabled]);
};

export function QuestionPackManager() {
  const {
    packs,
    activePack,
    setActivePack,
    createPack,
    savePack,
    deletePack,
    duplicatePack,
    importFromJson,
    importPack,
    exportPack,
    encodeShareToken,
    decodeShareToken,
  } = useQuestionPacks();

  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditablePack | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useBeforeUnload(dirty);

  useEffect(() => {
    if (packs.length === 0) {
      setSelectedPackId(null);
      setDraft(null);
      return;
    }
    setSelectedPackId((current) => {
      if (current && packs.some((pack) => pack.id === current)) {
        return current;
      }
      return packs[0]?.id ?? null;
    });
  }, [packs]);

  useEffect(() => {
    if (packs.length === 0) {
      setDraft(null);
      setSelectedPackId(null);
      setDirty(false);
      return;
    }
    if (!selectedPackId) {
      const next = packs[0];
      setDraft(createEditablePack(next));
      setSelectedPackId(next.id);
      setDirty(false);
      return;
    }
    const exists = packs.some((pack) => pack.id === selectedPackId);
    if (!exists) {
      const next = packs[0];
      setDraft(createEditablePack(next));
      setSelectedPackId(next.id);
      setDirty(false);
    }
  }, [packs, selectedPackId]);

  const issues = useMemo(() => (draft ? collectIssues(draft) : []), [draft]);
  const canSave = issues.length === 0 && dirty;

  const selectPack = (pack: QuestionPack) => {
    if (draft && draft.id === pack.id) return;
    if (dirty && !window.confirm("You have unsaved changes. Switch packs and lose edits?")) {
      return;
    }
    setError(null);
    setMessage(null);
    setShareToken("");
    setDraft(createEditablePack(pack));
    setSelectedPackId(pack.id);
    setDirty(false);
  };

  const handleCreatePack = () => {
    if (dirty && !window.confirm("Discard unsaved changes and create a new pack?")) {
      return;
    }
    const pack = createPack("New Question Pack");
    setSelectedPackId(pack.id);
    setDraft(createEditablePack(pack));
    setMessage("Created new pack.");
    setError(null);
    setDirty(false);
  };

  const handlePackField = <K extends keyof EditablePack>(key: K, value: EditablePack[K]) => {
    if (!draft) return;
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      setDirty(true);
      return next;
    });
  };

  const handleQuestionChange = (questionId: string, updater: (question: EditableQuestion) => void) => {
    if (!draft) return;
    setDraft((current) => {
      if (!current) return current;
      const questions = current.questions.map((entry) => {
        if (entry.id !== questionId) return entry;
        const clone: EditableQuestion = { ...entry, answers: entry.answers.map((answer) => ({ ...answer })) };
        updater(clone);
        return clone;
      });
      setDirty(true);
      return { ...current, questions };
    });
  };

  const handleAnswerChange = (
    questionId: string,
    answerId: string,
    updater: (answer: EditableAnswer) => void
  ) => {
    handleQuestionChange(questionId, (question) => {
      question.answers = question.answers.map((answer) => {
        if (answer.id !== answerId) return answer;
        const clone = { ...answer };
        updater(clone);
        return clone;
      });
    });
  };

  const addQuestion = () => {
    setDraft((current) => {
      if (!current) return current;
      const next = {
        ...current,
        questions: [...current.questions, createEditableQuestion()],
      };
      setDirty(true);
      return next;
    });
  };

  const removeQuestion = (questionId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = {
        ...current,
        questions: current.questions.filter((question) => question.id !== questionId),
      };
      setDirty(true);
      return next;
    });
  };

  const addAnswer = (questionId: string) => {
    handleQuestionChange(questionId, (question) => {
      question.answers = [...question.answers, createEditableAnswer()];
    });
  };

  const removeAnswer = (questionId: string, answerId: string) => {
    handleQuestionChange(questionId, (question) => {
      question.answers = question.answers.filter((answer) => answer.id !== answerId);
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    const pack = toQuestionPack(draft);
    const saved = savePack({ ...pack, origin: draft.origin, createdAt: draft.createdAt, version: draft.version }, {
      activate: draft.id === activePack.id,
    });
    setDraft(createEditablePack(saved));
    setDirty(false);
    setMessage("Pack saved.");
    setError(null);
  };

  const handleDelete = () => {
    if (!draft) return;
    if (!window.confirm(`Delete pack "${draft.name}"? This cannot be undone.`)) {
      return;
    }
    deletePack(draft.id);
    setMessage("Pack deleted.");
    setError(null);
    setDirty(false);
  };

  const handleDuplicate = () => {
    if (!draft) return;
    const duplicated = duplicatePack(draft.id);
    if (!duplicated) {
      setError("Unable to duplicate pack.");
      return;
    }
    setSelectedPackId(duplicated.id);
    setDraft(createEditablePack(duplicated));
    setDirty(false);
    setMessage("Pack duplicated.");
    setError(null);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const pack = importFromJson(text);
      if (!pack) {
        setError("Import failed. Ensure the JSON matches the expected schema.");
        return;
      }
      setSelectedPackId(pack.id);
      setDraft(createEditablePack(pack));
      setDirty(false);
      setMessage(`Imported "${pack.name}".`);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Import failed. Unable to read the selected file.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportToken = () => {
    if (!shareToken.trim()) {
      setError("Paste a share token to import.");
      return;
    }
    const pack = decodeShareToken(shareToken.trim());
    if (!pack) {
      setError("Invalid share token.");
      return;
    }
    const imported = importPack(pack);
    if (!imported) {
      setError("Could not import pack from token.");
      return;
    }
    setSelectedPackId(imported.id);
    setDraft(createEditablePack(imported));
    setDirty(false);
    setMessage("Shared pack imported.");
    setError(null);
  };

  const handleExport = async () => {
    if (!draft) return;
    const payload = exportPack(draft.id);
    if (!payload) {
      setError("Unable to export pack.");
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setMessage("Copied JSON to clipboard.");
      setError(null);
    } catch {
      setError("Clipboard permissions denied. Copy manually from the download.");
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${draft.name.replace(/\s+/g, "_")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  };

  const handleShare = async () => {
    if (!draft) return;
    const token = encodeShareToken(draft.id);
    if (!token) {
      setError("Unable to generate share token.");
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      setShareToken(token);
      setMessage("Share token copied to clipboard.");
      setError(null);
    } catch {
      setShareToken(token);
      setError("Clipboard permissions denied. Token is shown below.");
    }
  };

  useEffect(() => {
    if (!dirty) return;
    setMessage(null);
  }, [dirty]);

  if (!draft) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">No question packs available.</p>
        <Button onClick={handleCreatePack}>Create Pack</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Question Manager</h1>
        <p className="text-sm text-muted-foreground">
          Create, edit, and share custom Family Feud question packs.
        </p>
        {(message || error) && (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              error ? "border-destructive/50 text-destructive" : "border-emerald-500/40 text-emerald-400"
            )}
          >
            {error ?? message}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Question Packs</h2>
              <Button size="icon-sm" variant="ghost" onClick={handleCreatePack} aria-label="Create pack">
                +
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    pack.id === draft.id
                      ? "border-blue-500/60 bg-blue-500/10 text-white"
                      : "border-white/10 text-white/80 hover:border-white/40"
                  )}
                  onClick={() => selectPack(pack)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{pack.name}</span>
                    {pack.id === activePack.id && <span className="text-xs uppercase text-emerald-400">Active</span>}
                  </div>
                  <div className="mt-1 text-xs text-white/60">{pack.questions.length} questions</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div>
              <label className="text-xs uppercase text-white/60">Import JSON</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                className="hidden"
              />
              <Button
                variant="outline"
                className="mt-2 w-full justify-center"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload JSON File
              </Button>
            </div>
            <div>
              <label className="text-xs uppercase text-white/60">Share Token</label>
              <input
                value={shareToken}
                onChange={(event) => setShareToken(event.target.value)}
                placeholder="Paste or generate share token"
                className="mt-1 w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" onClick={handleImportToken}>
                  Import Token
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  Generate Token
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                  <label className="text-sm font-medium text-white/80">Pack Name</label>
                  <Input
                    value={draft.name}
                    onChange={(event) => handlePackField("name", event.target.value)}
                    placeholder="Summer retreat trivia"
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <label className="text-sm font-medium text-white/80">Description</label>
                  <textarea
                    value={draft.description}
                    onChange={(event) => handlePackField("description", event.target.value)}
                    placeholder="Optional summary for hosts"
                    className="min-h-[80px] w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleSave} disabled={!canSave}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setActivePack(draft.id)}>
                  Set Active
                </Button>
                <Button variant="ghost" onClick={handleDuplicate}>
                  Duplicate
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={handleExport}>
                  Copy JSON
                </Button>
              </div>
            </div>

            {dirty && (
              <p className="mt-3 text-xs text-amber-300">Unsaved changes</p>
            )}

            {issues.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="font-medium">Fix these before saving:</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 space-y-6">
              {draft.questions.map((question, index) => (
                <div key={question.id} className="rounded-xl border border-white/10 bg-black/20 p-4 shadow-inner">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/60">
                        Question {index + 1}
                      </span>
                      <input
                        value={question.prompt}
                        onChange={(event) =>
                          handleQuestionChange(question.id, (draftQuestion) => {
                            draftQuestion.prompt = event.target.value;
                          })
                        }
                        placeholder="Name something..."
                        className="w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeQuestion(question.id)}>
                      ×
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {question.answers.map((answer, answerIndex) => (
                      <div
                        key={answer.id}
                        className="grid grid-cols-1 gap-3 rounded-lg border border-white/5 bg-white/5 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
                      >
                        <input
                          value={answer.text}
                          onChange={(event) =>
                            handleAnswerChange(question.id, answer.id, (draftAnswer) => {
                              draftAnswer.text = event.target.value;
                            })
                          }
                          placeholder={`Answer ${answerIndex + 1}`}
                          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <input
                          value={answer.points}
                          type="number"
                          min="0"
                          onChange={(event) =>
                            handleAnswerChange(question.id, answer.id, (draftAnswer) => {
                              draftAnswer.points = event.target.value;
                            })
                          }
                          placeholder="Points"
                          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeAnswer(question.id, answer.id)}
                          className="justify-self-end"
                        >
                          -
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => addAnswer(question.id)}>
                      Add Answer
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button variant="secondary" onClick={addQuestion}>
                  Add Question
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
