import { useEffect, useRef } from 'react'
import type { CanvasNode } from '../../types'

export function LyricsResizeHandle({ node, onUpdateNodeSize }: {
  node: CanvasNode
  onUpdateNodeSize: (id: string, w: number, h: number) => void
}) {
  const resizeRef = useRef<{ pointerId:number; startY:number; startH:number; scaleY:number } | null>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => resizeCleanupRef.current?.(), [])

  return (
    <button
      type="button"
      aria-label="调整歌词窗口高度"
      data-lyrics-resize-handle="1"
      title="上下拖动调整歌词窗口高度"
      onPointerDown={e => {
        e.stopPropagation()
        const host = e.currentTarget.closest('[data-node]') as HTMLElement | null
        const rect = host?.getBoundingClientRect()
        const drag = {
          pointerId:e.pointerId,
          startY:e.clientY,
          startH:node.h,
          scaleY:rect?.height ? node.h / rect.height : 1,
        }
        resizeCleanupRef.current?.()
        resizeRef.current = drag
        const applySize = (event: PointerEvent) => {
          if (resizeRef.current?.pointerId !== event.pointerId) return
          event.preventDefault()
          onUpdateNodeSize(
            node.id,
            node.w,
            Math.max(280, drag.startH + (event.clientY - drag.startY) * drag.scaleY),
          )
        }
        const cleanup = () => {
          window.removeEventListener('pointermove', applySize)
          window.removeEventListener('pointerup', finishResize)
          window.removeEventListener('pointercancel', finishResize)
          resizeRef.current = null
          resizeCleanupRef.current = null
        }
        const finishResize = (event: PointerEvent) => {
          if (resizeRef.current?.pointerId !== event.pointerId) return
          applySize(event)
          cleanup()
        }
        window.addEventListener('pointermove', applySize, { passive:false })
        window.addEventListener('pointerup', finishResize)
        window.addEventListener('pointercancel', finishResize)
        resizeCleanupRef.current = cleanup
      }}
      style={{
        position:'absolute', left:'50%', bottom:-14, zIndex:55,
        width:48, height:14, padding:0, border:0, cursor:'ns-resize', touchAction:'none',
        transform:'translateX(-50%)', borderRadius:7,
        background:'transparent', display:'grid', placeItems:'center',
      }}
    >
      <span aria-hidden="true" style={{ width:24, height:2, borderRadius:2, background:'#77716F', boxShadow:'0 1px 4px rgba(0,0,0,.45)', pointerEvents:'none' }}/>
    </button>
  )
}
