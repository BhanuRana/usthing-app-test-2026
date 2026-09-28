/** The card for the selected course on the map: where it sits, whether you can take it, a
 * glance at its description, and actions. */
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { getCourse, getCourseVersion } from "@/data/catalog"
import { MapNode } from "@/data/prereq/map"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export interface MapCardProps {
  code: string
  node: MapNode
  /** Where it sits relative to the map's course, e.g. "Direct prerequisite of COMP 3711". */
  relation: string
  isFocus: boolean
  completed: boolean
  starred: boolean
  step?: number
  loop: boolean
  /** Courses it leads to, for courses on the right-hand side (undefined elsewhere). */
  leads?: number
  term?: number
  /** Whether the student can take it, in words, with a tone for colour. */
  verdict: { tone: "done" | "ok" | "warn" | "muted"; text: string }
  onToggleCompleted: () => void
  onOpen: () => void
  onCentre: () => void
  onClose: () => void
}

export function MapCard(props: MapCardProps) {
  const { code, node, isFocus, completed, starred, step, loop, leads, onOpen, onCentre } = props
  const { onClose, relation, term, verdict, onToggleCompleted } = props
  // A glance at what the course is about; the full page is one tap away.
  const description = getCourseVersion(code, term)?.description
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const course = getCourse(code)
  const facts = [
    starred && { icon: "star" as const, color: colors.star, text: translate("map:starred") },
    step && {
      icon: "trail-sign-outline" as const,
      color: colors.tint,
      text: translate("map:onPath", { n: step }),
    },
    node.otherRequirements && {
      icon: "alert-circle-outline" as const,
      color: colors.warning,
      text: translate("map:otherRequirements"),
    },
    loop && { icon: "sync-outline" as const, color: colors.warning, text: translate("map:loop") },
    leads !== undefined && {
      icon: "arrow-forward-circle-outline" as const,
      color: colors.tint,
      text: leads
        ? translate("map:leadsCount", { count: leads, n: leads })
        : translate("map:leadsNone"),
    },
  ].filter(Boolean) as { icon: "star"; color: string; text: string }[]

  return (
    <View style={themed($card)} testID="map-selected">
      <View style={$cardTop}>
        <View style={$flex}>
          <Text weight="bold" style={{ color: colors.tint }} text={code} />
          <Text
            size="xs"
            numberOfLines={2}
            style={themed($dim)}
            text={course?.title ?? translate("map:notInCatalogue")}
          />
          <View style={$relation}>
            <Ionicons name="git-commit-outline" size={14} color={colors.tint} />
            <Text size="xxs" weight="medium" style={{ color: colors.tint }} text={relation} />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate("map:close")}
          onPress={onClose}
          hitSlop={10}
        >
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Pressable>
      </View>
      <View style={[themed($verdict), themed(VERDICT_BG[verdict.tone])]} testID="map-verdict">
        <Ionicons
          name={VERDICT_ICON[verdict.tone]}
          size={16}
          color={
            verdict.tone === "done" || verdict.tone === "ok"
              ? colors.success
              : verdict.tone === "warn"
                ? colors.warning
                : colors.textDim
          }
        />
        <Text size="xxs" weight="medium" style={$flex} text={verdict.text} />
        {course && (
          <Pressable
            accessibilityRole="button"
            testID="map-toggle-completed"
            onPress={onToggleCompleted}
            hitSlop={8}
          >
            <Text
              size="xxs"
              weight="semiBold"
              style={{ color: colors.tint }}
              tx={completed ? "map:undoCompleted" : "map:markCompleted"}
            />
          </Pressable>
        )}
      </View>
      {!!description && (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={translate("map:openCourse")}
          onPress={onOpen}
          testID="map-description"
        >
          <Text size="xxs" numberOfLines={2} style={themed($preview)} text={description} />
        </Pressable>
      )}
      {facts.length > 0 && (
        <View style={$facts}>
          {facts.map((f) => (
            <View key={f.text} style={$fact}>
              <Ionicons name={f.icon} size={14} color={f.color} />
              <Text size="xxs" style={themed($dim)} text={f.text} />
            </View>
          ))}
        </View>
      )}
      {course && (
        <View style={$cardButtons}>
          <Pressable
            accessibilityRole="button"
            testID="map-open-course"
            onPress={onOpen}
            style={({ pressed }) => [themed($primary), pressed && $pressed]}
          >
            <Text
              size="xs"
              weight="semiBold"
              style={{ color: colors.palette.neutral100 }}
              tx="map:openCourse"
            />
          </Pressable>
          {!isFocus && (
            <Pressable
              accessibilityRole="button"
              testID="map-centre"
              onPress={onCentre}
              style={({ pressed }) => [themed($secondary), pressed && $pressed]}
            >
              <Ionicons name="locate-outline" size={15} color={colors.tint} />
              <Text size="xs" weight="semiBold" style={{ color: colors.tint }} tx="map:centre" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const $flex: ViewStyle = { flex: 1 }

const $pressed: ViewStyle = { opacity: 0.75 }

const $verdict: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 10,
  paddingVertical: 7,
  borderRadius: 10,
})

const VERDICT_BG: Record<"done" | "ok" | "warn" | "muted", ThemedStyle<ViewStyle>> = {
  done: ({ colors }) => ({ backgroundColor: colors.successSoft }),
  ok: ({ colors }) => ({ backgroundColor: colors.successSoft }),
  warn: ({ colors }) => ({ backgroundColor: colors.warningSoft }),
  muted: ({ colors }) => ({ backgroundColor: colors.surfaceAlt }),
}

const VERDICT_ICON = {
  done: "checkmark-circle",
  ok: "checkmark-circle-outline",
  warn: "alert-circle",
  muted: "information-circle-outline",
} as const

const $relation: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  padding: spacing.md,
  gap: spacing.sm,
  borderRadius: 20,
  backgroundColor: isDark ? colors.surfaceAlt : colors.surface,
  shadowColor: "#0F1C2E",
  shadowOpacity: isDark ? 0 : 0.16,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
})

const $preview: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text, lineHeight: 18 })

const $cardTop: ViewStyle = { flexDirection: "row", gap: 10 }

const $facts: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 10 }

const $fact: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4 }

const $cardButtons: ViewStyle = { flexDirection: "row", gap: 8 }

const $primary: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  height: 42,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.tint,
})

const $secondary: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  height: 42,
  borderRadius: 12,
  flexDirection: "row",
  gap: 6,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1.5,
  borderColor: colors.tint,
})

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
