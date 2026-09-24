import { ComponentProps } from "react"
import { Pressable, PressableProps, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface ChipProps extends Omit<PressableProps, "children"> {
  label: string
  selected?: boolean
  /** Trailing icon, e.g. a chevron for chips that open a picker. */
  icon?: ComponentProps<typeof Ionicons>["name"]
  /** Non-interactive, dimmed styling (e.g. a term the course isn't offered in). */
  muted?: boolean
}

/** A small rounded toggle used for filters and term selection. */
export function Chip({ label, selected, icon, muted, style, ...rest }: ChipProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const color = selected ? colors.palette.neutral100 : muted ? colors.textDim : colors.text

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!rest.disabled }}
      hitSlop={4}
      style={(state) => [
        themed($chip),
        selected && themed($chipSelected),
        muted && themed($chipMuted),
        state.pressed && { opacity: 0.7 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <View style={$row}>
        <Text size="xs" weight="medium" style={[themed($label), { color }]} text={label} />
        {icon && <Ionicons name={icon} size={14} color={color} />}
      </View>
    </Pressable>
  )
}

const $row: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4 }

const $chip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs + 2,
  backgroundColor: colors.background,
})

const $chipSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
})

const $chipMuted: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderStyle: "dashed",
  borderColor: colors.separator,
})

const $label: ThemedStyle<TextStyle> = () => ({ lineHeight: 18 })
