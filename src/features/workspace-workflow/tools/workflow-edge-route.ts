import type { WorkflowPoint } from '../domain/WorkspaceWorkflow'

export interface WorkflowObstacle extends WorkflowPoint { id: string, width: number, height: number }

const CLEARANCE = 12
const PORT_GAP = 24

/** Выбирает короткий ортогональный маршрут по текущим границам блоков, включая drag. */
export function routeWorkflowEdge(
  source: WorkflowPoint,
  target: WorkflowPoint,
  sourceId: string,
  targetId: string,
  vertical: boolean,
  obstacles: WorkflowObstacle[],
): WorkflowPoint[] {
  // Store выходит вниз; поворот осей позволяет использовать тот же поиск коридоров.
  const orient = (point: WorkflowPoint): WorkflowPoint => vertical ? { x: point.y, y: point.x } : point
  const start = orient(source)
  const finish = orient(target)
  const boxes = obstacles.map((box) => {
    const point = orient(box)
    return {
      id: box.id,
      left: point.x - CLEARANCE,
      right: point.x + (vertical ? box.height : box.width) + CLEARANCE,
      top: point.y - CLEARANCE,
      bottom: point.y + (vertical ? box.width : box.height) + CLEARANCE,
    }
  })
  const exit = { x: start.x + PORT_GAP, y: start.y }
  const entry = { x: finish.x - PORT_GAP, y: finish.y }
  const crosses = (a: WorkflowPoint, b: WorkflowPoint, ignoredId?: string): number => boxes.filter(box =>
    box.id !== ignoredId && (a.y === b.y
      ? a.y > box.top && a.y < box.bottom && Math.max(a.x, b.x) > box.left && Math.min(a.x, b.x) < box.right
      : a.x > box.left && a.x < box.right && Math.max(a.y, b.y) > box.top && Math.min(a.y, b.y) < box.bottom)).length
  let best = [start, exit, { x: exit.x, y: entry.y }, entry, finish]
  let bestScore = Infinity
  let clear = false
  const consider = (middle: WorkflowPoint[]): void => {
    const points = [start, ...middle, finish].filter((point, index, all) =>
      index === 0 || point.x !== all[index - 1]!.x || point.y !== all[index - 1]!.y)
    let collisions = 0
    let length = 0
    let bends = 0
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1]!
      const b = points[index]!
      collisions += crosses(a, b, index === 1 ? sourceId : index === points.length - 1 ? targetId : undefined)
      length += Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
      if (index > 1 && (a.x === b.x) !== (points[index - 2]!.x === a.x)) {
        bends++
      }
    }
    const score = collisions * 1e9 + length + bends * 20
    if (score < bestScore) {
      best = points
      bestScore = score
      clear = collisions === 0
    }
  }
  const xs = [...new Set([(exit.x + entry.x) / 2, exit.x, entry.x, ...boxes.flatMap(box => [box.left, box.right])])]
  const shortestScore = Math.abs(start.x - finish.x) + Math.abs(start.y - finish.y) + (start.y === finish.y ? 0 : 40)
  for (const x of xs) {
    consider([exit, { x, y: exit.y }, { x, y: entry.y }, entry])
    if (clear && bestScore <= shortestScore) {
      break
    }
  }
  if (!clear) {
    const ys = [...new Set([(exit.y + entry.y) / 2, ...boxes.flatMap(box => [box.top, box.bottom])])]
    const exits = xs.filter(x => !crosses(exit, { x, y: exit.y }))
      .sort((a, b) => Math.abs(a - exit.x) - Math.abs(b - exit.x))
      .slice(0, 3)
    const entries = xs.filter(x => !crosses(entry, { x, y: entry.y }))
      .sort((a, b) => Math.abs(a - entry.x) - Math.abs(b - entry.x))
      .slice(0, 3)
    for (const exitX of exits) {
      for (const entryX of entries) {
        for (const y of ys) {
          consider([exit, { x: exitX, y: exit.y }, { x: exitX, y }, { x: entryX, y }, { x: entryX, y: entry.y }, entry])
        }
      }
    }
  }
  return best.map(orient).filter((point, index, all) => {
    const before = all[index - 1]
    const after = all[index + 1]
    return !before || !after
      || !((before.x === point.x && point.x === after.x && (point.y - before.y) * (after.y - point.y) >= 0)
        || (before.y === point.y && point.y === after.y && (point.x - before.x) * (after.x - point.x) >= 0))
  })
}
