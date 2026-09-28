/** The map key: what the colours, tags and lines mean. */
import { TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function MapKey({ showPath }: { showPath: boolean }) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View style={themed($legend)}>
      <Text size="xxs" style={[themed($dim), $legendHint]} tx="map:hint" />
      <View style={$legendRow}>
        <LegendItem
          swatch={<View style={[$swatchBox, { backgroundColor: colors.tint }]} />}
          tx="map:legendCourse"
        />
        <LegendItem
          swatch={<Ionicons name="checkmark-circle" size={14} color={colors.success} />}
          tx="map:legendCompleted"
        />
        <LegendItem
          swatch={<View style={[$swatchPill, { backgroundColor: colors.success }]} />}
          tx="map:legendCanTake"
        />
        <LegendItem
          swatch={<View style={[$swatchPill, { backgroundColor: colors.warning }]} />}
          tx="map:legendNeeds"
        />
        <LegendItem
          swatch={<Ionicons name="star" size={13} color={colors.star} />}
          tx="map:legendStarred"
        />
        {showPath && (
          <LegendItem
            swatch={<View style={[$swatchLine, { backgroundColor: colors.tint }]} />}
            tx="map:legendPath"
          />
        )}
        <LegendItem
          swatch={<View style={[$swatchLine, $swatchDashed, { borderColor: colors.warning }]} />}
          tx="map:legendLoop"
        />
      </View>
    </View>
  )
}

function LegendItem({ swatch, tx }: { swatch: React.ReactNode; tx: `map:${string}` }) {
  const { themed } = useAppTheme()
  return (
    <View style={$legendItem}>
      {swatch}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Text size="xxs" style={themed($dim)} tx={tx as any} />
    </View>
  )
}

const $legend: ThemedStyle<ViewStyle> = ({ colors, isDark, spacing }) => ({
  alignSelf: "stretch",
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  gap: 6,
  borderRadius: 16,
  backgroundColor: isDark ? colors.surfaceAlt : colors.surface,
  shadowColor: "#0F1C2E",
  shadowOpacity: isDark ? 0 : 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
})

const $legendHint: TextStyle = { textAlign: "center" }

const $legendRow: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  columnGap: 12,
  rowGap: 4,
}

const $legendItem: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4 }

const $swatchPill: ViewStyle = { width: 16, height: 9, borderRadius: 5 }

const $swatchBox: ViewStyle = { width: 12, height: 12, borderRadius: 4 }

const $swatchLine: ViewStyle = { width: 18, height: 3, borderRadius: 2 }

const $swatchDashed: ViewStyle = {
  height: 0,
  borderTopWidth: 2,
  borderStyle: "dashed",
  backgroundColor: "transparent",
}

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
