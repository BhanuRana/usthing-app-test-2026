import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { LayoutChangeEvent, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from "react-native-svg"
import { scheduleOnRN } from "react-native-worklets"

import { HeroButton } from "@/components/course/HeroHeader"
import { StarPrompt } from "@/components/course/StarPrompt"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { getCourse, getCourseVersion, getPrereqGraph } from "@/data/catalog"
import {
  courseStatus,
  CourseStatus,
  missingGroups,
  missingRequirements,
} from "@/data/prereq/evaluate"
import { buildCourseMap, lineage, MAP_SIZES, MapNode } from "@/data/prereq/map"
import { planPath } from "@/data/prereq/plan"
import { prereqTreeFor, unlockedBy } from "@/data/prereq/traverse"
import { translate } from "@/i18n/translate"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { departmentColor } from "@/theme/departmentColors"
import type { ThemedStyle } from "@/theme/types"
import { storage } from "@/utils/storage"
import { useCompleted, useStarred } from "@/utils/usePreferences"

/**
 * Content is drawn this much larger than the map's own units, and zoom never goes above
 * 1: scaling a view *up* on iOS scales a bitmap and blurs text, scaling *down* stays sharp.
 */
const K = 1.5
/** Room around the nodes, in content points (also leaves space for column labels). */
const PAD = 90
const MAX_ZOOM = 1
const ABS_MIN_ZOOM = 0.1
/** Below this, a fitted map is too small to read: open centred on the course instead. */
const READABLE_ZOOM = 0.42
const EASE = { duration: 380, easing: Easing.out(Easing.cubic) }
/** Height kept clear at the bottom while the selection card is showing. */
const CARD_SPACE = 220
/** How much of the map (in points) always stays on screen when panning. */
const KEEP = 120
const TIP_SEEN = "map.tipSeen"

type Box = { x: number; y: number; w: number; h: number }

export function CourseMapScreen({ route, navigation }: AppStackScreenProps<"CourseMap">) {
  const { code, term } = route.params
  const {
    themed,
    theme: { colors, isDark },
  } = useAppTheme()
  const { top, bottom } = useSafeAreaInsets()
  const { starred } = useStarred()
  const { completed, toggle: toggleCompleted, add: addCompleted } = useCompleted()
  const graph = getPrereqGraph()

  // Always both directions: what comes before, the course, and where it leads.
  const mode = "both"
  const [showPath, setShowPath] = useState(true)
  const [selected, setSelected] = useState<string>()
  // The key (what the colours and lines mean) stays out of the way until asked for.
  const [keyOpen, setKeyOpen] = useState(false)
  // The first map a user opens shows how it works, once, for a few seconds.
  const [tip, setTip] = useState(() => !storage.getBoolean(TIP_SEEN))
  useEffect(() => {
    if (!tip) return undefined
    storage.set(TIP_SEEN, true)
    const t = setTimeout(() => setTip(false), 5000)
    return () => clearTimeout(t)
  }, [tip])
  // Courses expanded to the right of the focus, one per column (see buildCourseMap).
  const [trail, setTrail] = useState<string[]>([])

  const map = useMemo(
    () => buildCourseMap(graph, code, { mode, term, trail }),
    [graph, code, mode, term, trail],
  )
  // The focus and the expanded trail, in order: the explored route through "leads to".
  const explored = useMemo(() => [code, ...map.trail], [code, map.trail])
  const leadsOf = useCallback((id: string) => unlockedBy(graph, id).length, [graph])

  // Can each course be taken, from what's marked completed? Only shown once something is
  // (before that, every course would say "needs", which says nothing).
  const hasCompleted = completed.size > 0
  const treeOf = useCallback(
    (id: string) => prereqTreeFor(graph, id, id === code ? term : undefined),
    [graph, code, term],
  )
  const statusById = useMemo(() => {
    const out = new Map<string, CourseStatus>()
    for (const n of map.nodes)
      if (n.kind === "course") out.set(n.id, courseStatus(n.id, treeOf(n.id), completed))
    return out
  }, [map, treeOf, completed])
  // A junction is met when its group is: any option (one of) or every part (all of) done.
  const junctionMet = useCallback(
    (id: string) => {
      const into = map.edges.filter((e) => e.to === id && !e.loop).map((e) => e.from)
      const kind = map.nodes.find((n) => n.id === id)?.kind
      return kind === "any"
        ? into.some((c) => completed.has(c))
        : into.every((c) => completed.has(c))
    },
    [map, completed],
  )

  // Marking a course completed from the map asks about its unmet prerequisites, like the
  // course page does.
  const [completing, setCompleting] = useState<string>()
  const completingGroups = useMemo(() => {
    if (!completing) return []
    const tree = treeOf(completing)
    return tree ? missingGroups(tree, completed) : []
  }, [completing, treeOf, completed])
  const onToggleCompleted = (id: string) => {
    if (completed.has(id)) return toggleCompleted(id)
    const tree = treeOf(id)
    if (tree && missingGroups(tree, completed).length > 0) setCompleting(id)
    else toggleCompleted(id)
  }
  const path = useMemo(
    () => planPath(graph, code, completed, starred, term),
    [graph, code, completed, starred, term],
  )
  // Step number for each course on "Your path" (the course itself is the goal).
  const pathStep = useMemo(() => {
    const steps = new Map<string, number>()
    path?.steps.forEach((s, i) => s.forEach((c) => steps.set(c.code, i + 1)))
    return steps
  }, [path])
  const lit = useMemo(() => (selected ? lineage(map, selected) : undefined), [map, selected])

  // Content geometry: map units -> content points.
  const origin = { x: map.bounds.minX * K - PAD, y: map.bounds.minY * K - PAD }
  const content = {
    w: (map.bounds.maxX - map.bounds.minX) * K + PAD * 2,
    h: (map.bounds.maxY - map.bounds.minY) * K + PAD * 2,
  }
  const rectOf = useCallback(
    (n: MapNode): Box => ({
      x: n.x * K - (n.width * K) / 2 - origin.x,
      y: n.y * K - (n.height * K) / 2 - origin.y,
      w: n.width * K,
      h: n.height * K,
    }),
    [origin.x, origin.y],
  )
  const nodeById = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map])

  // --- Viewport and gestures ------------------------------------------------------------------

  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const scale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const minZoom = useSharedValue(ABS_MIN_ZOOM)

  // Expanding a column can grow the map up or left, which moves the content origin. Shift
  // the pan by the same amount before the frame is drawn, so nothing on screen jumps.
  const originRef = useRef(origin)
  useLayoutEffect(() => {
    const prev = originRef.current
    if (prev.x === origin.x && prev.y === origin.y) return
    tx.value = tx.value + (origin.x - prev.x) * scale.value
    ty.value = ty.value + (origin.y - prev.y) * scale.value
    originRef.current = origin
  })
  // Space kept clear of the floating controls at the top and the card/legend at the bottom.
  const inset = { top: 56, bottom: 84 }

  const fitTransform = useCallback(() => {
    const availW = viewport.w - 24
    const availH = viewport.h - inset.top - inset.bottom
    const s = Math.min(MAX_ZOOM, availW / content.w, availH / content.h)
    return {
      s,
      x: (viewport.w - content.w * s) / 2,
      y: inset.top + (availH - content.h * s) / 2,
    }
  }, [viewport, content.w, content.h, inset.top, inset.bottom])

  // `below` is the space taken at the bottom: the legend, or the taller selection card.
  const centreOn = useCallback(
    (id: string, s: number, below: number = inset.bottom) => {
      const n = nodeById.get(id)
      if (!n) return { s, x: 0, y: 0 }
      const r = rectOf(n)
      const availH = viewport.h - inset.top - below
      return {
        s,
        x: viewport.w / 2 - (r.x + r.w / 2) * s,
        y: inset.top + availH / 2 - (r.y + r.h / 2) * s,
      }
    },
    [nodeById, rectOf, viewport, inset.top, inset.bottom],
  )

  const moveTo = useCallback(
    (t: { s: number; x: number; y: number }, animated = true) => {
      scale.value = animated ? withTiming(t.s, EASE) : t.s
      tx.value = animated ? withTiming(t.x, EASE) : t.x
      ty.value = animated ? withTiming(t.y, EASE) : t.y
    },
    [scale, tx, ty],
  )

  const fit = useCallback(() => moveTo(fitTransform()), [moveTo, fitTransform])

  // Fits a region of the content (in content points) into the free part of the viewport.
  const frameRegion = useCallback(
    (r: Box, clampMin: number) => {
      const availW = viewport.w - 24
      const availH = viewport.h - inset.top - inset.bottom
      const s = Math.max(clampMin, Math.min(MAX_ZOOM, availW / r.w, availH / r.h))
      return {
        s,
        x: viewport.w / 2 - (r.x + r.w / 2) * s,
        y: inset.top + availH / 2 - (r.y + r.h / 2) * s,
      }
    },
    [viewport, inset.top, inset.bottom],
  )

  // Frame the map whenever it (or the viewport) changes: the whole map if it's readable
  // that way; otherwise the course's neighbourhood (direct prerequisites, the course, what
  // it leads to), no smaller than readable.
  const framed = useRef("")
  useEffect(() => {
    if (!viewport.w) return
    const f = fitTransform()
    minZoom.value = Math.max(ABS_MIN_ZOOM, Math.min(f.s, 0.35))
    const key = `${code}|${mode}|${viewport.w}x${viewport.h}`
    if (framed.current === key) return
    const first = framed.current === ""
    framed.current = key
    if (f.s >= READABLE_ZOOM) return moveTo(f, !first)
    const regionOf = (lo: number, hi: number) => {
      const near = map.nodes.filter((n) => n.rank >= lo && n.rank <= hi).map(rectOf)
      const x0 = Math.min(...near.map((r) => r.x))
      const y0 = Math.min(...near.map((r) => r.y))
      return {
        x: x0 - 30,
        y: y0 - 30,
        w: Math.max(...near.map((r) => r.x + r.w)) - x0 + 60,
        h: Math.max(...near.map((r) => r.y + r.h)) - y0 + 60,
      }
    }
    // Direct prerequisites, the course and what it leads to; if that's too wide to read,
    // the prerequisites side matters more (unless only "leads to" is shown).
    const wide = regionOf(-1, 1)
    const fitsWide = (viewport.w - 24) / wide.w >= READABLE_ZOOM + 0.08
    const region = fitsWide ? wide : regionOf(-1, 0)
    const t = frameRegion(region, READABLE_ZOOM + 0.08)
    // If the neighbourhood is too tall to fit (a course that leads to dozens), keep the
    // course itself in the middle vertically.
    const focusY = centreOn(code, t.s).y
    moveTo(
      { ...t, y: region.h * t.s > viewport.h - inset.top - inset.bottom ? focusY : t.y },
      !first,
    )
  }, [
    viewport,
    code,
    mode,
    fitTransform,
    centreOn,
    frameRegion,
    moveTo,
    minZoom,
    map.nodes,
    rectOf,
    inset.top,
    inset.bottom,
  ])

  const onViewportLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setViewport({ w: width, h: height })
  }

  // Selecting a course glides it into view above the selection card, zooming in to a
  // readable size first if the map is zoomed right out. The glide runs after the next layout
  // (a tap can add a column), and when the course has just been expanded it sits left of
  // centre, so its new column is in view too.
  const selectedRef = useRef<string | undefined>(undefined)
  const [glide, setGlide] = useState<{ id: string; ahead: boolean }>()
  const select = (id: string | undefined, ahead = false) => {
    selectedRef.current = id
    setSelected(id)
    if (id) setGlide({ id, ahead })
  }
  useEffect(() => {
    if (!glide || !nodeById.has(glide.id)) return
    const t = centreOn(glide.id, Math.max(scale.value, READABLE_ZOOM + 0.08), CARD_SPACE)
    const shift = glide.ahead ? (MAP_SIZES.column * K * t.s) / 2 : 0
    moveTo({ ...t, x: t.x - shift })
    setGlide(undefined)
  }, [glide, nodeById, centreOn, moveTo, scale])

  // Tapping a course on the "leads to" side also expands it: the trail keeps the columns
  // before it and swaps in this course, so exploring is one branch at a time.
  const open = (id: string) => {
    const n = nodeById.get(id)
    if (!n || n.kind !== "course") return
    if (n.rank >= 1) {
      setTrail([...map.trail.slice(0, n.rank - 1), id])
      select(id, leadsOf(id) > 0)
    } else {
      select(id)
    }
  }

  // Where a course sits relative to the one the map is about, in words, for the card.
  const relationOf = (n: MapNode): string => {
    if (n.id === code) return translate("map:relFocus")
    if (n.rank < 0) {
      const feedsFocus = (to: string) =>
        to === code ||
        (nodeById.get(to)?.kind !== "course" &&
          map.edges.some((f) => f.from === to && f.to === code))
      const direct = map.edges.some((e) => e.from === n.id && !e.loop && feedsFocus(e.to))
      return direct
        ? translate("map:relDirect", { code })
        : translate("map:relBefore", { n: -n.rank, code })
    }
    const parent = map.edges.find(
      (e) => e.to === n.id && !e.loop && (nodeById.get(e.from)?.rank ?? -1) >= 0,
    )?.from
    return translate("map:relBuildsOn", { code: parent ?? code })
  }

  // The card's verdict: the same answer as the course page's eligibility banner.
  const verdictOf = (id: string): SelectedCardProps["verdict"] => {
    const status = statusById.get(id) ?? courseStatus(id, treeOf(id), completed)
    const tree = treeOf(id)
    if (status.kind === "completed") return { tone: "done", text: translate("map:completed") }
    if (!tree) return { tone: "ok", text: translate("map:canTakeNone") }
    if (!hasCompleted) return { tone: "muted", text: translate("map:markHint") }
    if (status.kind === "can-take") return { tone: "ok", text: translate("map:canTake") }
    if (status.kind === "unknown") return { tone: "muted", text: translate("map:cantCheck") }
    return {
      tone: "warn",
      text: translate("map:stillNeeded", {
        items: missingRequirements(tree, completed).join(", "),
      }),
    }
  }

  // Back along the explored route: keep it up to that course and glide there.
  const goToRoute = (index: number) => {
    setTrail(map.trail.slice(0, index))
    select(explored[index], index > 0 || leadsOf(code) > 0)
  }

  // Tap: find the node under the finger (in content points), select it or clear.
  const hitTest = (px: number, py: number) => {
    const slop = 8
    const hit = map.nodes.find((n) => {
      const r = rectOf(n)
      return (
        px >= r.x - slop && px <= r.x + r.w + slop && py >= r.y - slop && py <= r.y + r.h + slop
      )
    })
    if (hit?.kind === "course") {
      if (hit.id === selectedRef.current) select(undefined)
      else open(hit.id)
    } else if (!hit) select(undefined)
  }

  const pinchStart = useSharedValue({ s: 1, x: 0, y: 0, fx: 0, fy: 0 })
  const panStart = useSharedValue({ x: 0, y: 0 })

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinchStart.value = { s: scale.value, x: tx.value, y: ty.value, fx: e.focalX, fy: e.focalY }
    })
    .onUpdate((e) => {
      const st = pinchStart.value
      const s = Math.min(MAX_ZOOM, Math.max(minZoom.value, st.s * e.scale))
      // Keep the content point that was under the fingers under the fingers.
      const cx = (st.fx - st.x) / st.s
      const cy = (st.fy - st.y) / st.s
      scale.value = s
      tx.value = e.focalX - cx * s
      ty.value = e.focalY - cy * s
    })

  // Panning and its momentum stop while some of the map is still on screen, so a fling can
  // never leave you looking at empty dots.
  const extent = useSharedValue({ w: 0, h: 0, vw: 0, vh: 0 })
  useEffect(() => {
    extent.value = { w: content.w, h: content.h, vw: viewport.w, vh: viewport.h }
  }, [content.w, content.h, viewport.w, viewport.h, extent])
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      panStart.value = { x: tx.value, y: ty.value }
    })
    .onUpdate((e) => {
      const { w, h, vw, vh } = extent.value
      const s = scale.value
      tx.value = Math.min(vw - KEEP, Math.max(KEEP - w * s, panStart.value.x + e.translationX))
      ty.value = Math.min(vh - KEEP, Math.max(KEEP - h * s, panStart.value.y + e.translationY))
    })
    .onEnd((e) => {
      const { w, h, vw, vh } = extent.value
      const s = scale.value
      tx.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.994,
        clamp: [KEEP - w * s, vw - KEEP],
      })
      ty.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.994,
        clamp: [KEEP - h * s, vh - KEEP],
      })
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const s0 = scale.value
      const s = s0 >= MAX_ZOOM - 0.01 ? minZoom.value : Math.min(MAX_ZOOM, s0 * 2)
      const cx = (e.x - tx.value) / s0
      const cy = (e.y - ty.value) / s0
      scale.value = withTiming(s, EASE)
      tx.value = withTiming(e.x - cx * s, EASE)
      ty.value = withTiming(e.y - cy * s, EASE)
    })

  const tap = Gesture.Tap().onEnd((e) => {
    scheduleOnRN(hitTest, (e.x - tx.value) / scale.value, (e.y - ty.value) / scale.value)
  })

  const gesture = Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, tap))

  const $contentAnimated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }))

  const zoomIn = () => {
    const s0 = scale.value
    if (selected) return moveTo(centreOn(selected, Math.min(MAX_ZOOM, s0 * 1.6), CARD_SPACE))
    const s = Math.min(MAX_ZOOM, s0 * 1.6)
    const cx = (viewport.w / 2 - tx.value) / s0
    const cy = (viewport.h / 2 - ty.value) / s0
    moveTo({ s, x: viewport.w / 2 - cx * s, y: viewport.h / 2 - cy * s })
  }

  // --- Drawing ---------------------------------------------------------------------------------

  const courseNodes = map.nodes.filter((n) => n.kind === "course")
  const selectedNode = selected ? nodeById.get(selected) : undefined
  const onPath = (id: string) => showPath && (id === code || pathStep.has(id))
  const edgeOnPath = (from: string, to: string) => {
    if (!showPath || !path) return false
    // Through a junction: highlight if the course on each side is on the path.
    const f = nodeById.get(from)!
    const t = nodeById.get(to)!
    const fromOk =
      f.kind === "course" ? onPath(from) : map.edges.some((e) => e.to === from && onPath(e.from))
    const toOk =
      t.kind === "course" ? onPath(to) : map.edges.some((e) => e.from === to && onPath(e.to))
    return fromOk && toOk
  }

  const paths = map.edges.map((e) => {
    const a = rectOf(nodeById.get(e.from)!)
    const b = rectOf(nodeById.get(e.to)!)
    const inLineage = !!lit && lit.has(e.from) && lit.has(e.to) && !e.loop
    const onRoute =
      !e.loop && explored.indexOf(e.to) > 0 && explored[explored.indexOf(e.to) - 1] === e.from
    const highlighted = !e.loop && (onRoute || edgeOnPath(e.from, e.to))
    const width = inLineage ? 4 : highlighted ? 4.5 : 2.2
    // Every edge ends in an arrowhead at the course it feeds, so the direction reads without
    // relying on left-to-right; the line stops at the arrow's base.
    const head = { l: 8 + width * 1.6, w: 4 + width }
    const x1 = a.x + a.w
    const y1 = a.y + a.h / 2
    const x2 = b.x
    const y2 = b.y + b.h / 2
    const end = x2 - head.l + 1
    let d: string
    if (e.loop) {
      // Curves back over the top: out of the right side, into the left side.
      const lift = Math.max(a.h, b.h) * 1.4
      d = `M ${x1} ${y1} C ${x1 + 120} ${y1 - lift}, ${end - 120} ${y2 - lift}, ${end} ${y2}`
    } else {
      const dx = Math.max(40, (end - x1) * 0.5)
      d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${end - dx} ${y2}, ${end} ${y2}`
    }
    const arrow = `M ${x2 - head.l} ${y2 - head.w} L ${x2} ${y2} L ${x2 - head.l} ${y2 + head.w} Z`
    const dim = !!lit && !inLineage
    // A requirement already met: out of a completed course, or out of a satisfied group.
    const done =
      !e.loop &&
      (completed.has(e.from) || (nodeById.get(e.from)?.kind !== "course" && junctionMet(e.from)))
    return {
      key: `${e.from}>${e.to}`,
      d,
      arrow,
      loop: e.loop,
      stroke: e.loop
        ? colors.warning
        : inLineage || highlighted
          ? colors.tint
          : done
            ? colors.success
            : colors.palette.neutral400,
      width,
      opacity: dim ? 0.12 : e.loop ? 0.9 : inLineage || highlighted ? 1 : 0.85,
      // Draw highlighted edges last, on top.
      z: inLineage || highlighted ? 1 : 0,
    }
  })
  paths.sort((a, b) => a.z - b.z)

  const columnLabel = (rank: number) =>
    rank === 0
      ? translate("map:thisCourse")
      : rank > 0
        ? translate("map:leadsTo")
        : rank === -1
          ? translate("map:directPrerequisites")
          : translate("map:stepsBack", { n: -rank })

  const isEmpty = map.nodes.length === 1

  return (
    <Screen preset="fixed" systemBarStyle="light" contentContainerStyle={$flex}>
      <View style={[themed($bar), { paddingTop: top }]}>
        <HeroButton
          icon="chevron-back"
          accessibilityLabel={translate("common:back")}
          onPress={() => navigation.goBack()}
        />
        <View style={$barTitle}>
          <Text size="xxs" weight="semiBold" style={themed($barEyebrow)} tx="map:title" />
          <Text weight="semiBold" style={themed($barTitleText)} text={code} />
        </View>
        <HeroButton
          icon="scan-outline"
          accessibilityLabel={translate("map:fit")}
          testID="map-fit"
          onPress={fit}
        />
      </View>

      <View style={[$flex, themed($canvas)]} onLayout={onViewportLayout}>
        {/* A dot grid across the whole canvas (fixed: it frames the map, it isn't part of it). */}
        <Svg style={$fill} pointerEvents="none">
          <Defs>
            <Pattern id="dots" width={22} height={22} patternUnits="userSpaceOnUse">
              <Circle cx={2} cy={2} r={1.2} fill={colors.separator} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#dots)" />
        </Svg>
        <GestureDetector gesture={gesture}>
          <View style={$flex} collapsable={false}>
            <Animated.View
              style={[{ width: content.w, height: content.h }, $contentOrigin, $contentAnimated]}
            >
              <Svg width={content.w} height={content.h}>
                {paths.map((p) => (
                  <G key={p.key} opacity={p.opacity}>
                    <Path
                      d={p.d}
                      stroke={p.stroke}
                      strokeWidth={p.width}
                      strokeDasharray={p.loop ? "10 8" : undefined}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <Path d={p.arrow} fill={p.stroke} />
                  </G>
                ))}
              </Svg>

              {!isEmpty &&
                map.columns.map((col) => (
                  <Text
                    key={col.rank}
                    size="xs"
                    weight="semiBold"
                    style={[
                      themed($columnLabel),
                      {
                        left: col.x * K - origin.x - 140,
                        top: PAD - 64,
                      },
                    ]}
                    text={columnLabel(col.rank).toUpperCase()}
                  />
                ))}

              {map.nodes
                .filter((n) => n.kind !== "course")
                .map((n) => (
                  <Junction
                    key={n.id}
                    node={n}
                    rect={rectOf(n)}
                    dim={!!lit && !lit.has(n.id)}
                    options={map.edges.filter((e) => e.to === n.id).length}
                    met={junctionMet(n.id)}
                  />
                ))}

              {courseNodes.map((n) => (
                <CourseNode
                  key={n.id}
                  node={n}
                  rect={rectOf(n)}
                  isFocus={n.id === code}
                  isSelected={n.id === selected}
                  completed={completed.has(n.id)}
                  starred={starred.has(n.id)}
                  step={showPath ? pathStep.get(n.id) : undefined}
                  onPathRing={(showPath && pathStep.has(n.id)) || map.trail.includes(n.id)}
                  leads={n.rank >= 1 && !map.trail.includes(n.id) ? leadsOf(n.id) : 0}
                  status={hasCompleted ? statusById.get(n.id) : undefined}
                  dim={!!lit && !lit.has(n.id)}
                  isDark={isDark}
                  onSelect={open}
                />
              ))}
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Floating controls */}
        <View style={$controls} pointerEvents="box-none">
          {path && (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: showPath }}
              testID="map-path-toggle"
              onPress={() => setShowPath((v) => !v)}
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
          {map.trail.length > 0 && (
            <ScrollView
              horizontal
              style={$crumbScroll}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={themed($crumbs)}
              accessibilityLabel={translate("map:trail")}
            >
              {explored.map((id, i) => (
                <View key={id} style={$crumbItem}>
                  {i > 0 && <Ionicons name="chevron-forward" size={12} color={colors.textDim} />}
                  <Pressable
                    accessibilityRole="button"
                    testID={`map-crumb-${id}`}
                    onPress={() => goToRoute(i)}
                    hitSlop={6}
                    style={({ pressed }) => [
                      themed($crumb),
                      i === explored.length - 1 && themed($crumbLast),
                      pressed && $pressed,
                    ]}
                  >
                    <Text
                      size="xxs"
                      weight="semiBold"
                      style={{
                        color: i === explored.length - 1 ? colors.palette.neutral100 : colors.tint,
                      }}
                      text={id}
                    />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={$zoomButtons} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate("map:zoomIn")}
            onPress={zoomIn}
            style={themed($roundButton)}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate("map:fit")}
            onPress={fit}
            style={themed($roundButton)}
          >
            <Ionicons name="contract-outline" size={18} color={colors.text} />
          </Pressable>
        </View>

        {isEmpty && (
          <View style={themed($emptyNote)} pointerEvents="none">
            <Text size="xs" style={themed($dim)} tx="map:empty" txOptions={{ code }} />
          </View>
        )}

        {/* Bottom: the selected course, or the legend. */}
        <View style={[$bottom, { paddingBottom: bottom + 12 }]} pointerEvents="box-none">
          {selectedNode ? (
            <SelectedCard
              code={selectedNode.id}
              node={selectedNode}
              relation={relationOf(selectedNode)}
              isFocus={selectedNode.id === code}
              completed={completed.has(selectedNode.id)}
              starred={starred.has(selectedNode.id)}
              step={pathStep.get(selectedNode.id)}
              loop={map.edges.some(
                (e) => e.loop && (e.from === selectedNode.id || e.to === selectedNode.id),
              )}
              leads={selectedNode.rank >= 0 ? leadsOf(selectedNode.id) : undefined}
              term={term}
              verdict={verdictOf(selectedNode.id)}
              onToggleCompleted={() => onToggleCompleted(selectedNode.id)}
              onOpen={() => navigation.push("CourseDetail", { code: selectedNode.id, term })}
              onCentre={() => navigation.push("CourseMap", { code: selectedNode.id, term })}
              onClose={() => select(undefined)}
            />
          ) : (
            <View style={$keyArea} pointerEvents="box-none">
              {tip && !keyOpen && (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  exiting={FadeOut.duration(300)}
                  style={themed($tip)}
                  pointerEvents="none"
                >
                  <Ionicons name="hand-left-outline" size={15} color={colors.palette.neutral100} />
                  <Text size="xxs" weight="medium" style={$tipText} tx="map:tip" />
                </Animated.View>
              )}
              {keyOpen && <Legend showPath={showPath && !!path} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(keyOpen ? "map:keyHide" : "map:keyShow")}
                accessibilityState={{ expanded: keyOpen }}
                testID="map-key-toggle"
                onPress={() => setKeyOpen((v) => !v)}
                hitSlop={8}
                style={({ pressed }) => [
                  themed($roundButton),
                  keyOpen && themed($roundButtonOn),
                  pressed && $pressed,
                ]}
              >
                <Ionicons
                  name={keyOpen ? "close" : "information"}
                  size={keyOpen ? 20 : 22}
                  color={keyOpen ? colors.palette.neutral100 : colors.tint}
                />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <StarPrompt
        kind="complete"
        visible={!!completing}
        code={completing ?? ""}
        groups={completingGroups}
        already={completed}
        onConfirm={addCompleted}
        onClose={() => setCompleting(undefined)}
      />
    </Screen>
  )
}

// --- Nodes -----------------------------------------------------------------------------------

/** Fades a node down when it's outside the selected course's lineage, and back up. */
function useDimStyle(dim: boolean) {
  const opacity = useSharedValue(dim ? DIMMED : 1)
  useEffect(() => {
    opacity.value = withTiming(dim ? DIMMED : 1, { duration: 220 })
  }, [dim, opacity])
  return useAnimatedStyle(() => ({ opacity: opacity.value }))
}

/** New columns fade in; collapsed ones fade out. */
const NODE_IN = FadeIn.duration(260)
const NODE_OUT = FadeOut.duration(160)

interface CourseNodeProps {
  node: MapNode
  rect: Box
  isFocus: boolean
  isSelected: boolean
  completed: boolean
  starred: boolean
  step?: number
  onPathRing: boolean
  /** How many courses this one leads to, when tapping it would expand them (else 0). */
  leads: number
  /** Whether the student can take it (shown once anything is marked completed). */
  status?: CourseStatus
  dim: boolean
  isDark: boolean
  onSelect: (id: string) => void
}

const CourseNode = memo(function CourseNode(props: CourseNodeProps) {
  const { node, rect, isFocus, isSelected, completed, starred, step, onPathRing, dim } = props
  const { isDark, onSelect, leads, status } = props
  const canTake = status?.kind === "can-take" && !isFocus
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const course = getCourse(node.id)
  const stripe = departmentColor(node.id.split(" ")[0], isDark).fg
  const fg = isFocus ? colors.palette.neutral100 : colors.text
  const title = course?.title ?? translate("map:notInCatalogue")
  const statusText = [
    completed && translate("map:completed"),
    starred && translate("map:starred"),
    step && translate("map:onPath", { n: step }),
  ]
    .filter(Boolean)
    .join(", ")

  const $dimAnimated = useDimStyle(dim)

  // Two layers: the outer one fades in and out with the column, the inner one dims with
  // the selection (both animate opacity, so they can't share a view).
  return (
    <Animated.View
      entering={NODE_IN}
      exiting={NODE_OUT}
      style={[$place, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={[translate("map:nodeLabel", { code: node.id, title }), statusText]
        .filter(Boolean)
        .join(", ")}
      accessibilityState={{ selected: isSelected }}
      onAccessibilityTap={() => onSelect(node.id)}
      testID={`map-node-${node.id}`}
    >
      <Animated.View
        style={[
          themed($node),
          !course && themed($nodeMissing),
          completed && !isFocus && themed($nodeCompleted),
          canTake && themed($nodeCanTake),
          onPathRing && !completed && themed($nodeOnPath),
          isFocus && themed($nodeFocus),
          isSelected && themed($nodeSelected),
          $dimAnimated,
        ]}
      >
        {!isFocus && <View style={[$stripe, { backgroundColor: stripe }]} />}
        <View style={$nodeBody}>
          <View style={$nodeTop}>
            <Text
              weight="bold"
              style={[$nodeCode, { color: isFocus ? fg : colors.tint }]}
              text={node.id}
            />
            {completed && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={isFocus ? colors.palette.neutral100 : colors.success}
              />
            )}
            {starred && <Ionicons name="star" size={20} color={colors.star} />}
            {node.otherRequirements && (
              <Text style={[$nodeExtra, { color: isFocus ? fg : colors.warning }]} text="+" />
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[$nodeTitle, { color: isFocus ? colors.palette.neutral100 : colors.textDim }]}
            text={title}
          />
        </View>
        {step !== undefined && (
          <View style={themed($stepBadge)}>
            <Text weight="bold" style={$stepText} text={String(step)} />
          </View>
        )}
        {status && status.kind !== "completed" && (
          <View
            style={[
              themed($statusTag),
              status.kind === "can-take" && themed($statusOk),
              status.kind === "needs" && themed($statusWarn),
            ]}
          >
            <Text
              weight="bold"
              style={$statusText}
              text={
                status.kind === "can-take"
                  ? translate("map:tagCanTake")
                  : status.kind === "needs"
                    ? translate("map:tagNeeds", { n: status.missing })
                    : "?"
              }
            />
          </View>
        )}
        {leads > 0 && (
          <View
            style={themed($leadsBadge)}
            accessibilityLabel={translate("map:leadsBadge", { n: leads })}
          >
            <Ionicons name="arrow-forward" size={14} color={colors.palette.neutral100} />
            <Text weight="bold" style={$leadsText} text={String(leads)} />
          </View>
        )}
      </Animated.View>
    </Animated.View>
  )
})

function Junction(props: {
  node: MapNode
  rect: Box
  dim: boolean
  options: number
  /** The group is satisfied by completed courses. */
  met: boolean
}) {
  const { node, rect, dim, options, met } = props
  const { themed } = useAppTheme()
  const $dimAnimated = useDimStyle(dim)
  return (
    <Animated.View
      entering={NODE_IN}
      exiting={NODE_OUT}
      style={[$place, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
      pointerEvents="none"
    >
      <Animated.View style={[themed($junction), met && themed($junctionMet), $dimAnimated]}>
        <Text
          weight="bold"
          style={[themed($junctionText), met && themed($junctionTextMet)]}
          text={`${translate(node.kind === "any" ? "map:oneOf" : "map:allOf", { n: options })}${met ? " ✓" : ""}`}
        />
      </Animated.View>
    </Animated.View>
  )
}

// --- Bottom: selection card and legend -------------------------------------------------------

interface SelectedCardProps {
  code: string
  node: MapNode
  /** Where it sits relative to the map's course, e.g. "Direct prerequisite of COMP 3711". */
  relation: string
  isFocus: boolean
  completed: boolean
  starred: boolean
  step?: number
  loop: boolean
  /** Courses it leads to, for courses on the right-hand side (undefined elsewhere). */
  leads?: number
  term?: number
  /** Whether the student can take it, in words, with a tone for colour. */
  verdict: { tone: "done" | "ok" | "warn" | "muted"; text: string }
  onToggleCompleted: () => void
  onOpen: () => void
  onCentre: () => void
  onClose: () => void
}

function SelectedCard(props: SelectedCardProps) {
  const { code, node, isFocus, completed, starred, step, loop, leads, onOpen, onCentre } = props
  const { onClose, relation, term, verdict, onToggleCompleted } = props
  // A glance at what the course is about; the full page is one tap away.
  const description = getCourseVersion(code, term)?.description
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const course = getCourse(code)
  const facts = [
    starred && { icon: "star" as const, color: colors.star, text: translate("map:starred") },
    step && {
      icon: "trail-sign-outline" as const,
      color: colors.tint,
      text: translate("map:onPath", { n: step }),
    },
    node.otherRequirements && {
      icon: "alert-circle-outline" as const,
      color: colors.warning,
      text: translate("map:otherRequirements"),
    },
    loop && { icon: "sync-outline" as const, color: colors.warning, text: translate("map:loop") },
    leads !== undefined && {
      icon: "arrow-forward-circle-outline" as const,
      color: colors.tint,
      text: leads
        ? translate("map:leadsCount", { count: leads, n: leads })
        : translate("map:leadsNone"),
    },
  ].filter(Boolean) as { icon: "star"; color: string; text: string }[]

  return (
    <View style={themed($card)} testID="map-selected">
      <View style={$cardTop}>
        <View style={$flex}>
          <Text weight="bold" style={{ color: colors.tint }} text={code} />
          <Text
            size="xs"
            numberOfLines={2}
            style={themed($dim)}
            text={course?.title ?? translate("map:notInCatalogue")}
          />
          <View style={$relation}>
            <Ionicons name="git-commit-outline" size={14} color={colors.tint} />
            <Text size="xxs" weight="medium" style={{ color: colors.tint }} text={relation} />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate("map:close")}
          onPress={onClose}
          hitSlop={10}
        >
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Pressable>
      </View>
      <View style={[themed($verdict), themed(VERDICT_BG[verdict.tone])]} testID="map-verdict">
        <Ionicons
          name={VERDICT_ICON[verdict.tone]}
          size={16}
          color={
            verdict.tone === "done" || verdict.tone === "ok"
              ? colors.success
              : verdict.tone === "warn"
                ? colors.warning
                : colors.textDim
          }
        />
        <Text size="xxs" weight="medium" style={$flex} text={verdict.text} />
        {course && (
          <Pressable
            accessibilityRole="button"
            testID="map-toggle-completed"
            onPress={onToggleCompleted}
            hitSlop={8}
          >
            <Text
              size="xxs"
              weight="semiBold"
              style={{ color: colors.tint }}
              tx={completed ? "map:undoCompleted" : "map:markCompleted"}
            />
          </Pressable>
        )}
      </View>
      {!!description && (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={translate("map:openCourse")}
          onPress={onOpen}
          testID="map-description"
        >
          <Text size="xxs" numberOfLines={2} style={themed($preview)} text={description} />
        </Pressable>
      )}
      {facts.length > 0 && (
        <View style={$facts}>
          {facts.map((f) => (
            <View key={f.text} style={$fact}>
              <Ionicons name={f.icon} size={14} color={f.color} />
              <Text size="xxs" style={themed($dim)} text={f.text} />
            </View>
          ))}
        </View>
      )}
      {course && (
        <View style={$cardButtons}>
          <Pressable
            accessibilityRole="button"
            testID="map-open-course"
            onPress={onOpen}
            style={({ pressed }) => [themed($primary), pressed && $pressed]}
          >
            <Text
              size="xs"
              weight="semiBold"
              style={{ color: colors.palette.neutral100 }}
              tx="map:openCourse"
            />
          </Pressable>
          {!isFocus && (
            <Pressable
              accessibilityRole="button"
              testID="map-centre"
              onPress={onCentre}
              style={({ pressed }) => [themed($secondary), pressed && $pressed]}
            >
              <Ionicons name="locate-outline" size={15} color={colors.tint} />
              <Text size="xs" weight="semiBold" style={{ color: colors.tint }} tx="map:centre" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

function Legend({ showPath }: { showPath: boolean }) {
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

// --- Styles ----------------------------------------------------------------------------------

const $flex: ViewStyle = { flex: 1 }
const $fill: ViewStyle = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }
const $pressed: ViewStyle = { opacity: 0.75 }
const DIMMED = 0.22

const $bar: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xs,
  backgroundColor: colors.hero,
  zIndex: 2,
})

const $barTitle: ViewStyle = { flex: 1, alignItems: "center" }
const $barEyebrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.heroAccent,
  textTransform: "uppercase",
  letterSpacing: 1.2,
})
const $barTitleText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.onHero })

const $canvas: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.background,
  overflow: "hidden",
})

const $contentOrigin: ViewStyle = { position: "absolute", left: 0, top: 0, transformOrigin: "0 0" }

const $columnLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  position: "absolute",
  width: 280,
  textAlign: "center",
  color: colors.textDim,
  letterSpacing: 1.2,
  fontSize: 17,
  lineHeight: 24,
})

const $place: ViewStyle = { position: "absolute" }

const $node: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  flex: 1,
  flexDirection: "row",
  borderRadius: 18,
  backgroundColor: colors.surface,
  borderWidth: 1.5,
  borderColor: isDark ? colors.surfaceAlt : colors.separator,
  overflow: "visible",
  shadowColor: "#0F1C2E",
  shadowOpacity: isDark ? 0 : 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
})

const $nodeFocus: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
  shadowColor: colors.tint,
  shadowOpacity: 0.45,
  shadowRadius: 18,
})

const $nodeCompleted: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.success,
  borderWidth: 2.5,
})

const $nodeOnPath: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
  borderWidth: 3,
})

const $nodeSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.star,
  borderWidth: 4,
  shadowColor: colors.star,
  shadowOpacity: 0.5,
  shadowRadius: 16,
})

const $nodeMissing: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderStyle: "dashed",
  borderColor: colors.textDim,
  backgroundColor: colors.transparent,
})

const $stripe: ViewStyle = {
  width: 7,
  borderTopLeftRadius: 16,
  borderBottomLeftRadius: 16,
}

const $nodeBody: ViewStyle = { flex: 1, justifyContent: "center", paddingHorizontal: 14 }
const $nodeTop: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 6 }
const $nodeCode: TextStyle = { fontSize: 22, lineHeight: 30 }
const $nodeTitle: TextStyle = { fontSize: 16, lineHeight: 22 }
const $nodeExtra: TextStyle = { fontSize: 20, lineHeight: 26, fontWeight: "700" }

const $stepBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -14,
  left: -14,
  width: 30,
  height: 30,
  borderRadius: 15,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.tint,
  borderWidth: 3,
  borderColor: colors.background,
})
const $nodeCanTake: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.success,
  borderWidth: 2.5,
  borderStyle: "dashed",
})

const $statusTag: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -14,
  right: 16,
  height: 26,
  paddingHorizontal: 9,
  borderRadius: 13,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.textDim,
  borderWidth: 3,
  borderColor: colors.background,
})
const $statusOk: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.success })
const $statusWarn: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.warning })
const $statusText: TextStyle = {
  color: "#FFFFFF",
  fontSize: 12,
  lineHeight: 15,
  letterSpacing: 0.6,
}

const $junctionMet: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.success,
  backgroundColor: colors.successSoft,
})
const $junctionTextMet: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.success })

const $verdict: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 10,
  paddingVertical: 7,
  borderRadius: 10,
})
const VERDICT_BG: Record<"done" | "ok" | "warn" | "muted", ThemedStyle<ViewStyle>> = {
  done: ({ colors }) => ({ backgroundColor: colors.successSoft }),
  ok: ({ colors }) => ({ backgroundColor: colors.successSoft }),
  warn: ({ colors }) => ({ backgroundColor: colors.warningSoft }),
  muted: ({ colors }) => ({ backgroundColor: colors.surfaceAlt }),
}
const VERDICT_ICON = {
  done: "checkmark-circle",
  ok: "checkmark-circle-outline",
  warn: "alert-circle",
  muted: "information-circle-outline",
} as const

const $leadsBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  right: -18,
  top: "50%",
  marginTop: -15,
  height: 30,
  minWidth: 44,
  paddingHorizontal: 8,
  borderRadius: 15,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  backgroundColor: colors.tint,
  borderWidth: 3,
  borderColor: colors.background,
})
const $leadsText: TextStyle = { color: "#FFFFFF", fontSize: 14, lineHeight: 18 }

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

const $stepText: TextStyle = { color: "#FFFFFF", fontSize: 14, lineHeight: 18 }

const $junction: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  backgroundColor: colors.background,
  borderWidth: 2,
  borderColor: colors.tint,
})
const $junctionText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 13,
  lineHeight: 16,
  letterSpacing: 0.8,
})

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

const $keyArea: ViewStyle = { gap: 10, alignItems: "flex-start" }

const $relation: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }

const $tip: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignSelf: "center",
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 14,
  paddingVertical: 9,
  borderRadius: 18,
  backgroundColor: colors.hero,
})
const $tipText: TextStyle = { color: "#FFFFFF" }

const $roundButtonOn: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.tint })

const $zoomButtons: ViewStyle = { position: "absolute", right: 14, top: 12, gap: 10 }

const $roundButton: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  width: 42,
  height: 42,
  borderRadius: 21,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: isDark ? colors.surfaceAlt : colors.surface,
  shadowColor: "#0F1C2E",
  shadowOpacity: isDark ? 0 : 0.14,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
})

const $bottom: ViewStyle = { position: "absolute", left: 12, right: 12, bottom: 0 }

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  padding: spacing.md,
  gap: spacing.sm,
  borderRadius: 20,
  backgroundColor: isDark ? colors.surfaceAlt : colors.surface,
  shadowColor: "#0F1C2E",
  shadowOpacity: isDark ? 0 : 0.16,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
})
const $preview: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text, lineHeight: 18 })

const $cardTop: ViewStyle = { flexDirection: "row", gap: 10 }
const $facts: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 10 }
const $fact: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 4 }
const $cardButtons: ViewStyle = { flexDirection: "row", gap: 8 }

const $primary: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  height: 42,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.tint,
})
const $secondary: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  height: 42,
  borderRadius: 12,
  flexDirection: "row",
  gap: 6,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1.5,
  borderColor: colors.tint,
})

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

const $emptyNote: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  position: "absolute",
  top: "58%",
  left: spacing.xl,
  right: spacing.xl,
  alignItems: "center",
})

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
