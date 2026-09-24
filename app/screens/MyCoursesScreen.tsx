import { useCallback, useMemo } from "react"
import { SectionList, TextStyle, View, ViewStyle } from "react-native"

import { CourseRow } from "@/components/course/CourseRow"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { getCourse } from "@/data/catalog"
import type { CourseSummary } from "@/data/types"
import { translate } from "@/i18n/translate"
import type { TabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useCompleted, useSelectedTerm, useStarred } from "@/utils/usePreferences"

/** Codes are stored, not objects: anything no longer in the catalogue is simply skipped. */
const toCourses = (codes: ReadonlySet<string>) =>
  [...codes].map(getCourse).filter((c): c is CourseSummary => !!c)

export function MyCoursesScreen({ navigation }: TabScreenProps<"MyCourses">) {
  const { themed } = useAppTheme()
  const { starred } = useStarred()
  const { completed } = useCompleted()
  const [term] = useSelectedTerm()

  const sections = useMemo(
    () => [
      { key: "starred", title: translate("myCourses:starred"), data: toCourses(starred) },
      { key: "completed", title: translate("myCourses:completed"), data: toCourses(completed) },
    ],
    [starred, completed],
  )
  const isEmpty = sections.every((s) => s.data.length === 0)

  const openCourse = useCallback(
    (code: string) => navigation.navigate("CourseDetail", { code, term }),
    [navigation, term],
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={$flex}>
      <Text preset="heading" size="xl" tx="myCourses:title" style={themed($title)} />
      {isEmpty ? (
        <EmptyState
          headingTx="myCourses:emptyHeading"
          contentTx="myCourses:emptyContent"
          style={themed($empty)}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(c, i) => `${c.code}-${i}`}
          renderItem={({ item }) => (
            <CourseRow course={item} starred={starred.has(item.code)} onPress={openCourse} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={themed($sectionHeader)}>
              <Text
                size="xs"
                weight="bold"
                style={themed($sectionTitle)}
                text={`${section.title.toUpperCase()} · ${section.data.length}`}
              />
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text size="xs" style={themed($none)} tx="myCourses:none" />
            ) : null
          }
          stickySectionHeadersEnabled
          style={$flex}
        />
      )}
    </Screen>
  )
}

const $flex: ViewStyle = { flex: 1 }

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
  paddingBottom: spacing.xs,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  paddingHorizontal: spacing.md,
  paddingTop: spacing.md,
  paddingBottom: spacing.xs,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  letterSpacing: 0.8,
})

const $none: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
})

const $empty: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xl,
  paddingHorizontal: spacing.lg,
})
