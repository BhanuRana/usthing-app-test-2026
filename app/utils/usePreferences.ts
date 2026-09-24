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
const TERM_KEY = "prefs.term"

export function useStarred() {
  const [list, setList] = useMMKVObject<string[]>(STARRED_KEY, storage)
  const starred = useMemo(() => new Set(list ?? []), [list])

  const toggle = useCallback(
    (code: string) => {
      const next = new Set(starred)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      setList([...next].sort())
    },
    [starred, setList],
  )

  return { starred, toggle }
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
