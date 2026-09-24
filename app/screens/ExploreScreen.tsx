import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Chip } from "@/components/course/Chip"
import { COURSE_ROW_HEIGHT, CourseRow } from "@/components/course/CourseRow"
import { DepartmentPicker } from "@/components/course/DepartmentPicker"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField, TextFieldAccessoryProps } from "@/components/TextField"
import { getIndex, searchCourses, unlockedCourses } from "@/data/catalog"
import type { Career, CourseSummary } from "@/data/types"
import { translate } from "@/i18n/translate"
import type { TabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useCompleted, useSelectedTerm, useStarred } from "@/utils/usePreferences"

export function ExploreScreen({ navigation }: TabScreenProps<"Explore">) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { terms, departments, courses } = getIndex()

  const [text, setText] = useState("")
  const [term, setTerm] = useSelectedTerm()
  const [prefix, setPrefix] = useState<string>()
  const [career, setCareer] = useState<Career>()
  const [pickerOpen, setPickerOpen] = useState(false)
  const { starred } = useStarred()
  const { completed } = useCompleted()
  const [unlockedChosen, setOnlyUnlocked] = useState(false)
  // The chip only exists while something is completed; if the user un-completes everything,
  // the filter switches itself off rather than leaving an invisible filter with 0 results.
  const onlyUnlocked = unlockedChosen && completed.size > 0
  const unlocked = useMemo(
    () => (onlyUnlocked ? unlockedCourses(completed, term) : undefined),
    [onlyUnlocked, completed, term],
  )

  // Typing updates `text` immediately (the input stays responsive); the list filters on the
  // deferred copy, which React lets lag behind during fast typing instead of blocking input.
  const query = useDeferredValue(text)
  const results = useMemo(
    () => searchCourses({ text: query, term, prefix, career, only: unlocked }),
    [query, term, prefix, career, unlocked],
  )

  // Department counts respect the other filters, so the picker never offers a dead end silently.
  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of courses) {
      if (term !== undefined && !c.terms.includes(term)) continue
      if (career && c.career !== career) continue
      counts.set(c.prefix, (counts.get(c.prefix) ?? 0) + 1)
    }
    return counts
  }, [courses, term, career])

  const listRef = useRef<FlatList<CourseSummary>>(null)
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [query, term, prefix, career, unlocked])

  const openCourse = useCallback(
    (code: string) => navigation.navigate("CourseDetail", { code, term }),
    [navigation, term],
  )

  const hasFilters = !!text || !!prefix || !!career || onlyUnlocked
  const clearFilters = () => {
    setText("")
    setPrefix(undefined)
    setCareer(undefined)
    setOnlyUnlocked(false)
  }

  const renderItem = useCallback(
    ({ item }: { item: CourseSummary }) => (
      <CourseRow course={item} starred={starred.has(item.code)} onPress={openCourse} />
    ),
    [starred, openCourse],
  )

  const SearchIcon = useCallback(
    (props: TextFieldAccessoryProps) => (
      <View style={[props.style, $accessory]}>
        <Ionicons name="search" size={18} color={colors.textDim} />
      </View>
    ),
    [colors.textDim],
  )
  const ClearButton = useCallback(
    (props: TextFieldAccessoryProps) =>
      text ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate("explore:clearSearch")}
          onPress={() => setText("")}
          hitSlop={10}
          style={[props.style, $accessory]}
        >
          <Ionicons name="close-circle" size={18} color={colors.textDim} />
        </Pressable>
      ) : null,
    [text, colors.textDim],
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={$flex}>
      <View style={themed($header)}>
        <View style={$titleRow}>
          <Text preset="heading" size="xl" tx="explore:title" />
          <Text
            size="xs"
            style={themed($dim)}
            text={translate("explore:count", { count: results.length })}
          />
        </View>

        <TextField
          value={text}
          onChangeText={setText}
          placeholderTx="explore:searchPlaceholder"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          testID="search-input"
          clearButtonMode="never"
          accessibilityLabel={translate("explore:searchPlaceholder")}
          LeftAccessory={SearchIcon}
          RightAccessory={ClearButton}
          inputWrapperStyle={themed($search)}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={themed($chipRow)}
        style={$chipScroller}
      >
        <Chip
          label={translate("explore:allTerms")}
          selected={term === undefined}
          onPress={() => setTerm(undefined)}
        />
        {terms.map((t, i) => (
          <Chip key={t.code} label={t.name} selected={term === i} onPress={() => setTerm(i)} />
        ))}
      </ScrollView>

      <View style={themed([$chipRow, $lastChipRow])}>
        <Chip
          label={prefix ?? translate("explore:allDepartments")}
          selected={!!prefix}
          icon="chevron-down"
          onPress={() => setPickerOpen(true)}
        />
        {(["UG", "PG"] as const).map((c) => (
          <Chip
            key={c}
            label={c}
            selected={career === c}
            onPress={() => setCareer(career === c ? undefined : c)}
          />
        ))}
        {completed.size > 0 && (
          <Chip
            label={translate("explore:unlocked")}
            selected={onlyUnlocked}
            icon="lock-open-outline"
            onPress={() => setOnlyUnlocked((v) => !v)}
          />
        )}
        {hasFilters && (
          <Pressable accessibilityRole="button" onPress={clearFilters} hitSlop={8}>
            <Text
              size="xs"
              weight="medium"
              style={{ color: colors.tint }}
              tx="explore:clearFilters"
            />
          </Pressable>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={results}
        keyExtractor={(c) => c.code}
        renderItem={renderItem}
        extraData={starred}
        getItemLayout={(_, index) => ({
          length: COURSE_ROW_HEIGHT,
          offset: COURSE_ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={9}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={$flex}
        ListEmptyComponent={
          <EmptyState
            headingTx="explore:noResultsHeading"
            contentTx="explore:noResultsContent"
            buttonTx="explore:clearFilters"
            buttonOnPress={clearFilters}
            style={themed($empty)}
          />
        }
      />

      <DepartmentPicker
        visible={pickerOpen}
        departments={departments}
        counts={departmentCounts}
        selected={prefix}
        onSelect={setPrefix}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  )
}

const $flex: ViewStyle = { flex: 1 }

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
  gap: spacing.sm,
})

const $titleRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
}

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $search: ThemedStyle<ViewStyle> = () => ({ borderRadius: 10, alignItems: "center" })

const $accessory: ViewStyle = { justifyContent: "center", alignSelf: "center" }

const $chipScroller: ViewStyle = { flexGrow: 0 }

const $chipRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
})

const $lastChipRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexWrap: "wrap",
  rowGap: spacing.xs,
  paddingBottom: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
})

const $empty: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xl,
  paddingHorizontal: spacing.lg,
})
