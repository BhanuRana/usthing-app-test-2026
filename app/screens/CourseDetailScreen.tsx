import { ComponentProps, ReactNode, useCallback, useMemo, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Chip } from "@/components/course/Chip"
import { CoursePathView } from "@/components/course/CoursePathView"
import { HeroButton, HeroHeader, HeroPill } from "@/components/course/HeroHeader"
import { LinkedCodesText } from "@/components/course/LinkedCodesText"
import { PrereqTree } from "@/components/course/PrereqTree"
import { StarPrompt } from "@/components/course/StarPrompt"
import { $card } from "@/components/course/styles"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { getCourse, getCourseVersion, getIndex, getPrereqGraph } from "@/data/catalog"
import { evaluate, missingGroups, missingRequirements } from "@/data/prereq/evaluate"
import { planPath } from "@/data/prereq/plan"
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
  const { starred, toggle, add: addStarred } = useStarred()
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
  // Recomputed as courses are completed or starred: stars steer its "one of" choices.
  const path = useMemo(
    () => planPath(graph, code, completed, starred, term),
    [graph, code, completed, starred, term],
  )

  // push (not navigate) so following a chain of prerequisites builds a back stack.
  const openCourse = useCallback(
    (next: string) => navigation.push("CourseDetail", { code: next, term }),
    [navigation, term],
  )

  const isStarred = starred.has(code)
  const isCompleted = completed.has(code)

  // Starring a course you can't take yet asks whether to star its missing prerequisites too.
  // Unstarring, met or only-unverifiable prerequisites, and completed courses skip the prompt.
  const [starPromptOpen, setStarPromptOpen] = useState(false)
  const missing = useMemo(
    () => (tree && !isCompleted ? missingGroups(tree, completed) : []),
    [tree, completed, isCompleted],
  )
  const onStarPress = () => {
    if (!isStarred && missing.length > 0) setStarPromptOpen(true)
    else toggle(code)
  }

  // The code fades into the fixed bar once the big one in the band has scrolled under it.
  const { top } = useSafeAreaInsets()
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })
  const $barTitleAnimated = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [30, 70], [0, 1], "clamp"),
  }))

  const header = (
    <View style={[themed($bar), { paddingTop: top }]}>
      <HeroButton
        icon="chevron-back"
        accessibilityLabel={translate("common:back")}
        onPress={() => navigation.goBack()}
      />
      <Animated.View style={[$barTitle, course ? $barTitleAnimated : undefined]}>
        <Text weight="semiBold" style={themed($barTitleText)} text={code} numberOfLines={1} />
      </Animated.View>
      {course ? (
        <HeroButton
          icon={isStarred ? "star" : "star-outline"}
          iconColor={isStarred ? colors.heroAccent : undefined}
          accessibilityLabel={translate(isStarred ? "course:unstar" : "course:star")}
          accessibilityState={{ selected: isStarred }}
          onPress={onStarPress}
        />
      ) : (
        <View style={$barSpacer} />
      )}
    </View>
  )

  if (!course || !version) {
    return (
      <Screen preset="fixed" systemBarStyle="light" contentContainerStyle={$flex}>
        {header}
        <EmptyState heading={code} contentTx="course:notFound" style={themed($notFound)} />
      </Screen>
    )
  }

  const notOffered =
    requestedTerm !== undefined && requestedTerm !== term && !course.terms.includes(requestedTerm)

  return (
    // The bar stays fixed; only the content scrolls, so Back and Star are always reachable.
    <Screen preset="fixed" systemBarStyle="light" contentContainerStyle={$flex}>
      {header}
      <Animated.ScrollView
        style={$flex}
        contentContainerStyle={themed($content)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID="course-detail-scroll"
      >
        <HeroHeader
          safeTop={false}
          overscroll
          node={false}
          eyebrow={course.prefix}
          title={code}
          style={themed($band)}
        >
          <Text size="md" weight="medium" style={themed($courseTitle)} text={version.title} />
          <View style={$wrap}>
            <HeroPill
              icon="ribbon-outline"
              text={translate("course:credits", { credits: version.credits })}
            />
            <HeroPill
              icon="school-outline"
              text={translate(
                course.career === "UG" ? "course:undergraduate" : "course:postgraduate",
              )}
            />
            <HeroPill icon="calendar-outline" text={term === undefined ? "" : terms[term].name} />
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
              color={isCompleted ? colors.heroSuccess : colors.hero}
            />
            <Text
              weight="semiBold"
              size="xs"
              style={{ color: isCompleted ? colors.onHero : colors.hero }}
              tx={isCompleted ? "course:completed" : "course:markCompleted"}
            />
          </Pressable>
        </HeroHeader>

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

        {path && (
          <Section
            icon="trail-sign-outline"
            title={translate("path:title")}
            subtitle={`${translate("path:courses", {
              count: path.steps.flat().length,
              n: path.steps.flat().length,
            })} · ${translate("path:steps", { count: path.steps.length, n: path.steps.length })}`}
          >
            <CoursePathView
              path={path}
              target={code}
              starred={starred}
              hasCompleted={completed.size > 0}
              onOpenCourse={openCourse}
              onStarAll={addStarred}
            />
          </Section>
        )}

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
      </Animated.ScrollView>

      <StarPrompt
        visible={starPromptOpen}
        code={code}
        groups={missing}
        starred={starred}
        onConfirm={addStarred}
        onClose={() => setStarPromptOpen(false)}
      />
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

const $bar: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xs,
  backgroundColor: colors.hero,
  zIndex: 1,
})

const $barTitle: ViewStyle = { flex: 1, alignItems: "center" }

const $barTitleText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.onHero })

const $barSpacer: ViewStyle = { width: 44 }

const $band: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xxs,
  paddingBottom: spacing.lg,
  gap: spacing.sm,
})

const $courseTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.onHero,
  marginTop: -4,
})

const $completeButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 46,
  marginTop: spacing.xxs,
  borderRadius: 14,
  backgroundColor: colors.onHero,
})

const $completeButtonDone: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.heroRaised,
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
