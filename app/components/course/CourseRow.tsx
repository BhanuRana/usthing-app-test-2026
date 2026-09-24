import { memo } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import type { CourseSummary } from "@/data/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

/** Fixed so FlatList can use getItemLayout and skip measuring ~4,000 rows. */
export const COURSE_ROW_HEIGHT = 76

interface CourseRowProps {
  course: CourseSummary
  starred: boolean
  onPress: (code: string) => void
}

/**
 * One course in a list. Memoised and fed a stable `onPress`, so typing in the search box
 * only re-renders rows whose props actually changed.
 */
export const CourseRow = memo(function CourseRow({ course, starred, onPress }: CourseRowProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${course.code}, ${course.title}, ${course.credits} credits${starred ? ", starred" : ""}`}
      onPress={() => onPress(course.code)}
      style={({ pressed }) => [themed($row), pressed && themed($pressed)]}
    >
      <View style={$main}>
        <View style={$topLine}>
          <Text weight="bold" size="sm" text={course.code} />
          <Text size="xxs" style={themed($meta)} text={`${course.credits} cr · ${course.career}`} />
          {starred && <Ionicons name="star" size={12} color={colors.tint} />}
        </View>
        <Text size="xs" numberOfLines={2} style={themed($title)} text={course.title} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  )
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: COURSE_ROW_HEIGHT,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.md,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
  gap: spacing.sm,
})

const $pressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.overlay20,
})

const $main: ViewStyle = { flex: 1 }

const $topLine: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 8 }

const $meta: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $title: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim, lineHeight: 19 })
