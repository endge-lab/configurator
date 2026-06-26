export const NodeEventNames = {
  click: 'click',
  dblclick: 'dblclick',
  contextmenu: 'contextmenu',
  mousemove: 'mousemove',
  mousedown: 'mousedown',
  mouseup: 'mouseup',
  canvasenter: 'canvasenter',
  canvasleave: 'canvasleave',
  wheel: 'wheel',
  keydown: 'keydown',
  keyup: 'keyup',

  mouseenter: 'mouseenter',
  mouseleave: 'mouseleave',
  doubleClick: 'dblclick',
  zoom: 'zoom',
  dragStart: 'mousedown',
  dragEnd: 'mouseup',
  dragMove: 'mousemove',
} as const

export type NodeEventName = keyof typeof NodeEventNames
export type DomEventName =
  | 'click'
  | 'dblclick'
  | 'contextmenu'
  | 'mousemove'
  | 'mousedown'
  | 'mouseup'
  | 'wheel'
  | 'zoom'
  | 'keydown'
  | 'keyup'
  | 'mouseenter'
  | 'mouseleave'

export const CanvasDomEvents: DomEventName[] = [
  'click',
  'contextmenu',
  'mousemove',
  'mousedown',
  'mouseenter',
  'mouseleave',
  'mouseup',
  'wheel',
  'zoom',
  'keydown',
  'keyup',
]

// Базовые DOM-обработчики
export interface CanvasEventHandlers {
  click?: (e: MouseEvent) => void
  dblclick?: (e: MouseEvent) => void
  contextmenu?: (e: MouseEvent) => void
  mousemove?: (e: MouseEvent) => void
  mousedown?: (e: MouseEvent) => void
  mouseup?: (e: MouseEvent) => void
  wheel?: (e: WheelEvent) => void
  keydown?: (e: KeyboardEvent) => void
  keyup?: (e: KeyboardEvent) => void
}

// Расширенные события для NovaNode
export interface NovaNodeEventHandlers extends CanvasEventHandlers {
  mouseenter?: (e: MouseEvent) => void
  mouseleave?: (e: MouseEvent) => void
  canvasenter?: (e: MouseEvent) => void
  canvasleave?: (e: MouseEvent) => void

  zoom?: (e: WheelEvent) => void
  hover?: (e: MouseEvent, isHover: boolean) => void
  dragstart?: (e: MouseEvent, meta: { startX: number; startY: number }) => void
  dragend?: (e: MouseEvent) => void
  dragmove?: (e: MouseEvent, dx: number, dy: number) => void
}
