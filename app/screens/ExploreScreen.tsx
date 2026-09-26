import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Keyboard, Pressable, ScrollView, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Chip } from "@/components/course/Chip"
import { COURSE_ROW_HEIGHT, CourseRow } from "@/components/course/CourseRow"
import { CourseFilters, FilterSheet } from "@/components/course/FilterSheet"
import { HeroButton, HeroHeader } from "@/components/course/HeroHeader"
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
  const { terms } = getIndex()

  const [text, setText] = useState("")
  const [term, setTerm] = useSelectedTerm()
  const [prefix, setPrefix] = useState<string>()
  const [career, setCareer] = useState<Career>()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { starred } = useStarred()
  const { completed } = useCompleted()
  const [unlockedChosen, setOnlyUnlocked] = useState(false)
  // The filter only exists while something is completed; if the user un-completes everything,
  // it switches itself off rather than leaving an invisible filter with 0 results.
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

  const listRef = useRef<FlatList<CourseSummary>>(null)
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [query, term, prefix, career, unlocked])

  const openCourse = useCallback(
    (code: string) => navigation.navigate("CourseDetail", { code, term }),
    [navigation, term],
  )

  const activeFilterCount = [prefix, career, onlyUnlocked || undefined].filter(Boolean).length

  const countFor = useCallback(
    (f: CourseFilters) =>
      searchCourses({
        text: query,
        term: f.term,
        prefix: f.prefix,
        career: f.career,
        only: f.onlyUnlocked && completed.size > 0 ? unlockedCourses(completed, f.term) : undefined,
      }).length,
    [query, completed],
  )
  const applyFilters = (f: CourseFilters) => {
    setTerm(f.term)
    setPrefix(f.prefix)
    setCareer(f.career)
    setOnlyUnlocked(f.onlyUnlocked)
  }
  const openFilters = () => {
    Keyboard.dismiss()
    setSheetOpen(true)
  }
  const clearFilters = () => {
    setText("")
    setPrefix(undefined)
    setCareer(undefined)
    setOnlyUnlocked(false)
  }

  const renderItem = useCallback(
    ({ item }: { item: CourseSummary }) => (
      <CourseRow
        course={item}
        starred={starred.has(item.code)}
        completed={completed.has(item.code)}
        query={query}
        onPress={openCourse}
      />
    ),
    [starred, completed, query, openCourse],
  )

  const extraData = useMemo(() => [starred, completed], [starred, completed])

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
    <Screen preset="fixed" systemBarStyle="light" contentContainerStyle={$flex}>
      <HeroHeader
        eyebrow={`HKUST · ${term === undefined ? translate("explore:allTerms") : terms[term].name}`}
        title={translate("explore:title")}
        subtitle={translate("explore:count", {
          count: results.length,
          n: results.length.toLocaleString("en-US"),
        })}
        right={
          <HeroButton
            icon="options-outline"
            active={activeFilterCount > 0}
            badge={activeFilterCount}
            accessibilityLabel={
              activeFilterCount
                ? translate("explore:filtersActive", { count: activeFilterCount })
                : translate("explore:filters")
            }
            testID="filters-button"
            onPress={openFilters}
          />
        }
      >
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
      </HeroHeader>

      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={themed($chipRow)}
          style={$chipScroller}
        >
          {prefix && (
            <Chip
              label={prefix}
              selected
              icon="close"
              accessibilityLabel={translate("explore:remove", { label: prefix })}
              onPress={() => setPrefix(undefined)}
            />
          )}
          {career && (
            <Chip
              label={translate(career === "UG" ? "course:undergraduate" : "course:postgraduate")}
              selected
              icon="close"
              accessibilityLabel={translate("explore:remove", { label: career })}
              onPress={() => setCareer(undefined)}
            />
          )}
          {onlyUnlocked && (
            <Chip
              label={translate("explore:unlocked")}
              selected
              icon="close"
              accessibilityLabel={translate("explore:remove", {
                label: translate("explore:unlocked"),
              })}
              onPress={() => setOnlyUnlocked(false)}
            />
          )}
          <Pressable accessibilityRole="button" onPress={clearFilters} hitSlop={8}>
            <Text
              size="xs"
              weight="medium"
              style={{ color: colors.tint }}
              tx="explore:clearFilters"
            />
          </Pressable>
        </ScrollView>
      )}

      <FlatList
        ref={listRef}
        data={results}
        keyExtractor={(c) => c.code}
        renderItem={renderItem}
        extraData={extraData}
        getItemLayout={(_, index) => ({
          length: COURSE_ROW_HEIGHT,
          offset: LIST_TOP_GAP + COURSE_ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={9}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={$flex}
        contentContainerStyle={themed($listContent)}
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

      <FilterSheet
        visible={sheetOpen}
        value={{ term, prefix, career, onlyUnlocked }}
        canFilterUnlocked={completed.size > 0}
        countFor={countFor}
        defaultTerm={0}
        onApply={applyFilters}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  )
}

const $flex: ViewStyle = { flex: 1 }

const $search: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderRadius: 14,
  alignItems: "center",
  backgroundColor: colors.heroField,
  borderColor: colors.transparent,
})

const $accessory: ViewStyle = { justifyContent: "center", alignSelf: "center" }

const $chipScroller: ViewStyle = { flexGrow: 0 }

const $chipRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
  paddingBottom: spacing.xs,
})

/** Room above the first card so its shadow isn't clipped; getItemLayout adds it to offsets. */
const LIST_TOP_GAP = 12

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: LIST_TOP_GAP,
  paddingBottom: spacing.md,
})

const $empty: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xl,
  paddingHorizontal: spacing.lg,
})
