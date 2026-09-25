/**
 * A stable accent colour per department, so the same prefix always looks the same across
 * the list, search results and course pages. Hues are categorical (no green or amber, which
 * mean "met" and "still needed", and no plain blue, which is the tap colour), and each has a light and a dark variant.
 */
const HUES = [
  { light: "#C2553A", dark: "#F4A58E" }, // coral (not blue: navy is the tap colour)
  { light: "#11776F", dark: "#7FD1C7" }, // teal
  { light: "#7A4BB0", dark: "#C4A6EC" }, // purple
  { light: "#B0426B", dark: "#F0A3BF" }, // rose
  { light: "#4F55B8", dark: "#AEB2F2" }, // indigo
  { light: "#6B7A1E", dark: "#C9D67E" }, // olive
  { light: "#8A5A2B", dark: "#E3B98C" }, // brown
  { light: "#4A6275", dark: "#A9BFCF" }, // slate
] as const

export interface DepartmentColor {
  /** Text and icons. */
  fg: string
  /** Badge background: the same hue at low opacity. */
  bg: string
}

const cache = new Map<string, DepartmentColor>()

export function departmentColor(prefix: string, isDark: boolean): DepartmentColor {
  const key = `${prefix}:${isDark ? "d" : "l"}`
  let color = cache.get(key)
  if (!color) {
    // Seed 1 (not 0) was picked so the busiest departments land on distinct, vivid hues.
    let hash = 1
    for (let i = 0; i < prefix.length; i++) hash = (hash * 31 + prefix.charCodeAt(i)) >>> 0
    const fg = HUES[hash % HUES.length][isDark ? "dark" : "light"]
    color = { fg, bg: `${fg}${isDark ? "26" : "1F"}` } // hex alpha: ~15% / ~12%
    cache.set(key, color)
  }
  return color
}
