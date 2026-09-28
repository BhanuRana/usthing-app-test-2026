import type { Box } from "./MapNodes"

/**
 * The SVG for one edge: a curve out of the right side of `from` into the left side of `to`,
 * ending in an arrowhead (the line stops at the arrow's base). A loop edge points backwards,
 * so it arcs over the top instead.
 */
export function edgeGeometry(from: Box, to: Box, loop: boolean, width: number) {
  const head = { l: 8 + width * 1.6, w: 4 + width }
  const x1 = from.x + from.w
  const y1 = from.y + from.h / 2
  const x2 = to.x
  const y2 = to.y + to.h / 2
  const end = x2 - head.l + 1
  let line: string
  if (loop) {
    const lift = Math.max(from.h, to.h) * 1.4
    line = `M ${x1} ${y1} C ${x1 + 120} ${y1 - lift}, ${end - 120} ${y2 - lift}, ${end} ${y2}`
  } else {
    const dx = Math.max(40, (end - x1) * 0.5)
    line = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${end - dx} ${y2}, ${end} ${y2}`
  }
  const arrow = `M ${x2 - head.l} ${y2 - head.w} L ${x2} ${y2} L ${x2 - head.l} ${y2 + head.w} Z`
  return { line, arrow }
}
