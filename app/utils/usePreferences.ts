import { useCallback, useMemo } from "react"
import { useMMKVObject, useMMKVString } from "react-native-mmkv"

import { getIndex } from "@/data/catalog"

import { storage } from "./storage"

/**
 * Persisted user preferences, backed by MMKV (synchronous, on-device).
 * MMKV hooks subscribe to their key, so every screen using them stays in sync without a
 * separate context or state library.
 */

const STARRED_KEY = "prefs.starred"
const COMPLETED_KEY = "prefs.completed"
const TERM_KEY = "prefs.term"

/** A persisted set of course codes. Stored as a sorted array; exposed as a Set for O(1) lookups. */
function useCodeSet(key: string) {
  const [list, setList] = useMMKVObject<string[]>(key, storage)
  const codes = useMemo(() => new Set(list ?? []), [list])

  const toggle = useCallback(
    (code: string) => {
      const next = new Set(codes)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      setList([...next].sort())
    },
    [codes, setList],
  )

  return [codes, toggle] as const
}

/** Courses the user wants quick access to. */
export function useStarred() {
  const [starred, toggle] = useCodeSet(STARRED_KEY)
  return { starred, toggle }
}

/** Courses the user has passed; drives prerequisite checks and the "Unlocked" filter. */
export function useCompleted() {
  const [completed, toggle] = useCodeSet(COMPLETED_KEY)
  return { completed, toggle }
}

/**
 * The semester filter. Stored by term *code* ("2610") rather than index, so it stays valid
 * if the dataset is regenerated with more terms. `undefined` means all terms.
 */
export function useSelectedTerm(): [number | undefined, (term: number | undefined) => void] {
  const [termCode, setTermCode] = useMMKVString(TERM_KEY, storage)
  const { terms } = getIndex()

  // Default (first launch, or a stored term no longer in the data) is the newest term.
  // "All terms" is stored explicitly as "all".
  const term =
    termCode === "all"
      ? undefined
      : Math.max(
          0,
          terms.findIndex((t) => t.code === termCode),
        )

  const setTerm = useCallback(
    (next: number | undefined) => setTermCode(next === undefined ? "all" : terms[next].code),
    [setTermCode, terms],
  )
  return [term, setTerm]
}
