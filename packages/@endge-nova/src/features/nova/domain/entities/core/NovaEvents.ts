import type { NovaNode } from '@/features/nova/domain/entities/core/NovaNode'
import type { NovaNodeEventHandlers } from '@/features/nova/domain/types/events-types'
import type { NovaApp } from '@/features/nova/domain/entities/app/NovaApp'
import type { EventList } from '@/features/@utils/events/EventBus'

export class NovaEvents<E extends EventList> {
  interactiveNodes: Set<NovaNode<E>> = new Set()
  hoveredNodes: Set<NovaNode<E>> = new Set()
  draggedNodes: Set<NovaNode<E>> = new Set()

  isDragging = false
  isDraggingEmitted = false
  lastClickTime = 0
  clickTimeout: number | null = null

  startMouseX = 0
  startMouseY = 0
  lastMouseX = 0
  lastMouseY = 0
  mouseX = 0
  mouseY = 0

  clickTimeoutMs = 250

  private _mouseMoveQueued = false
  private _lastMouseMoveEvent: MouseEvent | null = null

  constructor(public readonly app: NovaApp<E>) {}

  handle(type: keyof NovaNodeEventHandlers, event: Event): boolean {
    if (this.interactiveNodes.size === 0) return false

    switch (type) {
      case 'mousedown':
        return this.onMouseDown(event as MouseEvent)
      case 'mousemove':
        return this.onMouseMove(event as MouseEvent)
      case 'mouseup':
        return this.onMouseUp(event as MouseEvent)
      case 'wheel':
        return this.onWheel(event as WheelEvent)
      case 'contextmenu':
        return this.onContextMenu(event as MouseEvent)
      case 'keydown':
        return this.onKeyDown(event as KeyboardEvent)
      case 'keyup':
        return this.onKeyUp(event as KeyboardEvent)
      case 'mouseenter':
        return this.onCanvasEnter(event as MouseEvent)
      case 'mouseleave':
        return this.onCanvasLeave(event as MouseEvent)
      default:
        return false
    }
  }

  // Css координаты
  getCanvasMousePosition(event: MouseEvent): { x: number; y: number } {
    const rect = this.app.canvas.element.getBoundingClientRect()
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top

    return {
      x: cssX,
      y: cssY,
    }
  }

  private onMouseDown(event: MouseEvent): boolean {
    if (event.cancelBubble) return false

    this.isDragging = true
    const { x, y } = this.getCanvasMousePosition(event)
    this.startMouseX = x
    this.startMouseY = y
    this.mouseX = x
    this.mouseY = y

    this.draggedNodes.clear()
    for (const node of this.interactiveNodes) {
      if (node.active && node.containsPoint(x, y)) {
        this.draggedNodes.add(node)
        node.eventHandlers['mousedown']?.(event)
        if (event.cancelBubble) break
      }
    }
    return true
  }

  private onMouseMove(event: MouseEvent): boolean {
    if (event.cancelBubble) return false

    this._lastMouseMoveEvent = event

    if (!this._mouseMoveQueued) {
      this._mouseMoveQueued = true
      requestAnimationFrame(() => {
        this._mouseMoveQueued = false
        if (this._lastMouseMoveEvent) {
          this._handleMouseMove(this._lastMouseMoveEvent)
        }
      })
    }

    return true
  }

  private _handleMouseMove(event: MouseEvent): boolean {
    if (event.cancelBubble) return false

    const { x, y } = this.getCanvasMousePosition(event)
    this.mouseX = x
    this.mouseY = y
    const dx = this.mouseX - this.lastMouseX
    const dy = this.mouseY - this.lastMouseY
    this.lastMouseX = x
    this.lastMouseY = y

    if (this.isDragging && this.draggedNodes.size > 0) {
      if (!this.isDraggingEmitted) {
        for (const node of this.draggedNodes) {
          node.eventHandlers['dragstart']?.(event, {
            startX: this.startMouseX,
            startY: this.startMouseY,
          })
          if (event.cancelBubble) break
        }
        this.isDraggingEmitted = true
      }
      for (const node of this.draggedNodes) {
        node.eventHandlers['dragmove']?.(event, dx, dy)
        if (event.cancelBubble) break
      }
      return true
    }

    const newHovered = new Set<NovaNode<E>>()
    for (const node of this.interactiveNodes) {
      if (!node.active) continue

      if (node.containsPoint(x, y)) {
        if (!this.hoveredNodes.has(node)) {
          node.eventHandlers['mouseenter']?.(event)
          if (event.cancelBubble) break
        }
        node.eventHandlers['mousemove']?.(event)
        if (event.cancelBubble) break

        newHovered.add(node)
      } else if (this.hoveredNodes.has(node)) {
        node.eventHandlers['mouseleave']?.(event)
        if (event.cancelBubble) break
      }
    }
    this.hoveredNodes = newHovered
    return true
  }

  private onMouseUp(event: MouseEvent): boolean {
    if (event.cancelBubble) return false

    if (this.isDraggingEmitted && this.draggedNodes.size > 0) {
      for (const node of this.draggedNodes) {
        node.eventHandlers['dragend']?.(event)
        if (event.cancelBubble) break
      }
    }
    this.isDragging = false
    this.isDraggingEmitted = false
    this.draggedNodes.clear()

    for (const node of this.interactiveNodes) {
      if (node.active) {
        node.eventHandlers['mouseup']?.(event)
        if (event.cancelBubble) break
      }
    }

    if (
      Math.abs(this.startMouseX - this.mouseX) <= 2 &&
      Math.abs(this.startMouseY - this.mouseY) <= 2 &&
      event.button === 0
    ) {
      const now = Date.now()
      const isDoubleClick = now - this.lastClickTime < this.clickTimeoutMs
      this.lastClickTime = now

      const x = this.mouseX
      const y = this.mouseY

      if (isDoubleClick) {
        if (this.clickTimeout) {
          clearTimeout(this.clickTimeout)
          this.clickTimeout = null
        }
        for (const node of this.interactiveNodes) {
          if (node.active && node.containsPoint(x, y)) {
            node.eventHandlers['dblclick']?.(event)
            if (event.cancelBubble) break
          }
        }
      } else {
        this.clickTimeout = window.setTimeout(() => {
          for (const node of this.interactiveNodes) {
            if (node.active && node.containsPoint(x, y)) {
              node.eventHandlers['click']?.(event)
              if (event.cancelBubble) break
            }
          }
          this.clickTimeout = null
        }, this.clickTimeoutMs)
      }
    }

    return true
  }

  private onWheel(event: WheelEvent): boolean {
    event.preventDefault()

    if (event.cancelBubble) return false

    if (event.ctrlKey || event.metaKey) {
      for (const node of this.interactiveNodes) {
        if (node.active && node.eventHandlers['zoom']) {
          node.eventHandlers['zoom']?.(event)
          if (event.cancelBubble) break
        }
      }
      return true
    }

    for (const node of this.interactiveNodes) {
      if (node.active) {
        node.eventHandlers['wheel']?.(event)
        if (event.cancelBubble) break
      }
    }
    return true
  }

  private onContextMenu(event: MouseEvent): boolean {
    if (event.cancelBubble) return false

    for (const node of this.interactiveNodes) {
      if (node.active) {
        node.eventHandlers['contextmenu']?.(event)
        if (event.cancelBubble) break
      }
    }
    return true
  }

  private onKeyDown(event: KeyboardEvent): boolean {
    if (event.cancelBubble || event.repeat) return false

    for (const node of this.interactiveNodes) {
      if (node.active) {
        node.eventHandlers['keydown']?.(event)
        if (event.cancelBubble) break
      }
    }
    return true
  }

  private onKeyUp(event: KeyboardEvent): boolean {
    if (event.cancelBubble) return false

    for (const node of this.interactiveNodes) {
      if (node.active) {
        node.eventHandlers['keyup']?.(event)
        if (event.cancelBubble) break
      }
    }
    return true
  }

  private onCanvasEnter(event: MouseEvent): boolean {
    this.isDragging = false
    this.isDraggingEmitted = false
    this.hoveredNodes.clear()
    this.draggedNodes.clear()

    const { x, y } = this.getCanvasMousePosition(event)
    this.mouseX = x
    this.mouseY = y
    this.lastMouseX = x
    this.lastMouseY = y

    if (event.cancelBubble) return false

    for (const node of this.interactiveNodes) {
      if (node.active) {
        node.eventHandlers['canvasenter']?.(event)
        if (event.cancelBubble) break
      }
    }
    return true
  }

  private onCanvasLeave(event: MouseEvent): boolean {
    this.isDragging = false
    this.isDraggingEmitted = false
    this.hoveredNodes.clear()
    this.draggedNodes.clear()

    if (event.cancelBubble) return false

    for (const node of this.interactiveNodes) {
      if (node.active) {
        node.eventHandlers['canvasleave']?.(event)
        if (event.cancelBubble) break
      }
    }
    return true
  }
}
