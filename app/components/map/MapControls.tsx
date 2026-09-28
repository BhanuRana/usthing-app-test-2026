import { Pressable, ScrollView, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface MapControlsProps {
  /** There's a "Your path" to highlight. */
  hasPath: boolean
  showPath: boolean
  onTogglePath: () => void
  /** The explored route (the course, then each expanded one); empty when nothing's expanded. */
  route: string[]
  /** Go back to the course at this index of the route. */
  onRoute: (index: number) => void
}

/**
 * The map's top row: the "My path" switch and the explored route as a breadcrumb, on the
 * same centre line as the zoom buttons.
 */
export function MapControls(props: MapControlsProps) {
  const { hasPath, showPath, onTogglePath, route, onRoute } = props
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View style={$controls} pointerEvents="box-none">
      {hasPath && (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: showPath }}
          testID="map-path-toggle"
          onPress={onTogglePath}
          style={[themed($pathToggle), showPath && themed($pathToggleOn)]}
        >
          <Ionicons
            name="trail-sign-outline"
            size={14}
            color={showPath ? colors.palette.neutral100 : colors.tint}
          />
          <Text
            size="xxs"
            weight="semiBold"
            style={{ color: showPath ? colors.palette.neutral100 : colors.tint }}
            tx="map:myPath"
          />
        </Pressable>
      )}
      {route.length > 0 && (
        <ScrollView
          horizontal
          style={$crumbScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={themed($crumbs)}
          accessibilityLabel={translate("map:trail")}
        >
          {route.map((id, i) => (
            <View key={id} style={$crumbItem}>
              {i > 0 && <Ionicons name="chevron-forward" size={12} color={colors.textDim} />}
              <Pressable
                accessibilityRole="button"
                testID={`map-crumb-${id}`}
                onPress={() => onRoute(i)}
                hitSlop={6}
                style={({ pressed }) => [
                  themed($crumb),
                  i === route.length - 1 && themed($crumbLast),
                  pressed && $pressed,
                ]}
              >
                <Text
                  size="xxs"
                  weight="semiBold"
                  style={{
                    color: i === route.length - 1 ? colors.palette.neutral100 : colors.tint,
                  }}
                  text={id}
                />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const $pressed: ViewStyle = { opacity: 0.75 }

// Top-left: the "My path" switch; below it, the explored route; top-right: fit and zoom.
const $controls: ViewStyle = {
  position: "absolute",
  top: 12,
  left: 12,
  right: 64,
  height: 42, // the zoom buttons' height, so everything in the top row shares one centre line
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
}

const $crumbScroll: ViewStyle = { flexGrow: 0, flexShrink: 1 }

const $pathToggle: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 14,
  borderWidth: 1.5,
  borderColor: colors.tint,
  backgroundColor: isDark ? colors.surfaceAlt : colors.surface,
})

const $pathToggleOn: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.tint })

const $crumbs: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  gap: 4,
})

const $crumbItem: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4 }

const $crumb: ThemedStyle<ViewStyle> = ({ colors }) => ({
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 12,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.tint,
})

const $crumbLast: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.tint })
