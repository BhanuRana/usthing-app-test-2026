import { ComponentProps } from "react"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import {
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

// Bottom tabs
export type TabParamList = {
  Explore: undefined
  MyCourses: undefined
}

// App Stack Navigator types
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>
  /** `term` is an index into the catalogue's terms; omitted = the course's newest version. */
  CourseDetail: { code: string; term?: number }
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}
