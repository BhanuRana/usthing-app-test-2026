import { TextStyle, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { translate } from "@/i18n/translate"
import { ExploreScreen } from "@/screens/ExploreScreen"
import { StarredScreen } from "@/screens/StarredScreen"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import type { TabParamList } from "./navigationTypes"

const Tab = createBottomTabNavigator<TabParamList>()

export function TabNavigator() {
  const { bottom } = useSafeAreaInsets()
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: themed([$tabBar, { height: bottom + 60 }]),
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: themed($tabBarLabel),
        tabBarItemStyle: themed($tabBarItem),
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarLabel: translate("tabs:explore"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Starred"
        component={StarredScreen}
        options={{
          tabBarLabel: translate("tabs:starred"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "star" : "star-outline"} color={color} size={24} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

const $tabBar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.background,
  borderTopColor: colors.separator,
})

const $tabBarItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xs,
})

const $tabBarLabel: ThemedStyle<TextStyle> = ({ typography }) => ({
  fontSize: 12,
  fontFamily: typography.primary.medium,
  lineHeight: 16,
})
