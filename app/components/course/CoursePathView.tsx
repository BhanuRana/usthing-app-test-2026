import { Fragment } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { getCourse, getIndex } from "@/data/catalog"
import type { CoursePath, PathCourse } from "@/data/prereq/plan"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface CoursePathViewProps {
  path: CoursePath
  /** The course the path leads to. */
  target: string
  starred: ReadonlySet<string>
  /** Whether the user has marked anything completed (if not, suggest it). */
  hasCompleted: boolean
  onOpenCourse: (code: string) => void
  onStarAll: (codes: string[]) => void
}

const SEASON_ORDER = ["Fall", "Winter", "Spring", "Summer"]

/**
 * "Fall · Spring": the seasons a course runs in, from the terms in the dataset. Only shown
 * when that narrows things down; a course offered in every term gets nothing.
 */
function seasonsOf(code: string): string | undefined {
  const course = getCourse(code)
  if (!course) return undefined
  const { terms } = getIndex()
  const name = (t: number) => terms[t].name.split(" ").pop()!
  const seasons = new Set(course.terms.map(name))
  if (seasons.size === new Set(terms.map((_, i) => name(i))).size) return undefined
  return SEASON_ORDER.filter((s) => seasons.has(s)).join(" · ")
}

/**
 * The body of the "Your path" card: the courses still to take before `target`, as a
 * numbered timeline ending at the target, with a button to star all of them.
 */
export function CoursePathView(props: CoursePathViewProps) {
  const { path, target, starred, hasCompleted, onOpenCourse, onStarAll } = props
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  const all = [...path.steps.flat().map((c) => c.code), target].filter((c) => getCourse(c))
  const allStarred = all.every((c) => starred.has(c))

  return (
    <View>
      {path.completedUsed.length > 0 && (
        <View style={$counting}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text
            size="xxs"
            style={[themed($dim), $flex]}
            text={translate("path:counting", { codes: path.completedUsed.join(", ") })}
          />
        </View>
      )}

      {path.steps.map((courses, i) => (
        <Fragment key={i}>
          <StepHeader
            marker={
              <Text
                size="xxs"
                weight="bold"
                style={[themed($markerText), i === 0 && { color: colors.palette.neutral100 }]}
                text={`${i + 1}`}
              />
            }
            filled={i === 0}
            label={translate("path:step", { n: i + 1 })}
            note={i === 0 ? translate("path:takeNow") : undefined}
          />
          <View style={$stepBody}>
            <View style={themed($rail)} />
            <View style={$courses}>
              {courses.map((c) => (
                <PathRow
                  key={c.code}
                  course={c}
                  starred={starred.has(c.code)}
                  onPress={onOpenCourse}
                />
              ))}
            </View>
          </View>
        </Fragment>
      ))}

      <StepHeader
        marker={<Ionicons name="flag" size={13} color={colors.palette.neutral100} />}
        filled
        goal
        label={target}
        note={translate("path:goal")}
      />
      {path.targetOtherRequirements && (
        <Text size="xxs" style={[themed($otherTag), $goalTag]} tx="path:otherRequirements" />
      )}

      {path.loops && <Text size="xxs" style={themed([$dim, $footnote])} tx="path:loops" />}
      {!hasCompleted && <Text size="xxs" style={themed([$dim, $footnote])} tx="path:hint" />}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate(allStarred ? "path:allStarred" : "path:starAll")}
        accessibilityState={{ disabled: allStarred }}
        disabled={allStarred}
        onPress={() => onStarAll(all)}
        testID="star-path"
        style={({ pressed }) => [
          themed($starAll),
          allStarred && themed($starAllDone),
          pressed && $pressed,
        ]}
      >
        <Ionicons
          name={allStarred ? "checkmark" : "star-outline"}
          size={17}
          color={allStarred ? colors.textDim : colors.tint}
        />
        <Text
          size="xs"
          weight="semiBold"
          style={{ color: allStarred ? colors.textDim : colors.tint }}
          tx={allStarred ? "path:allStarred" : "path:starAll"}
        />
      </Pressable>
    </View>
  )
}

interface StepHeaderProps {
  marker: React.ReactNode
  filled?: boolean
  goal?: boolean
  label: string
  note?: string
}

/** A timeline node: a round marker with the step's label beside it. */
function StepHeader({ marker, filled, goal, label, note }: StepHeaderProps) {
  const { themed } = useAppTheme()
  return (
    <View style={$stepHeader} accessibilityRole="header">
      <View style={themed([$marker, filled ? $markerFilled : $markerOpen, goal && $markerGoal])}>
        {marker}
      </View>
      <Text
        size={goal ? "sm" : "xxs"}
        weight={goal ? "bold" : "semiBold"}
        style={themed(goal ? $goalLabel : $stepLabel)}
        text={label}
      />
      {note && <Text size="xxs" style={themed($dim)} text={`· ${note}`} />}
    </View>
  )
}

/** One course on the path: tap to open it. */
function PathRow(props: { course: PathCourse; starred: boolean; onPress: (code: string) => void }) {
  const { course, starred, onPress } = props
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const summary = getCourse(course.code)
  const seasons = seasonsOf(course.code)
  const alternatives = course.alternatives.length
    ? translate("path:or", { codes: course.alternatives.join(" / ") })
    : undefined

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        course.code,
        summary?.title ?? translate("path:notInCatalogue"),
        seasons && translate("path:offered", { seasons }),
        alternatives,
      ]
        .filter(Boolean)
        .join(", ")}
      disabled={!summary}
      onPress={() => onPress(course.code)}
      testID={`path-course-${course.code}`}
      style={({ pressed }) => [themed($row), pressed && $pressed]}
    >
      <View style={$rowTop}>
        <Text size="xs" weight="semiBold" style={themed($code)} text={course.code} />
        {starred && <Ionicons name="star" size={12} color={colors.star} />}
        <View style={$flex} />
        {seasons && <Text size="xxs" style={themed($dim)} text={seasons} />}
      </View>
      <Text
        size="xxs"
        style={themed($dim)}
        numberOfLines={1}
        text={summary?.title ?? translate("path:notInCatalogue")}
      />
      {(alternatives || course.otherRequirements) && (
        <View style={$rowExtras}>
          {alternatives && <Text size="xxs" style={themed($alt)} text={alternatives} />}
          {course.otherRequirements && (
            <Text size="xxs" style={themed($otherTag)} tx="path:otherRequirements" />
          )}
        </View>
      )}
    </Pressable>
  )
}

const MARKER = 24

const $flex: ViewStyle = { flex: 1 }
const $pressed: ViewStyle = { opacity: 0.7 }

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $counting: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  marginBottom: 10,
}

const $stepHeader: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 8 }

const $marker: ThemedStyle<ViewStyle> = () => ({
  width: MARKER,
  height: MARKER,
  borderRadius: MARKER / 2,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1.5,
})

const $markerFilled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
})

const $markerOpen: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.surface,
  borderColor: colors.tint,
})

const $markerGoal: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.star,
  borderColor: colors.star,
})

const $markerText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  lineHeight: 14,
})

const $stepLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  textTransform: "uppercase",
  letterSpacing: 0.8,
})

const $goalLabel: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })

// The rail runs down from one marker to the next, beside that step's courses.
const $stepBody: ViewStyle = { flexDirection: "row" }

const $rail: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 2,
  marginLeft: MARKER / 2 - 1,
  marginRight: MARKER / 2 + 7,
  backgroundColor: colors.tintSoft,
  borderRadius: 1,
})

const $courses: ViewStyle = { flex: 1, gap: 6, paddingTop: 6, paddingBottom: 10 }

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 12,
  backgroundColor: colors.surfaceAlt,
  gap: 1,
})

const $rowTop: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4 }

const $code: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint })

const $rowExtras: ViewStyle = { flexDirection: "row", flexWrap: "wrap", columnGap: 8 }

const $alt: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontStyle: "italic",
})

const $otherTag: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.warning })

const $goalTag: TextStyle = { marginLeft: MARKER + 8, marginTop: 2 }

const $footnote: TextStyle = { marginTop: 10 }

const $starAll: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 42,
  marginTop: spacing.md,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: colors.tint,
})

const $starAllDone: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.separator,
})
