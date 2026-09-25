/**
 * Dark variant of the navy/gold theme: a deep navy ground, lighter navy surfaces, and a
 * brighter blue tint so links stay readable.
 */
const palette = {
  neutral900: "#FFFFFF",
  neutral800: "#EEF2F7",
  neutral700: "#CBD4E0",
  neutral600: "#A3B0C2",
  neutral500: "#6B7A90",
  neutral400: "#33425A",
  neutral300: "#1E2A3D",
  neutral200: "#0B1320",
  neutral100: "#000000",

  primary600: "#C9DCFB",
  primary500: "#8AB4F8",
  primary400: "#5E8FD6",
  primary300: "#3B6AAE",
  primary200: "#274C80",
  primary100: "#1A3357",

  secondary500: "#DCE3EC",
  secondary400: "#B9C6D8",
  secondary300: "#8193AD",
  secondary200: "#4E6280",
  secondary100: "#2B3B55",

  accent500: "#FBF3DC",
  accent400: "#F5E4B0",
  accent300: "#EBCF7A",
  accent200: "#E6C35C",
  accent100: "#C99A1E",

  angry100: "#F6D8D3",
  angry500: "#E0604A",

  overlay20: "rgba(0, 0, 0, 0.3)",
  overlay50: "rgba(0, 0, 0, 0.6)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: palette.neutral800,
  textDim: palette.neutral600,
  background: palette.neutral200,
  border: palette.neutral400,
  tint: palette.primary500,
  tintInactive: palette.neutral300,
  separator: palette.neutral300,
  error: palette.angry500,
  errorBackground: palette.angry100,
  surface: "#131D2D",
  surfaceAlt: "#1B2738",
  tintSoft: "rgba(138, 180, 248, 0.14)",
  star: palette.accent200,
  success: "#6FD39F",
  successSoft: "rgba(111, 211, 159, 0.14)",
  warning: "#F2B45C",
  warningSoft: "rgba(242, 180, 92, 0.14)",
  shadow: "rgba(0, 0, 0, 0)",
} as const
