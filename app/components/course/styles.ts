import type { ViewStyle } from "react-native"

import type { ThemedStyle } from "@/theme/types"

/**
 * A raised card. Light mode uses a soft shadow; dark mode relies on the surface being a
 * lighter tone than the background, since shadows don't read on dark grounds.
 */
export const $card: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  backgroundColor: colors.surface,
  borderRadius: 16,
  shadowColor: colors.shadow,
  shadowOpacity: 1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: isDark ? 0 : 2,
})
