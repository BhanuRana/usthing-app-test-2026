/**
 * The map's nodes: course cards (status tags, step and "leads to" badges) and the small
 * junctions where "one of" / "all of" groups meet. Both fade in and out with their column
 * and dim with the selection.
 */
import { memo, useEffect } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { Text } from "@/components/Text"
import { getCourse } from "@/data/catalog"
import type { CourseStatus } from "@/data/prereq/evaluate"
import type { MapNode } from "@/data/prereq/map"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import { departmentColor } from "@/theme/departmentColors"
import type { ThemedStyle } from "@/theme/types"

/** A rectangle in content points. */
export type Box = { x: number; y: number; w: number; h: number }

/** Fades a node down when it's outside the selected course's lineage, and back up. */
function useDimStyle(dim: boolean) {
  const opacity = useSharedValue(dim ? DIMMED : 1)
  useEffect(() => {
    opacity.value = withTiming(dim ? DIMMED : 1, { duration: 220 })
  }, [dim, opacity])
  return useAnimatedStyle(() => ({ opacity: opacity.value }))
}

/** New columns fade in; collapsed ones fade out. */
const NODE_IN = FadeIn.duration(260)
const NODE_OUT = FadeOut.duration(160)

interface CourseNodeProps {
  node: MapNode
  rect: Box
  isFocus: boolean
  isSelected: boolean
  completed: boolean
  starred: boolean
  step?: number
  onPathRing: boolean
  /** How many courses this one leads to, when tapping it would expand them (else 0). */
  leads: number
  /** Whether the student can take it (shown once anything is marked completed). */
  status?: CourseStatus
  dim: boolean
  isDark: boolean
  onSelect: (id: string) => void
}

export const CourseNode = memo(function CourseNode(props: CourseNodeProps) {
  const { node, rect, isFocus, isSelected, completed, starred, step, onPathRing, dim } = props
  const { isDark, onSelect, leads, status } = props
  const canTake = status?.kind === "can-take" && !isFocus
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const course = getCourse(node.id)
  const stripe = departmentColor(node.id.split(" ")[0], isDark).fg
  const fg = isFocus ? colors.palette.neutral100 : colors.text
  const title = course?.title ?? translate("map:notInCatalogue")
  const statusText = [
    completed && translate("map:completed"),
    starred && translate("map:starred"),
    step && translate("map:onPath", { n: step }),
  ]
    .filter(Boolean)
    .join(", ")

  const $dimAnimated = useDimStyle(dim)

  // Two layers: the outer one fades in and out with the column, the inner one dims with
  // the selection (both animate opacity, so they can't share a view).
  return (
    <Animated.View
      entering={NODE_IN}
      exiting={NODE_OUT}
      style={[$place, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={[translate("map:nodeLabel", { code: node.id, title }), statusText]
        .filter(Boolean)
        .join(", ")}
      accessibilityState={{ selected: isSelected }}
      onAccessibilityTap={() => onSelect(node.id)}
      testID={`map-node-${node.id}`}
    >
      <Animated.View
        style={[
          themed($node),
          !course && themed($nodeMissing),
          completed && !isFocus && themed($nodeCompleted),
          canTake && themed($nodeCanTake),
          onPathRing && !completed && themed($nodeOnPath),
          isFocus && themed($nodeFocus),
          isSelected && themed($nodeSelected),
          $dimAnimated,
        ]}
      >
        {!isFocus && <View style={[$stripe, { backgroundColor: stripe }]} />}
        <View style={$nodeBody}>
          <View style={$nodeTop}>
            <Text
              weight="bold"
              style={[$nodeCode, { color: isFocus ? fg : colors.tint }]}
              text={node.id}
            />
            {completed && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={isFocus ? colors.palette.neutral100 : colors.success}
              />
            )}
            {starred && <Ionicons name="star" size={20} color={colors.star} />}
            {node.otherRequirements && (
              <Text style={[$nodeExtra, { color: isFocus ? fg : colors.warning }]} text="+" />
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[$nodeTitle, { color: isFocus ? colors.palette.neutral100 : colors.textDim }]}
            text={title}
          />
        </View>
        {step !== undefined && (
          <View style={themed($stepBadge)}>
            <Text weight="bold" style={$stepText} text={String(step)} />
          </View>
        )}
        {status && status.kind !== "completed" && (
          <View
            style={[
              themed($statusTag),
              status.kind === "can-take" && themed($statusOk),
              status.kind === "needs" && themed($statusWarn),
            ]}
          >
            <Text
              weight="bold"
              style={$statusText}
              text={
                status.kind === "can-take"
                  ? translate("map:tagCanTake")
                  : status.kind === "needs"
                    ? translate("map:tagNeeds", { n: status.missing })
                    : "?"
              }
            />
          </View>
        )}
        {leads > 0 && (
          <View
            style={themed($leadsBadge)}
            accessibilityLabel={translate("map:leadsBadge", { n: leads })}
          >
            <Ionicons name="arrow-forward" size={14} color={colors.palette.neutral100} />
            <Text weight="bold" style={$leadsText} text={String(leads)} />
          </View>
        )}
      </Animated.View>
    </Animated.View>
  )
})

export function Junction(props: {
  node: MapNode
  rect: Box
  dim: boolean
  options: number
  /** The group is satisfied by completed courses. */
  met: boolean
}) {
  const { node, rect, dim, options, met } = props
  const { themed } = useAppTheme()
  const $dimAnimated = useDimStyle(dim)
  return (
    <Animated.View
      entering={NODE_IN}
      exiting={NODE_OUT}
      style={[$place, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
      pointerEvents="none"
    >
      <Animated.View style={[themed($junction), met && themed($junctionMet), $dimAnimated]}>
        <Text
          weight="bold"
          style={[themed($junctionText), met && themed($junctionTextMet)]}
          text={`${translate(node.kind === "any" ? "map:oneOf" : "map:allOf", { n: options })}${met ? " ✓" : ""}`}
        />
      </Animated.View>
    </Animated.View>
  )
}

const DIMMED = 0.22

const $place: ViewStyle = { position: "absolute" }

const $node: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  flex: 1,
  flexDirection: "row",
  borderRadius: 18,
  backgroundColor: colors.surface,
  borderWidth: 1.5,
  borderColor: isDark ? colors.surfaceAlt : colors.separator,
  overflow: "visible",
  shadowColor: "#0F1C2E",
  shadowOpacity: isDark ? 0 : 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
})

const $nodeFocus: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
  shadowColor: colors.tint,
  shadowOpacity: 0.45,
  shadowRadius: 18,
})

const $nodeCompleted: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.success,
  borderWidth: 2.5,
})

const $nodeOnPath: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
  borderWidth: 3,
})

const $nodeSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.star,
  borderWidth: 4,
  shadowColor: colors.star,
  shadowOpacity: 0.5,
  shadowRadius: 16,
})

const $nodeMissing: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderStyle: "dashed",
  borderColor: colors.textDim,
  backgroundColor: colors.transparent,
})

const $stripe: ViewStyle = {
  width: 7,
  borderTopLeftRadius: 16,
  borderBottomLeftRadius: 16,
}

const $nodeBody: ViewStyle = { flex: 1, justifyContent: "center", paddingHorizontal: 14 }

const $nodeTop: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 6 }

const $nodeCode: TextStyle = { fontSize: 22, lineHeight: 30 }

const $nodeTitle: TextStyle = { fontSize: 16, lineHeight: 22 }

const $nodeExtra: TextStyle = { fontSize: 20, lineHeight: 26, fontWeight: "700" }

const $stepBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -14,
  left: -14,
  width: 30,
  height: 30,
  borderRadius: 15,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.tint,
  borderWidth: 3,
  borderColor: colors.background,
})

const $nodeCanTake: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.success,
  borderWidth: 2.5,
  borderStyle: "dashed",
})

const $statusTag: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -14,
  right: 16,
  height: 26,
  paddingHorizontal: 9,
  borderRadius: 13,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.textDim,
  borderWidth: 3,
  borderColor: colors.background,
})

const $statusOk: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.success })

const $statusWarn: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.warning })

const $statusText: TextStyle = {
  color: "#FFFFFF",
  fontSize: 12,
  lineHeight: 15,
  letterSpacing: 0.6,
}

const $junctionMet: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.success,
  backgroundColor: colors.successSoft,
})

const $junctionTextMet: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.success })

const $leadsBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  right: -18,
  top: "50%",
  marginTop: -15,
  height: 30,
  minWidth: 44,
  paddingHorizontal: 8,
  borderRadius: 15,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  backgroundColor: colors.tint,
  borderWidth: 3,
  borderColor: colors.background,
})

const $leadsText: TextStyle = { color: "#FFFFFF", fontSize: 14, lineHeight: 18 }

const $stepText: TextStyle = { color: "#FFFFFF", fontSize: 14, lineHeight: 18 }

const $junction: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  backgroundColor: colors.background,
  borderWidth: 2,
  borderColor: colors.tint,
})

const $junctionText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 13,
  lineHeight: 16,
  letterSpacing: 0.8,
})
