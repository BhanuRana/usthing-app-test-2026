import { useCallback, useEffect, useMemo, useState } from "react"
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
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
import { getCourse } from "@/data/catalog"
import type { MissingGroup } from "@/data/prereq/evaluate"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { DeptBadge } from "./DeptBadge"

interface StarPromptProps {
  visible: boolean
  /** The course being starred. */
  code: string
  /** Its unmet prerequisites (see `missingGroups`). */
  groups: MissingGroup[]
  starred: ReadonlySet<string>
  /** Called with every code to star: the course itself plus the chosen prerequisites. */
  onConfirm: (codes: string[]) => void
  onClose: () => void
}

const OPEN = { duration: 300, easing: Easing.out(Easing.cubic) }
const CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) }

/** A course can be picked if it exists and isn't starred yet. */
const pickable = (codes: string[], starred: ReadonlySet<string>) =>
  codes.every((c) => !!getCourse(c)) && codes.some((c) => !starred.has(c))

/**
 * Shown when starring a course whose prerequisites aren't met: says what's missing and offers
 * to star those courses too. Required courses are checkboxes; "one of" groups are pick-one
 * (tap the picked option again to clear it), preset to their first option. Dismissing stars
 * nothing.
 */
export function StarPrompt(props: StarPromptProps) {
  const { visible, code, groups, starred, onConfirm, onClose } = props
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { bottom } = useSafeAreaInsets()
  const { height: screenHeight } = useWindowDimensions()

  const [mounted, setMounted] = useState(visible)
  // Required courses picked, by code; and the option picked in each "one of" group, by index.
  const [required, setRequired] = useState<Set<string>>(new Set())
  const [choices, setChoices] = useState<(number | undefined)[]>([])

  const progress = useSharedValue(0)
  const drag = useSharedValue(0)
  const sheetHeight = useSharedValue(screenHeight)

  useEffect(() => {
    if (!visible) return
    setRequired(
      new Set(
        groups.flatMap((g) => (g.kind === "all" && pickable([g.code], starred) ? [g.code] : [])),
      ),
    )
    setChoices(
      groups.map((g) => {
        if (g.kind === "all") return undefined
        // A group with a starred option is already covered: preselect nothing there.
        if (g.options.some((o) => o.every((c) => starred.has(c)))) return undefined
        const first = g.options.findIndex((o) => pickable(o, starred))
        return first === -1 ? undefined : first
      }),
    )
    drag.value = 0
    setMounted(true)
    // Only when opening, so later changes don't reset what the user picked.
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

  const extra = useMemo(() => {
    const codes = new Set(required)
    groups.forEach((g, i) => {
      const choice = choices[i]
      if (g.kind === "any" && choice !== undefined) g.options[choice].forEach((c) => codes.add(c))
    })
    return [...codes].filter((c) => !starred.has(c))
  }, [required, choices, groups, starred])

  const primaryLabel = extra.length
    ? translate("starPrompt:starWith", { code, count: extra.length, n: extra.length })
    : translate("starPrompt:pickSome")

  const confirm = (codes: string[]) => {
    onConfirm(codes)
    close()
  }

  const toggleRequired = (c: string) =>
    setRequired((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  const choose = (group: number, option: number) =>
    setChoices((prev) =>
      prev.map((v, i) => (i === group ? (v === option ? undefined : option) : v)),
    )

  const onSheetLayout = (e: LayoutChangeEvent) => {
    sheetHeight.value = e.nativeEvent.layout.height
    if (progress.value === 0) progress.value = withTiming(1, OPEN)
  }

  // Swipe down to dismiss; pulling up stretches a little and springs back.
  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      drag.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd((e) => {
      if (e.translationY > sheetHeight.value * 0.25 || e.velocityY > 700) {
        scheduleOnRN(close)
      } else {
        drag.value = withSpring(0, { damping: 18, stiffness: 220 })
      }
    })

  const $sheetAnimated = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value + drag.value }],
  }))
  const $backdropAnimated = useAnimatedStyle(() => ({
    opacity: progress.value * interpolate(drag.value, [0, sheetHeight.value], [1, 0], "clamp"),
  }))

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
            style={[themed($sheet), { paddingBottom: bottom + 12 }, $sheetAnimated]}
            testID="star-prompt"
          >
            <View style={themed($grabber)} />

            <View style={$heading}>
              <View style={themed($alertIcon)}>
                <Ionicons name="alert-circle" size={22} color={colors.warning} />
              </View>
              <View style={$flex}>
                <Text preset="subheading" tx="starPrompt:title" />
                <Text size="xs" style={themed($dim)} tx="starPrompt:body" txOptions={{ code }} />
              </View>
            </View>

            <ScrollView style={{ maxHeight: screenHeight * 0.45 }} bounces={false}>
              {groups.map((g, gi) =>
                g.kind === "all" ? (
                  <View key={g.code} style={themed($group)}>
                    <GroupLabel text={translate("starPrompt:required")} />
                    <OptionRow
                      codes={[g.code]}
                      control="checkbox"
                      selected={required.has(g.code)}
                      starred={starred}
                      onPress={() => toggleRequired(g.code)}
                    />
                  </View>
                ) : (
                  <View key={`any-${gi}`} style={themed($group)} accessibilityRole="radiogroup">
                    <GroupLabel text={translate("starPrompt:oneOf")} />
                    {g.options.map((codes, oi) => (
                      <OptionRow
                        key={codes.join("+")}
                        codes={codes}
                        control="radio"
                        selected={choices[gi] === oi}
                        starred={starred}
                        onPress={() => choose(gi, oi)}
                      />
                    ))}
                  </View>
                ),
              )}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              accessibilityState={{ disabled: extra.length === 0 }}
              testID="star-with-prerequisites"
              disabled={extra.length === 0}
              onPress={() => confirm([code, ...extra])}
              style={({ pressed }) => [
                themed($primary),
                extra.length === 0 && themed($primaryDisabled),
                pressed && $pressed,
              ]}
            >
              <Ionicons
                name="star"
                size={18}
                color={extra.length ? colors.palette.neutral100 : colors.textDim}
              />
              <Text
                weight="semiBold"
                style={{ color: extra.length ? colors.palette.neutral100 : colors.textDim }}
                text={primaryLabel}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="star-only"
              onPress={() => confirm([code])}
              style={({ pressed }) => [$secondary, pressed && $pressed]}
              hitSlop={6}
            >
              <Text
                weight="medium"
                style={{ color: colors.tint }}
                tx="starPrompt:starOnly"
                txOptions={{ code }}
              />
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

function GroupLabel({ text }: { text: string }) {
  const { themed } = useAppTheme()
  return <Text size="xxs" weight="semiBold" style={themed($groupLabel)} text={text} />
}

interface OptionRowProps {
  codes: string[]
  control: "checkbox" | "radio"
  selected: boolean
  starred: ReadonlySet<string>
  onPress: () => void
}

/** One course (or courses taken together) that can be picked for starring. */
function OptionRow({ codes, control, selected, starred, onPress }: OptionRowProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const courses = codes.map(getCourse)
  const missing = courses.some((c) => !c)
  const allStarred = codes.every((c) => starred.has(c))
  const disabled = missing || allStarred
  const label = codes.join(" + ")
  const detail = missing
    ? translate("starPrompt:notInCatalogue")
    : codes.length > 1
      ? translate("starPrompt:together")
      : courses[0]!.title

  const icon =
    control === "radio"
      ? selected
        ? "radio-button-on"
        : "radio-button-off"
      : selected
        ? "checkbox"
        : "square-outline"

  return (
    <Pressable
      accessibilityRole={control}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${label}, ${allStarred ? translate("starPrompt:alreadyStarred") : detail}`}
      disabled={disabled}
      onPress={onPress}
      testID={`star-option-${label}`}
      style={({ pressed }) => [
        themed($row),
        selected && themed($rowSelected),
        disabled && $rowDisabled,
        pressed && $pressed,
      ]}
    >
      <DeptBadge prefix={codes[0].split(" ")[0]} size={30} />
      <View style={$flex}>
        <Text size="xs" weight="semiBold" text={label} numberOfLines={1} />
        <Text size="xxs" style={themed($dim)} text={detail} numberOfLines={1} />
      </View>
      {allStarred ? (
        <View style={$starredTag}>
          <Ionicons name="star" size={14} color={colors.star} />
          <Text size="xxs" style={themed($dim)} tx="starPrompt:alreadyStarred" />
        </View>
      ) : (
        !missing && (
          <Ionicons name={icon} size={22} color={selected ? colors.tint : colors.textDim} />
        )
      )}
    </Pressable>
  )
}

const $flex: ViewStyle = { flex: 1 }
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
  left: 0,
  right: 0,
  bottom: 0,
  paddingHorizontal: spacing.md,
  backgroundColor: isDark ? colors.surface : colors.background,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: -8 },
  elevation: 12,
})

const $grabber: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignSelf: "center",
  width: 40,
  height: 5,
  borderRadius: 3,
  marginTop: spacing.xs,
  marginBottom: spacing.sm,
  backgroundColor: colors.separator,
})

const $heading: ViewStyle = { flexDirection: "row", gap: 12, marginBottom: 4 }

const $alertIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.warningSoft,
})

const $group: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginTop: spacing.sm, gap: 6 })

const $groupLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.8,
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: isDark ? colors.transparent : colors.separator,
  backgroundColor: isDark ? colors.surfaceAlt : colors.surface,
})

const $rowSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
  backgroundColor: colors.tintSoft,
})

const $rowDisabled: ViewStyle = { opacity: 0.55 }

const $starredTag: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 3 }

const $primary: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  gap: 8,
  marginTop: spacing.lg,
  height: 50,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.tint,
})

const $primaryDisabled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.surfaceAlt,
})

const $secondary: ViewStyle = { alignSelf: "center", paddingVertical: 14 }

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
