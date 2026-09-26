import { useCallback, useEffect, useMemo, useState } from "react"
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  Switch,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { scheduleOnRN } from "react-native-worklets"

import { Text } from "@/components/Text"
import { getIndex } from "@/data/catalog"
import type { Career } from "@/data/types"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { Chip } from "./Chip"
import { DepartmentPicker } from "./DepartmentPicker"
import { DeptBadge } from "./DeptBadge"

export interface CourseFilters {
  /** Term index, or undefined for all terms. */
  term?: number
  prefix?: string
  career?: Career
  onlyUnlocked: boolean
}

interface FilterSheetProps {
  visible: boolean
  value: CourseFilters
  /** Whether "Unlocked for me" is available (the user has completed something). */
  canFilterUnlocked: boolean
  /** How many courses a set of filters would show, so the button can say before applying. */
  countFor: (filters: CourseFilters) => number
  /** The term the sheet resets to (the newest one), since the term is never truly "unset". */
  defaultTerm?: number
  onApply: (filters: CourseFilters) => void
  onClose: () => void
}

const OPEN = { duration: 320, easing: Easing.out(Easing.cubic) }
const CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) }

/**
 * Filters in a sheet that drops from the top, next to the button that opened it. Changes are
 * a draft until "Show N courses"; dismissing (backdrop, swipe up, back) discards them.
 */
export function FilterSheet(props: FilterSheetProps) {
  const { visible, value, canFilterUnlocked, countFor, defaultTerm, onApply, onClose } = props
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { top } = useSafeAreaInsets()
  const { height: screenHeight } = useWindowDimensions()
  const { terms, departments, courses } = getIndex()

  const [mounted, setMounted] = useState(visible)
  const [draft, setDraft] = useState(value)
  const [pickerOpen, setPickerOpen] = useState(false)

  const progress = useSharedValue(0)
  const drag = useSharedValue(0)
  const sheetHeight = useSharedValue(screenHeight)

  useEffect(() => {
    if (visible) {
      setDraft(value)
      drag.value = 0
      setMounted(true)
    }
    // Only when opening: the draft must not be overwritten while the sheet is being used.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const finishClose = useCallback(() => {
    setMounted(false)
    onClose()
  }, [onClose])

  const close = useCallback(() => {
    drag.value = withTiming(0, CLOSE)
    progress.value = withTiming(0, CLOSE, (done) => {
      if (done) scheduleOnRN(finishClose)
    })
  }, [drag, progress, finishClose])

  const apply = () => {
    onApply(draft)
    close()
  }

  const onSheetLayout = (e: LayoutChangeEvent) => {
    sheetHeight.value = e.nativeEvent.layout.height
    if (progress.value === 0) progress.value = withTiming(1, OPEN)
  }

  // Swipe up to dismiss; pulling down stretches a little and springs back.
  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      drag.value = e.translationY < 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd((e) => {
      if (e.translationY < -sheetHeight.value * 0.25 || e.velocityY < -700) {
        scheduleOnRN(close)
      } else {
        drag.value = withSpring(0, { damping: 18, stiffness: 220 })
      }
    })

  const $sheetAnimated = useAnimatedStyle(() => ({
    transform: [{ translateY: (progress.value - 1) * sheetHeight.value + drag.value }],
  }))
  const $backdropAnimated = useAnimatedStyle(() => ({
    opacity: progress.value * interpolate(drag.value, [-sheetHeight.value, 0], [0, 1], "clamp"),
  }))

  const resultCount = useMemo(() => (mounted ? countFor(draft) : 0), [mounted, countFor, draft])

  // Department counts follow the draft's term and level, so the picker shows dead ends.
  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of courses) {
      if (draft.term !== undefined && !c.terms.includes(draft.term)) continue
      if (draft.career && c.career !== draft.career) continue
      counts.set(c.prefix, (counts.get(c.prefix) ?? 0) + 1)
    }
    return counts
  }, [courses, draft.term, draft.career])

  const isDefault =
    draft.term === defaultTerm && !draft.prefix && !draft.career && !draft.onlyUnlocked
  const reset = () => setDraft({ term: defaultTerm, onlyUnlocked: false })
  const update = (patch: Partial<CourseFilters>) => setDraft((d) => ({ ...d, ...patch }))

  const levels: { value: Career | undefined; label: string }[] = [
    { value: undefined, label: translate("filters:allLevels") },
    { value: "UG", label: translate("course:undergraduate") },
    { value: "PG", label: translate("course:postgraduate") },
  ]

  if (!mounted) return null

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={$flex}>
        <Animated.View style={[themed($backdrop), $backdropAnimated]}>
          <Pressable
            style={$flex}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={translate("common:cancel")}
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={onSheetLayout}
            style={[themed($sheet), { paddingTop: top + 8 }, $sheetAnimated]}
            testID="filter-sheet"
          >
            <View style={$titleRow}>
              <Text preset="subheading" tx="filters:title" />
              <Pressable
                accessibilityRole="button"
                onPress={reset}
                disabled={isDefault}
                hitSlop={10}
              >
                <Text
                  weight="medium"
                  style={{ color: isDefault ? colors.textDim : colors.tint }}
                  tx="filters:reset"
                />
              </Pressable>
            </View>

            <Section title={translate("filters:term")}>
              <View style={themed($wrap)}>
                <Chip
                  label={translate("explore:allTerms")}
                  selected={draft.term === undefined}
                  onPress={() => update({ term: undefined })}
                />
                {terms.map((t, i) => (
                  <Chip
                    key={t.code}
                    label={t.name}
                    selected={draft.term === i}
                    onPress={() => update({ term: i })}
                  />
                ))}
              </View>
            </Section>

            <Section title={translate("filters:level")}>
              <View style={themed($segmented)} accessibilityRole="radiogroup">
                {levels.map((l) => {
                  const selected = draft.career === l.value
                  return (
                    <Pressable
                      key={l.label}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={l.label}
                      onPress={() => update({ career: l.value })}
                      style={[themed($segment), selected && themed($segmentSelected)]}
                    >
                      <Text
                        size="xs"
                        weight={selected ? "semiBold" : "medium"}
                        style={{ color: selected ? colors.tint : colors.textDim }}
                        text={l.label}
                        numberOfLines={1}
                      />
                    </Pressable>
                  )
                })}
              </View>
            </Section>

            <Section title={translate("filters:department")}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${translate("filters:department")}: ${
                  draft.prefix ?? translate("explore:allDepartments")
                }`}
                testID="filter-department"
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [themed($optionRow), pressed && $pressed]}
              >
                {draft.prefix ? (
                  <DeptBadge prefix={draft.prefix} size={32} />
                ) : (
                  <View style={themed($iconTile)}>
                    <Ionicons name="apps-outline" size={16} color={colors.textDim} />
                  </View>
                )}
                <Text
                  weight="medium"
                  style={$grow}
                  text={draft.prefix ?? translate("explore:allDepartments")}
                />
                {draft.prefix && (
                  <Text
                    size="xs"
                    style={themed($dim)}
                    text={String(departmentCounts.get(draft.prefix) ?? 0)}
                  />
                )}
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>
            </Section>

            {canFilterUnlocked && (
              <Section title={translate("filters:progress")}>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: draft.onlyUnlocked }}
                  accessibilityLabel={translate("explore:unlocked")}
                  onPress={() => update({ onlyUnlocked: !draft.onlyUnlocked })}
                  style={({ pressed }) => [themed($optionRow), pressed && $pressed]}
                >
                  <View style={themed($iconTile)}>
                    <Ionicons name="lock-open-outline" size={16} color={colors.success} />
                  </View>
                  <View style={$grow}>
                    <Text weight="medium" tx="explore:unlocked" />
                    <Text size="xxs" style={themed($dim)} tx="filters:unlockedHint" />
                  </View>
                  <Switch
                    value={draft.onlyUnlocked}
                    onValueChange={(v) => update({ onlyUnlocked: v })}
                    trackColor={{ true: colors.tint, false: colors.separator }}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                  />
                </Pressable>
              </Section>
            )}

            <Pressable
              accessibilityRole="button"
              testID="filters-apply"
              onPress={apply}
              style={({ pressed }) => [
                themed($applyButton),
                resultCount === 0 && themed($applyButtonEmpty),
                pressed && $pressed,
              ]}
            >
              <Text
                weight="semiBold"
                style={{
                  color: resultCount === 0 ? colors.textDim : colors.palette.neutral100,
                }}
                text={
                  resultCount === 0
                    ? translate("filters:showNone")
                    : translate("filters:show", {
                        count: resultCount,
                        n: resultCount.toLocaleString("en-US"),
                      })
                }
              />
            </Pressable>

            <View style={themed($grabber)} />
          </Animated.View>
        </GestureDetector>

        <DepartmentPicker
          visible={pickerOpen}
          departments={departments}
          counts={departmentCounts}
          selected={draft.prefix}
          onSelect={(prefix) => update({ prefix })}
          onClose={() => setPickerOpen(false)}
        />
      </GestureHandlerRootView>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($section)}>
      <Text size="xxs" weight="semiBold" style={themed($sectionTitle)} text={title} />
      {children}
    </View>
  )
}

const $flex: ViewStyle = { flex: 1 }
const $grow: ViewStyle = { flex: 1 }
const $pressed: ViewStyle = { opacity: 0.7 }

const $backdrop: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: colors.palette.overlay50,
})

const $sheet: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xs,
  backgroundColor: isDark ? colors.surface : colors.background,
  borderBottomLeftRadius: 28,
  borderBottomRightRadius: 28,
  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
})

const $titleRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 4,
}

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.md,
  gap: spacing.xs,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.8,
})

const $wrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $segmented: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexDirection: "row",
  padding: 3,
  borderRadius: 12,
  backgroundColor: colors.surfaceAlt,
})

const $segment: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 7,
  borderRadius: 9,
})

const $segmentSelected: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  backgroundColor: isDark ? colors.tintSoft : colors.surface,
  shadowColor: colors.shadow,
  shadowOpacity: 1,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: isDark ? 0 : 1,
})

const $optionRow: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs + 2,
  borderRadius: 14,
  backgroundColor: isDark ? colors.surfaceAlt : colors.surface,
  borderWidth: isDark ? 0 : 1,
  borderColor: colors.separator,
})

const $iconTile: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 32,
  height: 32,
  borderRadius: 9,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.surfaceAlt,
})

const $applyButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.lg,
  height: 50,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.tint,
})

const $applyButtonEmpty: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.surfaceAlt,
})

const $grabber: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignSelf: "center",
  width: 40,
  height: 5,
  borderRadius: 3,
  marginTop: spacing.sm,
  backgroundColor: colors.separator,
})

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
