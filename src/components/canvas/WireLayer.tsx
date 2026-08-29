import type { CanvasNode, PendingWire, Wire } from '../../types'
import type { Dispatch, SetStateAction } from 'react'

const PORT_R = 5
const WIRE_CLR = '#8A8A86'

export interface WireSnap { nodeId:string; portId:string; x:number; y:number; color:string }
export interface EdgeSnap { nodeId:string; yRel:number; x:number; y:number; color:string; isInput:boolean }

export function WireLayer({ nodes, wires, hoveredWire, onHoverWire, onDeleteWire, wireLabel, whyChangedTip, pendingWire, snapTarget, edgeSnap }: {
  nodes: CanvasNode[]
  wires: Wire[]
  hoveredWire: string | null
  onHoverWire: Dispatch<SetStateAction<string | null>>
  onDeleteWire: (wireId:string, fromNodeId:string, fromYRel:number, toNodeId:string, toYRel:number) => void
  wireLabel: (raw:string|undefined) => string|undefined
  whyChangedTip: string
  pendingWire: PendingWire | null
  snapTarget: WireSnap | null
  edgeSnap: EdgeSnap | null
}) {
  return (
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}>
          <defs>
            {['#3BBDAF','#F5A523','#6B6EF5','#9B7EFF','#F06090','#7A7A78'].map(c => (
              <filter key={c} id={`glow-${c.replace('#','')}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            ))}
          </defs>

          {wires.map(wire => {
            const fn = nodes.find(n => n.id === wire.fromNodeId)
            const tn = nodes.find(n => n.id === wire.toNodeId)
            if (!fn?.visible || !tn?.visible) return null
            const fp = fn.outputs.find(p => p.id === wire.fromPortId)
            const tp = tn.inputs.find(p => p.id === wire.toPortId)
            if (!fp || !tp) return null
            const sx = fn.x+fn.w, sy = fn.y+fp.yRel
            const ex = tn.x,      ey = tn.y+tp.yRel
            const cx = (sx+ex)/2
            const mx = (sx+ex)/2, my = (sy+ey)/2
            const isHovered = hoveredWire === wire.id
            return (
              <g key={wire.id} style={{ pointerEvents:'auto' }}>
                {/* 删除在 pointerdown 阶段完成，避免画布拖拽手势取消后续 click。 */}
                <path d={`M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}`}
                  fill="none" stroke="transparent" strokeWidth={24}
                  data-wire-delete-target={wire.id}
                  style={{ pointerEvents:'stroke', cursor:'pointer' }}
                  onMouseEnter={()=>onHoverWire(wire.id)}
                  onMouseLeave={()=>onHoverWire(prev=>prev===wire.id?null:prev)}
                  onPointerDown={e=>{
                    e.preventDefault()
                    e.stopPropagation()
                    onDeleteWire(wire.id, fn.id, fp.yRel, tn.id, tp.yRel)
                  }}>
                  {wire.label && <title>{`${whyChangedTip} · ${wireLabel(wire.label)}`}</title>}
                </path>
                {/* 视觉线：默认灰色，悬停变亮并提示可删 */}
                <path d={`M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}`}
                  fill="none" stroke={isHovered ? '#E06A5A' : WIRE_CLR} strokeWidth={isHovered?2.6:1.5} opacity={isHovered?0.92:0.55}
                  style={{ pointerEvents:'none', transition:'stroke 0.14s, opacity 0.14s' }}/>
                {/* 悬停时中点出现“×”提示点击取消 */}
                {isHovered && (
                  <g style={{ pointerEvents:'none' }}>
                    <circle cx={mx} cy={my} r={10} fill="#1A1A19" stroke={isHovered?'#E06A5A':WIRE_CLR} strokeWidth={1.2} opacity={0.96}/>
                    <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#E06A5A" fontWeight={700} style={{ fontFamily:"'Inter',sans-serif" }}>×</text>
                  </g>
                )}
                {/* 关系语义标签（Inspired by / Preserve / Branch from …） */}
                {wire.label && !isHovered && (
                  <text x={mx} y={my - 14} textAnchor="middle" fontSize={8.5}
                    fill="#55554F" fontWeight={600}
                    style={{ pointerEvents:'none', fontFamily:"'Inter',sans-serif", letterSpacing:'0.02em' }}>{wireLabel(wire.label)}</text>
                )}
                {fn.type !== 'frame' && fn.type !== 'audioFolder' && (
                  <circle cx={sx} cy={sy} r={PORT_R} fill={isHovered?'#E06A5A':WIRE_CLR} opacity={isHovered?0.95:0.75} style={{ transition:'fill 0.14s' }}/>
                )}
                <circle cx={ex} cy={ey} r={PORT_R} fill={isHovered?'#E06A5A':WIRE_CLR} opacity={isHovered?0.95:0.75} style={{ transition:'fill 0.14s' }}/>
              </g>
            )
          })}

          {pendingWire && (() => {
            const snap = snapTarget ?? edgeSnap
            let sx: number, sy: number, ex: number, ey: number
            if (pendingWire.isOutput) {
              sx = pendingWire.startX; sy = pendingWire.startY
              ex = snap?.x ?? pendingWire.mouseX
              ey = snap?.y ?? pendingWire.mouseY
            } else {
              sx = snap?.x ?? pendingWire.mouseX
              sy = snap?.y ?? pendingWire.mouseY
              ex = pendingWire.startX; ey = pendingWire.startY
            }
            const cx = (sx+ex)/2
            const snapped = !!snap
            return (
              <>
                <path d={`M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}`}
                  fill="none" stroke={pendingWire.color} strokeWidth={snapped?2.5:2}
                  strokeDasharray={snapped?'none':'6,4'} opacity={snapped?0.9:0.65}
                  style={{ filter:snapped?`drop-shadow(0 0 6px ${pendingWire.color}80)`:undefined }}/>
                <circle cx={sx} cy={sy} r={PORT_R} fill={pendingWire.color} opacity={0.95}/>
              </>
            )
          })()}
        </svg>

  )
}
