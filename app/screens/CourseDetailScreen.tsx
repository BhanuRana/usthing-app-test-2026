import { ReactNode, useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Chip } from "@/components/course/Chip"
import { LinkedCodesText } from "@/components/course/LinkedCodesText"
import { PrereqTree } from "@/components/course/PrereqTree"
import { EmptyState } from "@/components/EmptyState"
import { Header } from "@/components/Header"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { getCourse, getCourseVersion, getIndex, getPrereqGraph } from "@/data/catalog"
import { prereqTreeFor, prerequisiteChain, unlockedBy } from "@/data/prereq/traverse"
import { translate } from "@/i18n/translate"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useStarred } from "@/utils/usePreferences"

export function CourseDetailScreen({ route, navigation }: AppStackScreenProps<"CourseDetail">) {
  const { code, term: requestedTerm } = route.params
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { terms } = getIndex()
  const course = getCourse(code)
  const { starred, toggle } = useStarred()

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
              color={isStarred ? colors.tint : colors.text}
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
        <View style={themed($titleBlock)}>
          <Text preset="subheading" text={version.title} />
          <Text
            size="xs"
            style={themed($dim)}
            text={`${version.credits} credits · ${course.career === "UG" ? "Undergraduate" : "Postgraduate"} · ${course.prefix}`}
          />
        </View>

        <Section title={translate("course:offeredIn")}>
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

        <Section title={translate("course:prerequisites")}>
          {tree ? (
            <>
              <PrereqTree node={tree} rootCode={code} onOpenCourse={openCourse} />
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
                    <CodeChip key={c} code={c} onPress={openCourse} />
                  ))}
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section
          title={translate("course:unlocks")}
          subtitle={unlocks.length ? translate("course:unlocksHint", { code }) : undefined}
        >
          {unlocks.length ? (
            <View style={$wrap}>
              {unlocks.map((c) => (
                <CodeChip key={c} code={c} onPress={openCourse} />
              ))}
            </View>
          ) : (
            <Text size="xs" style={themed($dim)} text={translate("course:unlocksNone", { code })} />
          )}
        </Section>

        {!!version.description && (
          <Section title={translate("course:description")}>
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
              <Section key={label} title={translate(label)}>
                <LinkedCodesText text={value} onPressCode={openCourse} />
              </Section>
            ),
        )}

        {version.attributes.length > 0 && (
          <Section title={translate("course:attributes")}>
            {version.attributes.map((a) => (
              <Text key={a.label} size="xs" text={`• ${a.description}`} />
            ))}
          </Section>
        )}

        {version.cilos.length > 0 && (
          <Section title={translate("course:cilos")}>
            {version.cilos.map((c, i) => (
              <Text key={i} size="xs" style={$cilo} text={`${i + 1}. ${c}`} />
            ))}
          </Section>
        )}
      </ScrollView>
    </Screen>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($section)}>
      <Text weight="bold" size="sm" text={title} />
      {subtitle && <Text size="xxs" style={themed($dim)} text={subtitle} />}
      <View style={$sectionBody}>{children}</View>
    </View>
  )
}

/** A course code that opens its detail page; shows the title on the chip for context. */
function CodeChip({ code, onPress }: { code: string; onPress: (code: string) => void }) {
  const course = getCourse(code)
  return (
    <Chip
      label={code}
      muted={!course}
      disabled={!course}
      accessibilityLabel={course ? `${code}, ${course.title}` : code}
      onPress={() => onPress(code)}
    />
  )
}

const $flex: ViewStyle = { flex: 1 }

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingBottom: spacing.xxl })

const $starButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingHorizontal: spacing.md })

const $titleBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  gap: spacing.xxs,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  marginTop: spacing.lg,
  marginHorizontal: spacing.md,
  paddingTop: spacing.md,
  borderTopWidth: 1,
  borderTopColor: colors.separator,
})

const $sectionBody: ViewStyle = { marginTop: 8, gap: 6 }

const $wrap: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 6 }

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $raw: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.sm,
  padding: spacing.sm,
  borderRadius: 8,
  backgroundColor: colors.palette.neutral300,
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

const $notFound: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingTop: spacing.xxl })
