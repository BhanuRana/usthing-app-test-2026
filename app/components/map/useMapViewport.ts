import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { Gesture } from "react-native-gesture-handler"
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"

import type { Box } from "./MapNodes"

/**
 * Zoom never goes above 1: content is drawn large and scaled down, because scaling a view
 * *up* on iOS scales a bitmap and blurs text.
 */
export const MAX_ZOOM = 1
const ABS_MIN_ZOOM = 0.1
export const EASE = { duration: 380, easing: Easing.out(Easing.cubic) }
/** How much of the map (in points) always stays on screen when panning. */
const KEEP = 120

/** Where the content sits: `x`, `y` is its top-left on screen, `s` its scale. */
export type Transform = { s: number; x: number; y: number }

interface ViewportOptions {
  /** The content's size, in content points. */
  content: { w: number; h: number }
  /** The content's origin in layout units; when it moves, the pan follows (see below). */
  origin: { x: number; y: number }
  viewport: { w: number; h: number }
  /** Space kept clear of floating controls at the top and the card or key at the bottom. */
  inset: { top: number; bottom: number }
  /** A single tap, in content points. */
  onTap: (x: number, y: number) => void
}

/**
 * The map's pan and zoom: one gesture detector for pan (with momentum that keeps part of the
 * map on screen), pinch around the fingers, double-tap to zoom, and tap. Taps are reported in
 * content points, so the screen hit-tests against its own layout.
 */
export function useMapViewport({ content, origin, viewport, inset, onTap }: ViewportOptions) {
  const scale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const minZoom = useSharedValue(ABS_MIN_ZOOM)

  // A new column can grow the map up or left, which moves the content origin. Shift the pan
  // by the same amount before the frame is drawn, so nothing on screen jumps.
  const originRef = useRef(origin)
  useLayoutEffect(() => {
    const prev = originRef.current
    if (prev.x === origin.x && prev.y === origin.y) return
    tx.value = tx.value + (origin.x - prev.x) * scale.value
    ty.value = ty.value + (origin.y - prev.y) * scale.value
    originRef.current = origin
  })

  const moveTo = useCallback(
    (t: Transform, animated = true) => {
      scale.value = animated ? withTiming(t.s, EASE) : t.s
      tx.value = animated ? withTiming(t.x, EASE) : t.x
      ty.value = animated ? withTiming(t.y, EASE) : t.y
    },
    [scale, tx, ty],
  )

  /** The whole map, as large as fits (never above 100%). */
  const fitTransform = useCallback((): Transform => {
    const availW = viewport.w - 24
    const availH = viewport.h - inset.top - inset.bottom
    const s = Math.min(MAX_ZOOM, availW / content.w, availH / content.h)
    return { s, x: (viewport.w - content.w * s) / 2, y: inset.top + (availH - content.h * s) / 2 }
  }, [viewport, content.w, content.h, inset.top, inset.bottom])

  // The fitted zoom (or 0.35, if that's smaller) is as far out as pinching goes.
  useEffect(() => {
    if (viewport.w) minZoom.value = Math.max(ABS_MIN_ZOOM, Math.min(fitTransform().s, 0.35))
  }, [viewport.w, fitTransform, minZoom])

  /** A region fitted into the free part of the viewport, no smaller than `atLeast`. */
  const frameRegion = useCallback(
    (r: Box, atLeast: number): Transform => {
      const availW = viewport.w - 24
      const availH = viewport.h - inset.top - inset.bottom
      const s = Math.max(atLeast, Math.min(MAX_ZOOM, availW / r.w, availH / r.h))
      return {
        s,
        x: viewport.w / 2 - (r.x + r.w / 2) * s,
        y: inset.top + availH / 2 - (r.y + r.h / 2) * s,
      }
    },
    [viewport, inset.top, inset.bottom],
  )

  /** A rectangle centred at scale `s`, above `below` points kept clear at the bottom. */
  const centreOnRect = useCallback(
    (r: Box, s: number, below: number = inset.bottom): Transform => {
      const availH = viewport.h - inset.top - below
      return {
        s,
        x: viewport.w / 2 - (r.x + r.w / 2) * s,
        y: inset.top + availH / 2 - (r.y + r.h / 2) * s,
      }
    },
    [viewport, inset.top, inset.bottom],
  )

  /** Zooms by `factor` around the middle of the screen. */
  const zoomBy = useCallback(
    (factor: number) => {
      const s0 = scale.value
      const s = Math.min(MAX_ZOOM, s0 * factor)
      const cx = (viewport.w / 2 - tx.value) / s0
      const cy = (viewport.h / 2 - ty.value) / s0
      moveTo({ s, x: viewport.w / 2 - cx * s, y: viewport.h / 2 - cy * s })
    },
    [scale, tx, ty, viewport, moveTo],
  )

  // --- Gestures ---

  const extent = useSharedValue({ w: 0, h: 0, vw: 0, vh: 0 })
  useEffect(() => {
    extent.value = { w: content.w, h: content.h, vw: viewport.w, vh: viewport.h }
  }, [content.w, content.h, viewport.w, viewport.h, extent])

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

  // Double-tap zooms in 2x around the finger; at full zoom it goes back out.
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

  // No maxDuration: a single tap waits to rule out a double-tap, and a limit would expire.
  const tap = Gesture.Tap().onEnd((e) => {
    scheduleOnRN(onTap, (e.x - tx.value) / scale.value, (e.y - ty.value) / scale.value)
  })

  const gesture = Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, tap))

  const $contentAnimated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }))

  return {
    scale,
    gesture,
    $contentAnimated,
    moveTo,
    fitTransform,
    fit: () => moveTo(fitTransform()),
    frameRegion,
    centreOnRect,
    zoomBy,
  }
}
