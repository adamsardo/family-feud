import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase()
}

const isSubsequence = (needle: string, haystack: string): boolean => {
  if (needle.length === 0) return false
  let cursor = 0
  for (const char of haystack) {
    if (char === needle[cursor]) {
      cursor += 1
      if (cursor === needle.length) {
        return true
      }
    }
  }
  return false
}

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const rows = a.length + 1
  const cols = b.length + 1
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[a.length][b.length]
}

export function looselyMatches(normalizedA: string, normalizedB: string): boolean {
  if (normalizedA.length === 0 || normalizedB.length === 0) return false
  if (normalizedA === normalizedB) return true

  const shorter = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB
  const longer = shorter === normalizedA ? normalizedB : normalizedA

  if (longer.includes(shorter)) return true

  const shorterLength = shorter.length
  if (shorterLength <= 2 && isSubsequence(shorter, longer)) {
    return true
  }
  if (shorterLength === 3 && isSubsequence(shorter, longer)) {
    const distance = levenshteinDistance(shorter, longer)
    if (distance <= 2) {
      return true
    }
  }

  const distance = levenshteinDistance(normalizedA, normalizedB)
  const maxLength = Math.max(normalizedA.length, normalizedB.length)
  if (maxLength === 0) return false
  const similarity = 1 - distance / maxLength
  return similarity >= 0.6
}
