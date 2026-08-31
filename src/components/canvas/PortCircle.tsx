import { useState } from 'react'
import type { Port } from '../../types'
import { useLang } from '../../App'

export function PortCircle({ port, isInput, visible, isSnapTarget, onPointerDown }: {
  port: Port; isInput: boolean; visible: boolean; isSnapTarget: boolean; onPointerDown: (e: React.PointerEvent) => void
}) {
  const s=useLang()
  const [hov, setHov] = useState(false)
  const opacity = !visible ? 0 : (isSnapTarget || hov ? 1 : 0.72)
  return (
    <div
      data-port="true"
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHov(true)}
      onPointerLeave={() => setHov(false)}
      title={port.label + (isSnapTarget ? (s.langToggle==='EN'?' · 松开以连接':' · Release to connect') : '')}
      style={{
        position:'absolute',
        left: isInput ? -8 : undefined,
        right: isInput ? undefined : -8,
        top: port.yRel - 22,
        width:16, height:44,
        background:'transparent', border:0,
        cursor:'crosshair', zIndex:20,
        opacity,
        pointerEvents: visible ? 'auto' as const : 'none' as const,
        transition:'opacity 0.2s ease',
      }}
    >
      <span aria-hidden="true" style={{ position:'absolute', top:0, bottom:0,
        ...(isInput ? { right:8, width:20 } : { left:8, width:20 }), overflow:'hidden', pointerEvents:'none' }}>
        <span style={{ position:'absolute', top:7, bottom:7, width:isSnapTarget?3:2,
          ...(isInput ? { right:0 } : { left:0 }), borderRadius:2,
          background:`linear-gradient(to bottom, transparent, ${port.color} 27%, ${port.color} 73%, transparent)`,
          boxShadow:`0 0 ${isSnapTarget?11:8}px ${port.color}, 0 0 ${isSnapTarget?22:16}px ${port.color}${isSnapTarget?'CC':'88'}` }}/>
      </span>
    </div>
  )
}
