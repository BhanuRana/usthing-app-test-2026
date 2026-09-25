import { ComponentProps, ReactNode, useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Chip } from "@/components/course/Chip"
import { DeptBadge } from "@/components/course/DeptBadge"
import { LinkedCodesText } from "@/components/course/LinkedCodesText"
import { PrereqTree } from "@/components/course/PrereqTree"
import { $card } from "@/components/course/styles"
import { EmptyState } from "@/components/EmptyState"
import { Header } from "@/components/Header"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { getCourse, getCourseVersion, getIndex, getPrereqGraph } from "@/data/catalog"
import { evaluate, missingRequirements } from "@/data/prereq/evaluate"
import { prereqTreeFor, prerequisiteChain, unlockedBy } from "@/data/prereq/traverse"
import type { PrereqNode } from "@/data/types"
import { translate } from "@/i18n/translate"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useCompleted, useStarred } from "@/utils/usePreferences"

export function CourseDetailScreen({ route, navigation }: AppStackScreenProps<"CourseDetail">) {
  const { code, term: requestedTerm } = route.params
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { terms } = getIndex()
  const course = getCourse(code)
  const { starred, toggle } = useStarred()
  const { completed, toggle: toggleCompleted } = useCompleted()

  // Show the term the user was browsing if the course runs then, otherwise its newest term.
  const initialTerm =
    requestedTerm !== undefined && course?.terms.includes(requestedTerm)
      ? requestedTerm
      : course?.terms[0]
  const [term, setTerm] = useState(initialTerm)

  const version = useMemo(
    () => (course ? getCourseVersion(code, term) : undefined),
    [course, code, term],
  )
  const graph = getPrereqGraph()
  const tree = useMemo(() => prereqTreeFor(graph, code, term), [graph, code, term])
  const chainLevels = useMemo(() => {
    const levels: string[][] = []
    for (const { code: c, depth } of prerequisiteChain(graph, code, term)) {
      ;(levels[depth - 1] ??= []).push(c)
    }
    return levels
  }, [graph, code, term])
  const unlocks = useMemo(() => unlockedBy(graph, code), [graph, code])

  // push (not navigate) so following a chain of prerequisites builds a back stack.
  const openCourse = useCallback(
    (next: string) => navigation.push("CourseDetail", { code: next, term }),
    [navigation, term],
  )

  const isStarred = starred.has(code)
  const isCompleted = completed.has(code)
  const header = (
    <Header
      title={code}
      leftIcon="back"
      onLeftPress={() => navigation.goBack()}
      RightActionComponent={
        course ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate(isStarred ? "course:unstar" : "course:star")}
            accessibilityState={{ selected: isStarred }}
            onPress={() => toggle(code)}
            hitSlop={12}
            style={themed($starButton)}
          >
            <Ionicons
              name={isStarred ? "star" : "star-outline"}
              size={22}
              color={isStarred ? colors.star : colors.text}
            />
          </Pressable>
        ) : undefined
      }
      safeAreaEdges={["top"]}
    />
  )

  if (!course || !version) {
    return (
      <Screen preset="fixed" contentContainerStyle={$flex}>
        {header}
        <EmptyState heading={code} contentTx="course:notFound" style={themed($notFound)} />
      </Screen>
    )
  }

  const notOffered =
    requestedTerm !== undefined && requestedTerm !== term && !course.terms.includes(requestedTerm)

  return (
    // Header stays fixed; only the content scrolls, so Back and Star are always reachable.
    <Screen preset="fixed" contentContainerStyle={$flex}>
      {header}
      <ScrollView
        style={$flex}
        contentContainerStyle={themed($content)}
        testID="course-detail-scroll"
      >
        <View style={themed([$card, $hero])}>
          <View style={$heroTop}>
            <DeptBadge prefix={course.prefix} size={52} />
            <Text preset="subheading" style={$flex} text={version.title} />
          </View>
          <View style={$wrap}>
            <InfoPill
              icon="ribbon-outline"
              text={translate("course:credits", { credits: version.credits })}
            />
            <InfoPill
              icon="school-outline"
              text={translate(
                course.career === "UG" ? "course:undergraduate" : "course:postgraduate",
              )}
            />
            <InfoPill icon="business-outline" text={course.prefix} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ checked: isCompleted }}
            onPress={() => toggleCompleted(code)}
            testID="toggle-completed"
            style={({ pressed }) => [
              themed($completeButton),
              isCompleted && themed($completeButtonDone),
              pressed && $pressed,
            ]}
          >
            <Ionicons
              name={isCompleted ? "checkmark-circle" : "add-circle-outline"}
              size={20}
              color={isCompleted ? colors.success : colors.tint}
            />
            <Text
              weight="semiBold"
              size="xs"
              style={{ color: isCompleted ? colors.success : colors.tint }}
              tx={isCompleted ? "course:completed" : "course:markCompleted"}
            />
          </Pressable>
        </View>

        <Section icon="calendar-outline" title={translate("course:offeredIn")}>
          <View style={$wrap}>
            {terms.map((t, i) => {
              const offered = course.terms.includes(i)
              return (
                <Chip
                  key={t.code}
                  label={t.name}
                  selected={term === i}
                  muted={!offered}
                  disabled={!offered}
                  onPress={() => setTerm(i)}
                />
              )
            })}
          </View>
          {notOffered && (
            <Text
              size="xxs"
              style={themed($dim)}
              text={translate("course:notOfferedIn", {
                term: terms[requestedTerm].name,
                shown: terms[term!].name,
              })}
            />
          )}
        </Section>

        <Section icon="git-network-outline" title={translate("course:prerequisites")}>
          {tree ? (
            <>
              {!isCompleted && <Eligibility tree={tree} completed={completed} />}
              <PrereqTree
                node={tree}
                rootCode={code}
                completed={completed}
                onOpenCourse={openCourse}
              />
              <View style={themed($raw)}>
                <Text size="xxs" weight="bold" style={themed($dim)} tx="course:asWritten" />
                <LinkedCodesText text={version.prerequisite} onPressCode={openCourse} />
              </View>
            </>
          ) : (
            <Text size="xs" style={themed($dim)} tx="course:noPrerequisites" />
          )}
        </Section>

        {chainLevels.length > 0 && (
          <Section
            icon="layers-outline"
            title={translate("course:fullChain")}
            subtitle={translate("course:fullChainSummary", {
              count: chainLevels.flat().length,
              levels: chainLevels.length,
            })}
          >
            {chainLevels.map((level, i) => (
              <View key={i} style={themed($level)}>
                <Text
                  size="xxs"
                  weight="bold"
                  style={themed($levelLabel)}
                  text={translate("course:level", { level: i + 1 })}
                />
                <View style={[$wrap, $flex]}>
                  {level.map((c) => (
                    <CodeChip key={c} code={c} done={completed.has(c)} onPress={openCourse} />
                  ))}
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section
          icon="arrow-redo-outline"
          title={translate("course:unlocks")}
          subtitle={unlocks.length ? translate("course:unlocksHint", { code }) : undefined}
        >
          {unlocks.length ? (
            <View style={$wrap}>
              {unlocks.map((c) => (
                <CodeChip key={c} code={c} done={completed.has(c)} onPress={openCourse} />
              ))}
            </View>
          ) : (
            <Text size="xs" style={themed($dim)} text={translate("course:unlocksNone", { code })} />
          )}
        </Section>

        {!!version.description && (
          <Section icon="document-text-outline" title={translate("course:description")}>
            <Text size="xs" text={version.description} />
          </Section>
        )}

        {(
          [
            ["course:corequisite", version.corequisite],
            ["course:exclusion", version.exclusion],
            ["course:colist", version.colist],
            ["course:previous", version.previous],
          ] as const
        ).map(
          ([label, value]) =>
            !!value && (
              <Section key={label} icon="information-circle-outline" title={translate(label)}>
                <LinkedCodesText text={value} onPressCode={openCourse} />
              </Section>
            ),
        )}

        {version.attributes.length > 0 && (
          <Section icon="pricetag-outline" title={translate("course:attributes")}>
            {version.attributes.map((a) => (
              <Text key={a.label} size="xs" text={`• ${a.description}`} />
            ))}
          </Section>
        )}

        {version.cilos.length > 0 && (
          <Section icon="bulb-outline" title={translate("course:cilos")}>
            {version.cilos.map((c, i) => (
              <Text key={i} size="xs" style={$cilo} text={`${i + 1}. ${c}`} />
            ))}
          </Section>
        )}
      </ScrollView>
    </Screen>
  )
}

type IconName = ComponentProps<typeof Ionicons>["name"]

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: IconName
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View style={themed([$card, $section])}>
      <View style={$sectionHeader}>
        <View style={themed($sectionIcon)}>
          <Ionicons name={icon} size={15} color={colors.tint} />
        </View>
        <View style={$flex}>
          <Text weight="bold" size="sm" text={title} />
          {subtitle && <Text size="xxs" style={themed($dim)} text={subtitle} />}
        </View>
      </View>
      <View style={$sectionBody}>{children}</View>
    </View>
  )
}

function InfoPill({ icon, text }: { icon: IconName; text: string }) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View style={themed($infoPill)}>
      <Ionicons name={icon} size={13} color={colors.textDim} />
      <Text size="xxs" weight="medium" style={themed($dim)} text={text} />
    </View>
  )
}

/**
 * Whether the user can take the course, from their completed courses. Evaluates only this
 * course's direct prerequisites (see evaluate.ts), so it is cheap to run on every render.
 */
function Eligibility({ tree, completed }: { tree: PrereqNode; completed: ReadonlySet<string> }) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  if (completed.size === 0) {
    return <Text size="xs" style={themed($dim)} tx="course:eligibleHint" />
  }
  const status = evaluate(tree, completed)
  const icon =
    status === "met" ? "checkmark-circle" : status === "unmet" ? "alert-circle" : "help-circle"
  const tone =
    status === "met"
      ? { fg: colors.success, bg: colors.successSoft }
      : status === "unmet"
        ? { fg: colors.warning, bg: colors.warningSoft }
        : { fg: colors.textDim, bg: colors.surfaceAlt }
  const message =
    status === "met"
      ? translate("course:eligibleMet")
      : status === "unmet"
        ? translate("course:eligibleUnmet", {
            items: missingRequirements(tree, completed).join(", "),
          })
        : translate("course:eligibleUnknown")

  return (
    <View
      style={[themed($eligibility), { backgroundColor: tone.bg }]}
      accessibilityRole="summary"
      testID={`eligibility-${status}`}
    >
      <Ionicons name={icon} size={20} color={tone.fg} />
      <Text size="xs" weight="medium" style={$flex} text={message} />
    </View>
  )
}

/** A course code that opens its detail page; `done` highlights courses the user completed. */
function CodeChip({
  code,
  done,
  onPress,
}: {
  code: string
  done?: boolean
  onPress: (code: string) => void
}) {
  const {
    theme: { colors },
  } = useAppTheme()
  const course = getCourse(code)
  return (
    <Chip
      label={code}
      selected={done}
      style={done ? { backgroundColor: colors.success, borderColor: colors.success } : undefined}
      icon={done ? "checkmark" : undefined}
      muted={!course}
      disabled={!course}
      accessibilityLabel={[code, course?.title, done && translate("prereq:completed")]
        .filter(Boolean)
        .join(", ")}
      onPress={() => onPress(code)}
    />
  )
}

const $flex: ViewStyle = { flex: 1 }

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingBottom: spacing.xxl })

const $starButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingHorizontal: spacing.md })

const $hero: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginHorizontal: spacing.md,
  marginTop: spacing.xs,
  padding: spacing.md,
  gap: spacing.sm,
})

const $heroTop: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 14 }

const $infoPill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingHorizontal: spacing.xs,
  paddingVertical: 3,
  borderRadius: 8,
  backgroundColor: colors.surfaceAlt,
})

const $completeButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 44,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: colors.tint,
})

const $completeButtonDone: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.transparent,
  backgroundColor: colors.successSoft,
})

const $pressed: ViewStyle = { opacity: 0.7 }

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  marginHorizontal: spacing.md,
  padding: spacing.md,
})

const $sectionHeader: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 10 }

const $sectionIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.tintSoft,
})

const $sectionBody: ViewStyle = { marginTop: 12, gap: 6 }

const $wrap: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 6 }

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $raw: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.sm,
  padding: spacing.sm,
  borderRadius: 8,
  backgroundColor: colors.surfaceAlt,
  gap: 2,
})

const $level: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  alignItems: "flex-start",
})

const $levelLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  width: 52,
  paddingTop: 6,
})

const $cilo: TextStyle = { marginBottom: 2 }

const $eligibility: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  padding: spacing.sm,
  borderRadius: 12,
  marginBottom: spacing.xs,
})

const $notFound: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingTop: spacing.xxl })
