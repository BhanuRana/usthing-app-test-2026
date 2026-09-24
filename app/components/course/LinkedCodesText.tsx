import { Fragment } from "react"
import { TextStyle } from "react-native"

import { Text } from "@/components/Text"
import { getCourse } from "@/data/catalog"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

const CODE = /\b([A-Z]{4})\s?(\d{4}[A-Z]?)\b/g

interface LinkedCodesTextProps {
  text: string
  onPressCode: (code: string) => void
  size?: "xs" | "sm"
}

/**
 * Renders free text (exclusions, co-requisites, the raw prerequisite string) with every
 * course code that exists in the catalogue turned into a tappable link.
 */
export function LinkedCodesText({ text, onPressCode, size = "xs" }: LinkedCodesTextProps) {
  const { themed } = useAppTheme()
  const parts: (string | { code: string; raw: string })[] = []
  let last = 0
  for (const m of text.matchAll(CODE)) {
    const code = `${m[1]} ${m[2]}`
    if (!getCourse(code)) continue
    parts.push(text.slice(last, m.index), { code, raw: m[0] })
    last = m.index! + m[0].length
  }
  parts.push(text.slice(last))

  return (
    <Text size={size}>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <Text
            key={i}
            size={size}
            weight="semiBold"
            style={themed($link)}
            accessibilityRole="link"
            onPress={() => onPressCode(p.code)}
            text={p.raw}
          />
        ),
      )}
    </Text>
  )
}

const $link: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  textDecorationLine: "underline",
})
