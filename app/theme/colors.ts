/**
 * Navy and gold, after HKUST's own colours: navy marks anything you can tap, gold marks
 * things you've picked out (stars, search matches), on cool, quiet greys.
 */
const palette = {
  neutral100: "#FFFFFF",
  neutral200: "#F4F6F9",
  neutral300: "#E1E6ED",
  neutral400: "#C3CCD8",
  neutral500: "#8E9AAB",
  neutral600: "#56657A",
  neutral700: "#34425A",
  neutral800: "#0F1C2E",
  neutral900: "#000000",

  primary100: "#E3EBF6",
  primary200: "#C2D3EB",
  primary300: "#8FAFD9",
  primary400: "#4F7FC0",
  primary500: "#1F4F91",
  primary600: "#163A6B",

  secondary100: "#DCE3EC",
  secondary200: "#B9C6D8",
  secondary300: "#8193AD",
  secondary400: "#4E6280",
  secondary500: "#2B3B55",

  accent100: "#FBF3DC",
  accent200: "#F5E4B0",
  accent300: "#EBCF7A",
  accent400: "#DDB649",
  accent500: "#C99A1E",

  angry100: "#F6D8D3",
  angry500: "#C0341D",

  overlay20: "rgba(15, 28, 46, 0.2)",
  overlay50: "rgba(15, 28, 46, 0.5)",
} as const

export const colors = {
  /**
   * The palette is available to use, but prefer using the name.
   * This is only included for rare, one-off cases. Try to use
   * semantic names as much as possible.
   */
  palette,
  /**
   * A helper for making something see-thru.
   */
  transparent: "rgba(0, 0, 0, 0)",
  /**
   * The default text color in many components.
   */
  text: palette.neutral800,
  /**
   * Secondary text information.
   */
  textDim: palette.neutral600,
  /**
   * The default color of the screen background.
   */
  background: palette.neutral200,
  /**
   * The default border color.
   */
  border: palette.neutral400,
  /**
   * The main tinting color: links, buttons, selected filters.
   */
  tint: palette.primary500,
  /**
   * The inactive tinting color.
   */
  tintInactive: palette.neutral300,
  /**
   * A subtle color used for lines.
   */
  separator: palette.neutral300,
  /**
   * Error messages.
   */
  error: palette.angry500,
  /**
   * Error Background.
   */
  errorBackground: palette.angry100,
  /**
   * Raised surfaces: cards, the search field, sheets.
   */
  surface: palette.neutral100,
  /**
   * Recessed fills inside a card (e.g. the raw prerequisite text).
   */
  surfaceAlt: "#EDF1F6",
  /**
   * A faint wash of the tint, behind selected or highlighted content.
   */
  tintSoft: "rgba(31, 79, 145, 0.10)",
  /**
   * Gold: stars and other things the user has picked out.
   */
  star: palette.accent500,
  /**
   * Satisfied state: completed courses, met prerequisites. Kept apart from `tint`, which
   * marks things you can tap.
   */
  success: "#1E8455",
  successSoft: "rgba(30, 132, 85, 0.12)",
  /**
   * Something still to do: unmet prerequisites.
   */
  warning: "#A86400",
  warningSoft: "rgba(221, 150, 30, 0.15)",
  /**
   * Card shadow (light mode only; dark mode separates surfaces by tone).
   */
  shadow: "rgba(15, 28, 46, 0.08)",
} as const
