import { ComponentProps, memo } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import type { CourseSummary } from "@/data/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { DeptBadge } from "./DeptBadge"
import { highlightCode, highlightWords, Segment } from "./highlight"
import { $card } from "./styles"

const CARD_HEIGHT = 72
const GAP = 8
/**
 * Fixed so FlatList can use getItemLayout and skip measuring ~4,000 rows: the card plus the
 * gap below it. The title is kept to one line (full title in the accessibility label and on
 * the detail screen) and font scaling is capped, so the content always fits.
 */
export const COURSE_ROW_HEIGHT = CARD_HEIGHT + GAP
const MAX_FONT_SCALE = 1.3

interface CourseRowProps {
  course: CourseSummary
  starred: boolean
  completed?: boolean
  /** The current search, to highlight what matched. */
  query?: string
  onPress: (code: string) => void
}

/**
 * One course in a list. Memoised and fed a stable `onPress`, so typing in the search box
 * only re-renders rows whose props actually changed.
 */
export const CourseRow = memo(function CourseRow({
  course,
  starred,
  completed,
  query = "",
  onPress,
}: CourseRowProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        course.code,
        course.title,
        `${course.credits} credits`,
        completed && "completed",
        starred && "starred",
      ]
        .filter(Boolean)
        .join(", ")}
      onPress={() => onPress(course.code)}
      testID={`course-row-${course.code}`}
      style={({ pressed }) => [themed([$card, $row]), pressed && $pressed]}
    >
      <DeptBadge prefix={course.prefix} />
      <View style={$main}>
        <View style={$topLine}>
          <Highlighted
            segments={highlightCode(course.code, query)}
            weight="bold"
            size="sm"
            matchStyle={{ color: colors.tint }}
          />
          {completed && <Ionicons name="checkmark-circle" size={15} color={colors.success} />}
          {starred && <Ionicons name="star" size={13} color={colors.star} />}
        </View>
        <Highlighted
          segments={highlightWords(course.title, query)}
          size="xs"
          style={themed($title)}
          matchStyle={themed($titleMatch)}
        />
      </View>
      <View style={themed($pill)}>
        <Text
          size="xxs"
          weight="medium"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={themed($pillText)}
          text={`${course.credits} cr · ${course.career}`}
        />
      </View>
    </Pressable>
  )
})

type HighlightedProps = {
  segments: Segment[]
  matchStyle: TextStyle
} & Pick<ComponentProps<typeof Text>, "size" | "weight" | "style">

/** One line of text with the matched runs emphasised. */
function Highlighted({ segments, matchStyle, ...textProps }: HighlightedProps) {
  return (
    <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} {...textProps}>
      {segments.map((s, i) =>
        s.match ? <Text key={i} weight="bold" style={matchStyle} text={s.text} /> : s.text,
      )}
    </Text>
  )
}

const $row: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: CARD_HEIGHT,
  marginBottom: GAP,
  marginHorizontal: spacing.md,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.sm,
  gap: spacing.sm,
})

const $pressed: ViewStyle = { opacity: 0.75, transform: [{ scale: 0.985 }] }

const $main: ViewStyle = { flex: 1 }

const $topLine: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 6 }

const $title: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $titleMatch: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })

const $pill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignSelf: "flex-start",
  marginTop: spacing.sm,
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
  borderRadius: 8,
  backgroundColor: colors.surfaceAlt,
})

const $pillText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
