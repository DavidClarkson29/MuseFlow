import { useRef } from 'react'
import type { CanvasNode } from '../../types'

export interface NodeDragState { id:string; sx:number; sy:number; nx:number; ny:number }

export function useNodeDrag() {
  const dragRef = useRef<NodeDragState | null>(null)
  const clickRef = useRef<{ id:string; time:number } | null>(null)

  const beginDrag = (node: CanvasNode, clientX:number, clientY:number) => {
    dragRef.current = { id:node.id, sx:clientX, sy:clientY, nx:node.x, ny:node.y }
  }
  const positionAt = (clientX:number, clientY:number, zoom:number) => {
    const active = dragRef.current
    return active ? {
      id: active.id,
      x: active.nx + (clientX-active.sx)/zoom,
      y: active.ny + (clientY-active.sy)/zoom,
    } : null
  }
  const clearDrag = () => { dragRef.current = null }

  return { dragRef, clickRef, beginDrag, positionAt, clearDrag }
}
