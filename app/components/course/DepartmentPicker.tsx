import { useMemo, useState } from "react"
import { FlatList, Modal, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { Department } from "@/data/types"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface DepartmentPickerProps {
  visible: boolean
  departments: Department[]
  /** Course count per prefix under the current term/career filters. */
  counts: Map<string, number>
  selected?: string
  onSelect: (prefix: string | undefined) => void
  onClose: () => void
}

/** Full-screen sheet listing all 129 departments, filterable, with live course counts. */
export function DepartmentPicker(props: DepartmentPickerProps) {
  const { visible, departments, counts, selected, onSelect, onClose } = props
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { bottom } = useSafeAreaInsets()
  const [filter, setFilter] = useState("")

  const rows = useMemo(() => {
    const q = filter.trim().toUpperCase()
    const matching = departments.filter((d) => d.prefix.includes(q))
    return [undefined, ...matching]
  }, [departments, filter])

  const choose = (prefix: string | undefined) => {
    onSelect(prefix)
    setFilter("")
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={themed($sheet)}>
        <View style={themed($header)}>
          <Text preset="subheading" tx="departmentPicker:title" />
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text weight="medium" style={{ color: colors.tint }} tx="common:done" />
          </Pressable>
        </View>
        <TextField
          value={filter}
          onChangeText={setFilter}
          placeholderTx="departmentPicker:filterPlaceholder"
          autoCapitalize="characters"
          autoCorrect={false}
          containerStyle={themed($filter)}
        />
        <FlatList
          data={rows}
          keyExtractor={(d) => d?.prefix ?? "__all"}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: bottom + 16 }}
          renderItem={({ item }) => {
            const isSelected = item?.prefix === selected
            const count = item ? (counts.get(item.prefix) ?? 0) : undefined
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => choose(item?.prefix)}
                style={({ pressed }) => [themed($row), pressed && { opacity: 0.6 }]}
              >
                <Text
                  weight={isSelected ? "bold" : "normal"}
                  style={$rowLabel}
                  text={item ? item.prefix : translate("explore:allDepartments")}
                />
                {item && (
                  <Text
                    size="xxs"
                    style={themed($dim)}
                    text={item.career === "Mixed" ? "UG/PG" : item.career}
                  />
                )}
                {count !== undefined && (
                  <Text
                    size="xs"
                    style={[themed($dim), count === 0 && $zero]}
                    text={String(count)}
                  />
                )}
                {isSelected && <Ionicons name="checkmark" size={18} color={colors.tint} />}
              </Pressable>
            )
          }}
        />
      </View>
    </Modal>
  )
}

const $sheet: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  backgroundColor: colors.background,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: spacing.md,
  paddingTop: spacing.lg,
  paddingBottom: spacing.sm,
})

const $filter: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xs,
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
})

const $rowLabel: TextStyle = { flex: 1 }

const $zero: TextStyle = { opacity: 0.5 }

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
