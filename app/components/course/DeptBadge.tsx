import { TextStyle, View, ViewStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { departmentColor } from "@/theme/departmentColors"

interface DeptBadgeProps {
  prefix: string
  /** Side length in points. */
  size?: number
}

/** A rounded square in the department's colour, showing its prefix. Decorative for screen readers. */
export function DeptBadge({ prefix, size = 44 }: DeptBadgeProps) {
  const { theme } = useAppTheme()
  const { fg, bg } = departmentColor(prefix, theme.isDark)

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        $badge,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg },
      ]}
    >
      <Text
        weight="bold"
        maxFontSizeMultiplier={1}
        style={[$label, { color: fg, fontSize: size * 0.25, lineHeight: size * 0.32 }]}
        text={prefix}
      />
    </View>
  )
}

const $badge: ViewStyle = { alignItems: "center", justifyContent: "center" }

const $label: TextStyle = { letterSpacing: 0.3 }
