import { useCallback, useMemo } from "react"
import { FlatList, ViewStyle } from "react-native"

import { COURSE_ROW_HEIGHT, CourseRow } from "@/components/course/CourseRow"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { getCourse } from "@/data/catalog"
import type { CourseSummary } from "@/data/types"
import type { TabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useSelectedTerm, useStarred } from "@/utils/usePreferences"

export function StarredScreen({ navigation }: TabScreenProps<"Starred">) {
  const { themed } = useAppTheme()
  const { starred } = useStarred()
  const [term] = useSelectedTerm()

  // Codes are stored, not objects, so a regenerated dataset can't leave stale copies behind;
  // anything no longer in the catalogue is simply skipped.
  const courses = useMemo(
    () => [...starred].map(getCourse).filter((c): c is CourseSummary => !!c),
    [starred],
  )

  const openCourse = useCallback(
    (code: string) => navigation.navigate("CourseDetail", { code, term }),
    [navigation, term],
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={$flex}>
      <Text preset="heading" size="xl" tx="starred:title" style={themed($title)} />
      <FlatList
        data={courses}
        keyExtractor={(c) => c.code}
        renderItem={({ item }) => <CourseRow course={item} starred onPress={openCourse} />}
        getItemLayout={(_, index) => ({
          length: COURSE_ROW_HEIGHT,
          offset: COURSE_ROW_HEIGHT * index,
          index,
        })}
        style={$flex}
        ListEmptyComponent={
          <EmptyState
            headingTx="starred:emptyHeading"
            contentTx="starred:emptyContent"
            style={themed($empty)}
          />
        }
      />
    </Screen>
  )
}

const $flex: ViewStyle = { flex: 1 }

const $title: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
  paddingBottom: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
})

const $empty: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingTop: spacing.xl })
