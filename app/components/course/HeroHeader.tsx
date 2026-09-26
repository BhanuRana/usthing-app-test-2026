import { ComponentProps, ReactNode } from "react"
import { Pressable, PressableProps, StyleProp, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type IconName = ComponentProps<typeof Ionicons>["name"]

interface HeroHeaderProps {
  /** Small gold label above the title. */
  eyebrow?: string
  title?: string
  subtitle?: string
  /** Sits at the right of the title block, e.g. a round button. */
  right?: ReactNode
  /** Content under the title, still on the band (search field, pills, buttons). */
  children?: ReactNode
  /** Pad for the status bar. Off when a fixed bar above already does. */
  safeTop?: boolean
  /**
   * Paint navy far above the band, so pulling a scroll view down past the top shows more
   * band instead of the page background.
   */
  overscroll?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * The navy band at the top of each screen. The faint rings and gold node echo the app icon.
 */
export function HeroHeader(props: HeroHeaderProps) {
  const { eyebrow, title, subtitle, right, children, safeTop = true, overscroll, style } = props
  const { themed } = useAppTheme()
  const { top } = useSafeAreaInsets()

  return (
    <View style={[themed($band), safeTop && { paddingTop: top + 10 }, style]}>
      {overscroll && <View style={themed($overscroll)} />}
      <HeroDecor />
      {(title || right) && (
        <View style={$titleRow}>
          <View style={$flex}>
            {eyebrow && (
              <Text size="xxs" weight="semiBold" style={themed($eyebrow)} text={eyebrow} />
            )}
            {title && <Text preset="heading" size="xl" style={themed($title)} text={title} />}
            {subtitle && <Text size="xs" style={themed($subtitle)} text={subtitle} />}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  )
}

/** Concentric rings with a gold node, clipped to the band's rounded corners. */
function HeroDecor() {
  const { themed } = useAppTheme()
  return (
    <View style={$decorClip} pointerEvents="none">
      <View style={themed([$ring, $ringOuter])} />
      <View style={themed([$ring, $ringInner])} />
      <View style={themed($node)} />
    </View>
  )
}

interface HeroButtonProps extends Omit<PressableProps, "children" | "style"> {
  icon: IconName
  /** Filled white with a navy icon, for a button whose state is "on". */
  active?: boolean
  iconColor?: string
  /** A small gold count in the corner. */
  badge?: number
}

/** A round translucent button for the band. */
export function HeroButton({ icon, active, iconColor, badge, ...rest }: HeroButtonProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        themed($button),
        active && themed($buttonActive),
        pressed && $pressed,
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={21} color={iconColor ?? (active ? colors.hero : colors.onHero)} />
      {!!badge && (
        <View style={themed($badge)}>
          <Text size="xxs" weight="bold" style={themed($badgeText)} text={String(badge)} />
        </View>
      )}
    </Pressable>
  )
}

/** A translucent info pill for the band. */
export function HeroPill({ icon, text }: { icon: IconName; text: string }) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View style={themed($pill)}>
      <Ionicons name={icon} size={13} color={colors.onHeroDim} />
      <Text size="xxs" weight="medium" style={themed($pillText)} text={text} />
    </View>
  )
}

const $flex: ViewStyle = { flex: 1 }
const $pressed: ViewStyle = { opacity: 0.7 }

const $band: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.hero,
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.md,
  gap: spacing.md,
  borderBottomLeftRadius: 28,
  borderBottomRightRadius: 28,
})

const $overscroll: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  left: 0,
  right: 0,
  top: -1000,
  height: 1000,
  backgroundColor: colors.hero,
})

const $decorClip: ViewStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden",
  borderBottomLeftRadius: 28,
  borderBottomRightRadius: 28,
}

const $ring: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  borderWidth: 1.5,
  borderColor: colors.heroLine,
  borderRadius: 999,
})

const $ringOuter: ViewStyle = { width: 260, height: 260, top: -110, right: -90 }
const $ringInner: ViewStyle = { width: 150, height: 150, top: -55, right: -35 }

// Sits on the outer ring, down and left of its centre.
const $node: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  width: 9,
  height: 9,
  borderRadius: 5,
  top: 110,
  right: 125,
  backgroundColor: colors.heroAccent,
  opacity: 0.9,
})

const $titleRow: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12 }

const $eyebrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.heroAccent,
  textTransform: "uppercase",
  letterSpacing: 1.2,
})

const $title: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.onHero })

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.onHeroDim })

const $button: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.heroRaised,
})

const $buttonActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.onHero,
})

const $badge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -3,
  right: -3,
  minWidth: 19,
  height: 19,
  paddingHorizontal: 4,
  borderRadius: 10,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.heroAccent,
  borderWidth: 2,
  borderColor: colors.hero,
})

const $badgeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.hero,
  fontSize: 10,
  lineHeight: 12,
})

const $pill: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingHorizontal: 9,
  paddingVertical: 4,
  borderRadius: 10,
  backgroundColor: colors.heroRaised,
})

const $pillText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.onHero })
