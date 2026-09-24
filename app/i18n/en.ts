const en = {
  common: {
    ok: "OK!",
    cancel: "Cancel",
    back: "Back",
    done: "Done",
    all: "All",
  },
  errorScreen: {
    title: "Something went wrong!",
    friendlySubtitle:
      "Sorry, the app hit an unexpected error. You can reset it and carry on browsing courses.",
    reset: "RESET APP",
    traceTitle: "Error from %{name} stack",
  },
  emptyStateComponent: {
    generic: {
      heading: "So empty... so sad",
      content: "No data found yet. Try clicking the button to refresh or reload the app.",
      button: "Let's try this again",
    },
  },
  tabs: {
    explore: "Explore",
    starred: "Starred",
  },
  explore: {
    title: "Courses",
    searchPlaceholder: "Search code or title, e.g. COMP 2011",
    allTerms: "All terms",
    allDepartments: "All departments",
    // i18next picks count_one for 1 and falls back to `count` otherwise.
    count: "{{count}} courses",
    count_one: "{{count}} course",
    noResultsHeading: "No matching courses",
    noResultsContent: "Try a different search, or clear the filters.",
    clearFilters: "Clear filters",
  },
  departmentPicker: {
    title: "Department",
    filterPlaceholder: "Filter departments",
  },
  starred: {
    title: "Starred",
    emptyHeading: "No starred courses yet",
    emptyContent: "Tap the star on a course to keep it here for quick access.",
  },
  course: {
    offeredIn: "Offered in",
    notOfferedIn: "Not offered in {{term}}. Showing {{shown}}.",
    description: "Description",
    prerequisites: "Prerequisites",
    noPrerequisites: "No prerequisites listed.",
    asWritten: "As written",
    fullChain: "Full prerequisite chain",
    fullChainSummary: "{{count}} courses across {{levels}} levels",
    level: "Level {{level}}",
    unlocks: "Leads to",
    unlocksHint: "Courses that list {{code}} in their prerequisites",
    unlocksNone: "No course lists {{code}} as a prerequisite.",
    corequisite: "Co-requisite",
    exclusion: "Exclusion",
    colist: "Co-listed with",
    previous: "Previously",
    attributes: "Attributes",
    cilos: "Learning outcomes",
    notFound: "This course isn't in the catalogue.",
    star: "Star course",
    unstar: "Unstar course",
  },
  prereq: {
    allOf: "All of",
    oneOf: "One of",
    cycle: "Loops back",
    notInCatalogue: "Not in catalogue",
    noneBelow: "No prerequisites",
    expand: "Show prerequisites of {{code}}",
    collapse: "Hide prerequisites of {{code}}",
  },
}

export default en
export type Translations = typeof en
