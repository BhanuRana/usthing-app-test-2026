import { useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { getCourse, getPrereqGraph } from "@/data/catalog"
import { evaluate } from "@/data/prereq/evaluate"
import { expansionState, prereqTreeFor } from "@/data/prereq/traverse"
import type { PrereqNode } from "@/data/types"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface PrereqTreeProps {
  /** Parsed prerequisites of the course being viewed. */
  node: PrereqNode
  /** The course being viewed; the first ancestor on every branch. */
  rootCode: string
  /** Courses the user has completed: shown ticked, and satisfied groups are marked "met". */
  completed: ReadonlySet<string>
  onOpenCourse: (code: string) => void
}

/**
 * Expandable prerequisite tree. The root's direct prerequisites are shown; each course can be
 * expanded to reveal its own, one level at a time, so rendering cost follows what the user
 * opens rather than the size of the whole graph (the deepest chain is 9 levels).
 */
export function PrereqTree({ node, rootCode, completed, onOpenCourse }: PrereqTreeProps) {
  return (
    <NodeView
      node={node}
      ancestors={[rootCode]}
      completed={completed}
      onOpenCourse={onOpenCourse}
    />
  )
}

interface NodeViewProps {
  node: PrereqNode
  /** Course codes from the root down to this node's parent course. */
  ancestors: string[]
  completed: ReadonlySet<string>
  onOpenCourse: (code: string) => void
}

function NodeView({ node, ancestors, completed, onOpenCourse }: NodeViewProps) {
  const { themed } = useAppTheme()

  switch (node.kind) {
    case "course":
      return (
        <CourseNode
          code={node.code}
          note={node.note}
          ancestors={ancestors}
          completed={completed}
          onOpenCourse={onOpenCourse}
        />
      )
    case "text":
      return <Text size="xs" style={themed($textNode)} text={node.text} />
    default: {
      const label = translate(node.kind === "all" ? "prereq:allOf" : "prereq:oneOf").toUpperCase()
      const met = completed.size > 0 && evaluate(node, completed) === "met"
      return (
        <View>
          <Text
            size="xxs"
            weight="bold"
            style={[themed($groupLabel), met && themed($metText)]}
            text={met ? `${label} · ${translate("prereq:groupMet").toUpperCase()} ✓` : label}
          />
          <View style={themed($group)}>
            {node.children.map((child, i) => (
              <NodeView
                key={i}
                node={child}
                ancestors={ancestors}
                completed={completed}
                onOpenCourse={onOpenCourse}
              />
            ))}
          </View>
        </View>
      )
    }
  }
}

interface CourseNodeProps {
  code: string
  note?: string
  ancestors: string[]
  completed: ReadonlySet<string>
  onOpenCourse: (code: string) => void
}

function CourseNode({ code, note, ancestors, completed, onOpenCourse }: CourseNodeProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const [expanded, setExpanded] = useState(false)

  const graph = getPrereqGraph()
  const course = getCourse(code)
  const state = course ? expansionState(graph, code, ancestors) : "missing"
  const canExpand = state === "expandable"
  // Deeper levels use each course's newest version; only the viewed course is term-specific.
  const children = expanded && canExpand ? prereqTreeFor(graph, code) : null

  const isCompleted = completed.has(code)
  const toggleLabel = translate(expanded ? "prereq:collapse" : "prereq:expand", { code })

  return (
    <View>
      <View style={$courseRow}>
        {canExpand ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((e) => !e)}
            hitSlop={10}
            style={themed($toggle)}
          >
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={16}
              color={colors.tint}
            />
          </Pressable>
        ) : (
          <View style={themed($toggle)}>
            <Ionicons
              name={state === "cycle" ? "repeat" : "ellipse"}
              size={state === "cycle" ? 14 : 6}
              color={colors.textDim}
            />
          </View>
        )}

        <Pressable
          accessibilityRole={course ? "link" : "text"}
          accessibilityLabel={[
            code,
            course?.title,
            isCompleted ? translate("prereq:completed") : undefined,
            note,
            state !== "expandable" ? badgeText(state) : undefined,
          ]
            .filter(Boolean)
            .join(", ")}
          disabled={!course}
          onPress={() => onOpenCourse(code)}
          style={({ pressed }) => [$courseText, pressed && { opacity: 0.6 }]}
        >
          <Text size="xs">
            <Text
              size="xs"
              weight="bold"
              style={course ? themed($code) : themed($missingCode)}
              text={code}
            />
            {course && <Text size="xs" style={themed($dim)} text={`  ${course.title}`} />}
          </Text>
          {isCompleted && (
            <View style={$completedRow}>
              <Ionicons name="checkmark-circle" size={13} color={colors.tint} />
              <Text size="xxs" style={themed($metText)} tx="prereq:completed" />
            </View>
          )}
          {note && <Text size="xxs" style={themed($note)} text={note} />}
          {state !== "expandable" && (
            <Text size="xxs" style={themed($badge)} text={badgeText(state)} />
          )}
        </Pressable>
      </View>

      {children && (
        <View style={themed($nested)}>
          <NodeView
            node={children}
            ancestors={[...ancestors, code]}
            completed={completed}
            onOpenCourse={onOpenCourse}
          />
        </View>
      )}
    </View>
  )
}

function badgeText(state: "none" | "cycle" | "missing"): string {
  if (state === "cycle") return translate("prereq:cycle")
  if (state === "missing") return translate("prereq:notInCatalogue")
  return translate("prereq:noneBelow")
}

const $courseRow: ViewStyle = { flexDirection: "row", alignItems: "flex-start", paddingVertical: 4 }

const $toggle: ThemedStyle<ViewStyle> = () => ({
  width: 24,
  height: 22,
  alignItems: "center",
  justifyContent: "center",
})

const $courseText: ViewStyle = { flex: 1 }

const $completedRow: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4 }

const $metText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint })

const $code: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint })

const $missingCode: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $note: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontStyle: "italic",
})

const $badge: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim, opacity: 0.8 })

const $textNode: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  fontStyle: "italic",
  paddingVertical: 4,
  paddingLeft: spacing.xs,
})

const $groupLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  letterSpacing: 0.8,
  marginTop: 4,
})

const $group: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderLeftWidth: 2,
  borderLeftColor: colors.separator,
  paddingLeft: spacing.xs,
  marginLeft: 4,
})

const $nested: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginLeft: 11,
  paddingLeft: spacing.sm,
  borderLeftWidth: 1,
  borderLeftColor: colors.border,
})
