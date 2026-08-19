import { useRef, useState, useCallback, useEffect } from 'react'
import type { CanvasNode, Wire, PendingWire, Port } from '../types'
import { useLang } from '../App'

const PORT_R = 5
const HIT_R  = 14
const WIRE_CLR = '#8A8A86'

interface Props {
  nodes: CanvasNode[]
  wires: Wire[]
  isGenerating: boolean
  onSelectNode: (id: string | null) => void
  onOpenInspector: (id: string) => void
  onUpdatePosition: (id: string, x: number, y: number) => void
  onAddWire: (wire: Wire) => void
  onRemoveWire: (wireId: string) => void
  onGenerate: (nodeId: string) => void
  onExport: () => void
}

export default function Canvas({
  nodes, wires, isGenerating,
  onSelectNode, onOpenInspector,
  onUpdatePosition, onAddWire, onRemoveWire,
  onGenerate, onExport,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragRef  = useRef<{ id:string; sx:number; sy:number; nx:number; ny:number } | null>(null)
  const panRef   = useRef<{ sx:number; sy:number; px:number; py:number } | null>(null)
  const clickRef = useRef<{ id:string; time:number } | null>(null)
  const touchRef = useRef<{ dist:number; zoom:number; px:number; py:number } | null>(null)

  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(60)
  const [panY, setPanY] = useState(40)
  const [pendingWire, setPendingWire] = useState<PendingWire | null>(null)

  const visibleNodes = nodes.filter(n => n.visible)

  const applyZoom = useCallback((newZ: number, fx: number, fy: number) => {
    newZ = Math.min(3, Math.max(0.12, newZ))
    setZoom(prev => {
      const ratio = newZ / prev
      setPanX(px => fx - (fx - px) * ratio)
      setPanY(py => fy - (fy - py) * ratio)
      return newZ
    })
  }, [])

  useEffect(() => {
    const el = outerRef.current!
    const onWheel = (e: WheelEvent) => {
      // Let scrollable node content (e.g. explore panel) scroll naturally
      const target = e.target as HTMLElement
      if (target.closest('.explore-scroll')) return
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93), e.clientX - r.left, e.clientY - r.top)
      } else {
        setPanX(px => px - e.deltaX)
        setPanY(py => py - e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, applyZoom])

  function getTouchDist(t: React.TouchList) {
    const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY
    return Math.sqrt(dx*dx + dy*dy)
  }
  function getTouchMid(t: React.TouchList, r: DOMRect) {
    return { x:(t[0].clientX+t[1].clientX)/2-r.left, y:(t[0].clientY+t[1].clientY)/2-r.top }
  }
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const r = outerRef.current!.getBoundingClientRect()
      const m = getTouchMid(e.touches, r)
      touchRef.current = { dist:getTouchDist(e.touches), zoom, px:m.x, py:m.y }
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault()
      const newDist = getTouchDist(e.touches)
      const newZoom = Math.min(3, Math.max(0.12, touchRef.current.zoom * newDist / touchRef.current.dist))
      const r   = outerRef.current!.getBoundingClientRect()
      const m   = getTouchMid(e.touches, r)
      const ratio = newZoom / touchRef.current.zoom
      setPanX(touchRef.current.px - (touchRef.current.px - panX) * ratio)
      setPanY(touchRef.current.py - (touchRef.current.py - panY) * ratio)
      setZoom(newZoom)
    }
  }
  function handleTouchEnd() { touchRef.current = null }

  function toCanvas(sx: number, sy: number) {
    const r = outerRef.current!.getBoundingClientRect()
    return { x:(sx-r.left-panX)/zoom, y:(sy-r.top-panY)/zoom }
  }

  function portAbs(node: CanvasNode, port: Port, isInput: boolean) {
    return { x: isInput ? node.x : node.x + node.w, y: node.y + port.yRel }
  }

  function findPortAt(cx: number, cy: number, needInput: boolean, fromDT?: string) {
    for (const node of visibleNodes) {
      const ports = needInput ? node.inputs : node.outputs
      for (const port of ports) {
        const abs = portAbs(node, port, needInput)
        const dx = cx-abs.x, dy = cy-abs.y
        if (Math.sqrt(dx*dx+dy*dy) <= HIT_R) {
          const ok = !fromDT || port.dataType===fromDT || port.dataType==='any' || fromDT==='any'
          if (ok) return { node, port }
        }
      }
    }
    return null
  }

  function handlePointerDownOuter(e: React.PointerEvent) {
    if (e.button === 1) {
      panRef.current = { sx:e.clientX, sy:e.clientY, px:panX, py:panY }
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }

  function startNodeDrag(e: React.PointerEvent, node: CanvasNode) {
    e.stopPropagation(); e.preventDefault()
    dragRef.current = { id:node.id, sx:e.clientX, sy:e.clientY, nx:node.x, ny:node.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const now = Date.now()
    if (clickRef.current?.id === node.id && now - clickRef.current.time < 350) {
      onOpenInspector(node.id); clickRef.current = null
    } else {
      clickRef.current = { id:node.id, time:now }; onSelectNode(node.id)
    }
  }

  function startPortDrag(e: React.PointerEvent, node: CanvasNode, port: Port, isOutput: boolean) {
    e.stopPropagation(); e.preventDefault()
    const { x, y } = toCanvas(e.clientX, e.clientY)
    setPendingWire({
      fromNodeId:node.id, fromPortId:port.id, isOutput,
      startX: isOutput ? node.x+node.w : node.x,
      startY: node.y+port.yRel,
      mouseX:x, mouseY:y, color:port.color,
    })
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (panRef.current) {
      const { sx, sy, px, py } = panRef.current
      setPanX(px + e.clientX - sx); setPanY(py + e.clientY - sy); return
    }
    if (dragRef.current) {
      const { id, sx, sy, nx, ny } = dragRef.current
      onUpdatePosition(id, nx + (e.clientX-sx)/zoom, ny + (e.clientY-sy)/zoom); return
    }
    if (pendingWire) {
      const { x, y } = toCanvas(e.clientX, e.clientY)
      setPendingWire(pw => pw ? { ...pw, mouseX:x, mouseY:y } : null)
    }
  }, [pendingWire, onUpdatePosition, panX, panY, zoom])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (panRef.current) { panRef.current = null; return }
    if (dragRef.current) { dragRef.current = null; return }
    if (pendingWire) {
      const { x, y } = toCanvas(e.clientX, e.clientY)
      const needInput = pendingWire.isOutput
      const fromNode  = nodes.find(n => n.id === pendingWire.fromNodeId)
      const fromPort  = (pendingWire.isOutput ? fromNode?.outputs : fromNode?.inputs)?.find(p => p.id===pendingWire.fromPortId)
      const hit = findPortAt(x, y, needInput, fromPort?.dataType)
      if (hit && hit.node.id !== pendingWire.fromNodeId) {
        const [fnId, fpId, tnId, tpId] = pendingWire.isOutput
          ? [pendingWire.fromNodeId, pendingWire.fromPortId, hit.node.id, hit.port.id]
          : [hit.node.id, hit.port.id, pendingWire.fromNodeId, pendingWire.fromPortId]
        onAddWire({ id:`w-${Date.now()}`, fromNodeId:fnId, fromPortId:fpId, toNodeId:tnId, toPortId:tpId, color:WIRE_CLR })
      }
      setPendingWire(null)
    }
  }, [pendingWire, nodes, onAddWire, panX, panY, zoom])

  const handleCanvasClick = useCallback(() => { onSelectNode(null) }, [onSelectNode])
  const zoomPct = Math.round(zoom * 100)
  // Infinite canvas: background lives on the outer div and tracks pan+zoom
  const dotPx  = 28 * zoom
  const bgX    = ((panX % dotPx) + dotPx) % dotPx
  const bgY    = ((panY % dotPx) + dotPx) % dotPx

  return (
    <div
      ref={outerRef}
      style={{
        flex:1, overflow:'hidden', position:'relative',
        cursor: pendingWire ? 'crosshair' : 'default',
        background: '#111110',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: `${dotPx}px ${dotPx}px`,
        backgroundPosition: `${bgX}px ${bgY}px`,
      }}
      onPointerDown={handlePointerDownOuter}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleCanvasClick}
    >
      <div
        ref={innerRef}
        style={{
          position:'absolute', width:20000, height:16000,
          transformOrigin:'0 0',
          transform:`translate(${panX}px,${panY}px) scale(${zoom})`,
        }}
      >
        {/* SVG wires */}
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
            return (
              <g key={wire.id}>
                <path d={`M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}`}
                  fill="none" stroke={WIRE_CLR} strokeWidth={4} opacity={0.1}/>
                <path d={`M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}`}
                  fill="none" stroke={WIRE_CLR} strokeWidth={1.5} opacity={0.55}
                  style={{ pointerEvents:'stroke', cursor:'pointer' }}
                  onClick={e=>{ e.stopPropagation(); onRemoveWire(wire.id) }}/>
                <circle cx={sx} cy={sy} r={PORT_R} fill={WIRE_CLR} opacity={0.75}/>
                <circle cx={ex} cy={ey} r={PORT_R} fill={WIRE_CLR} opacity={0.75}/>
              </g>
            )
          })}

          {pendingWire && (() => {
            const sx = pendingWire.isOutput ? pendingWire.startX : pendingWire.mouseX
            const sy = pendingWire.isOutput ? pendingWire.startY : pendingWire.mouseY
            const ex = pendingWire.isOutput ? pendingWire.mouseX : pendingWire.startX
            const ey = pendingWire.isOutput ? pendingWire.mouseY : pendingWire.startY
            const cx = (sx+ex)/2
            return (
              <>
                <path d={`M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}`}
                  fill="none" stroke={pendingWire.color} strokeWidth={2} strokeDasharray="6,4" opacity={0.65}/>
                <circle cx={sx} cy={sy} r={PORT_R} fill={pendingWire.color}/>
              </>
            )
          })()}
        </svg>

        {visibleNodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            isGenerating={isGenerating && node.type === 'explore' && node.state === 'running'}
            onPointerDownHeader={e => startNodeDrag(e, node)}
            onPortPointerDown={(e, port, isOut) => startPortDrag(e, node, port, isOut)}
            onGenerate={() => onGenerate(node.id)}
            onExport={onExport}
          />
        ))}
      </div>

      {/* Zoom HUD — bottom-left to avoid help button */}
      <div style={{
        position:'absolute', bottom:16, left:16,
        display:'flex', alignItems:'center', gap:1,
        background:'#1A1A19', border:'1px solid #2C2C2A',
        borderRadius:8, overflow:'hidden',
        boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
        userSelect:'none', zIndex:20,
      }}>
        <ZBtn onClick={() => applyZoom(zoom/1.2, (outerRef.current?.clientWidth??800)/2, (outerRef.current?.clientHeight??600)/2)}>−</ZBtn>
        <ZoomInput zoom={zoom} applyZoom={applyZoom} outerRef={outerRef}/>
        <ZBtn onClick={() => applyZoom(zoom*1.2, (outerRef.current?.clientWidth??800)/2, (outerRef.current?.clientHeight??600)/2)}>+</ZBtn>
      </div>
    </div>
  )
}

function ZoomInput({ zoom, applyZoom, outerRef }: {
  zoom: number
  applyZoom: (newZ: number, fx: number, fy: number) => void
  outerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const zoomPct = Math.round(zoom * 100)

  function commit(val: string) {
    const raw = val.replace('%', '').trim()
    const pct = parseFloat(raw)
    if (!isNaN(pct) && pct > 0) {
      const cx = (outerRef.current?.clientWidth ?? 800) / 2
      const cy = (outerRef.current?.clientHeight ?? 600) / 2
      applyZoom(Math.min(3, Math.max(0.12, pct / 100)), cx, cy)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(inputVal) }
          if (e.key === 'Escape') setEditing(false)
        }}
        onPointerDown={e => e.stopPropagation()}
        style={{
          width:52, padding:'5px 4px', textAlign:'center',
          background:'#141413', border:'1px solid #3A3A38', borderRadius:4,
          color:'#C0C0BC', fontSize:11, fontFamily:"'JetBrains Mono',monospace",
          fontWeight:500, outline:'none',
        }}
      />
    )
  }

  return (
    <button
      title="点击输入缩放比例"
      onClick={() => { setInputVal(String(zoomPct)); setEditing(true) }}
      style={{ padding:'5px 8px', background:'transparent', border:'none', color:'#6A6A66', fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, cursor:'text', minWidth:42, textAlign:'center' }}
      onMouseEnter={e=>{ e.currentTarget.style.color='#C0C0BC' }}
      onMouseLeave={e=>{ e.currentTarget.style.color='#6A6A66' }}
    >
      {zoomPct}%
    </button>
  )
}

function ZBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
      background:'transparent', border:'none', color:'#6A6A66', fontSize:16, cursor:'pointer',
      fontFamily:"'Inter',sans-serif",
    }}
    onMouseEnter={e=>{ e.currentTarget.style.color='#C0C0BC' }}
    onMouseLeave={e=>{ e.currentTarget.style.color='#6A6A66' }}
    >{children}</button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// NodeCard
// ────────────────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: CanvasNode
  isGenerating: boolean
  onPointerDownHeader: (e: React.PointerEvent) => void
  onPortPointerDown: (e: React.PointerEvent, port: Port, isOutput: boolean) => void
  onGenerate: () => void
  onExport: () => void
}

function NodeCard({ node, isGenerating, onPointerDownHeader, onPortPointerDown, onGenerate, onExport }: NodeCardProps) {
  const isResult = node.type === 'result'
  return (
    <div
      className="node-appear"
      style={{ position:'absolute', left:node.x, top:node.y, width:node.w, height:node.h, zIndex:node.selected?10:1 }}
    >
      {node.inputs.map(port => (
        <PortCircle key={port.id} port={port} isInput={true}
          onPointerDown={e => onPortPointerDown(e, port, false)}/>
      ))}
      {node.outputs.map(port => (
        <PortCircle key={port.id} port={port} isInput={false}
          onPointerDown={e => onPortPointerDown(e, port, true)}/>
      ))}

      <div
        onPointerDown={onPointerDownHeader}
        style={{
          width:'100%', height:'100%',
          borderRadius: isResult ? 14 : 10,
          background: isResult ? 'transparent' : '#1A1A19',
          border: node.selected
            ? `1.5px solid ${isResult ? '#3BBDAF60' : '#6B6EF5'}`
            : `1px solid ${isResult ? '#1E3235' : '#2C2C2A'}`,
          overflow:'clip', cursor:'grab',
          boxShadow: node.selected
            ? `0 0 0 3px ${isResult ? '#3BBDAF15' : '#6B6EF520'}, 0 8px 32px rgba(0,0,0,0.5)`
            : isResult
              ? '0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,189,175,0.08)'
              : '0 4px 16px rgba(0,0,0,0.4)',
          display:'flex', flexDirection:'column', userSelect:'none',
        }}
      >
        <NodeContent node={node} isGenerating={isGenerating} onGenerate={onGenerate} onExport={onExport}/>
      </div>
    </div>
  )
}

function PortCircle({ port, isInput, onPointerDown }: {
  port: Port; isInput: boolean; onPointerDown: (e: React.PointerEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHov(true)}
      onPointerLeave={() => setHov(false)}
      title={port.label}
      style={{
        position:'absolute',
        left: isInput ? -PORT_R : undefined,
        right: isInput ? undefined : -PORT_R,
        top: port.yRel - PORT_R,
        width:PORT_R*2, height:PORT_R*2, borderRadius:'50%',
        background: hov ? WIRE_CLR : '#1A1A19',
        border:`2px solid ${WIRE_CLR}`,
        cursor:'crosshair', zIndex:20,
        transition:'background 0.1s, box-shadow 0.1s',
        boxShadow: hov ? `0 0 8px ${WIRE_CLR}80` : 'none',
      }}
    />
  )
}

// ── Node content router ───────────────────────────────────────────────────────

function NodeContent({ node, isGenerating, onGenerate, onExport }: {
  node: CanvasNode; isGenerating: boolean; onGenerate: () => void; onExport: () => void
}) {
  switch (node.type) {
    case 'image':     return <ImageContent node={node}/>
    case 'audio':     return <AudioContent node={node}/>
    case 'text':      return <TextContent node={node}/>
    case 'mood':      return <MoodContent node={node}/>
    case 'explore':   return <ExploreContent node={node} isGenerating={isGenerating} onGenerate={onGenerate}/>
    case 'direction': return <DirectionContent node={node}/>
    case 'fuse':      return <FuseContent node={node}/>
    case 'brief':     return <BriefContent node={node} onExport={onExport}/>
    case 'result':    return <ResultContent node={node} onExport={onExport}/>
    default:          return null
  }
}

function NodeHdr({ label, icon, accent }: { label: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      height:34, background:'#141413', borderBottom:'1px solid #2C2C2A',
      display:'flex', alignItems:'center', padding:'0 10px', gap:7, flexShrink:0,
    }}>
      {icon && (
        <div style={{
          width:18, height:18, borderRadius:4, flexShrink:0,
          background: accent ? accent+'20' : '#1E1E1C',
          border:`1px solid ${accent ? accent+'40' : '#2C2C2A'}`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10,
        }}>{icon}</div>
      )}
      <span style={{ fontSize:11, fontWeight:600, color:'#7A7A76', letterSpacing:'-0.01em' }}>{label}</span>
    </div>
  )
}

// ── Image ─────────────────────────────────────────────────────────────────────

function ImageContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  return (
    <>
      <NodeHdr label={node.data.label as string} icon="🖼" accent="#3BBDAF"/>
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <img src={node.data.imageUrl as string} alt="" draggable={false}
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', opacity:0.82 }}/>
        <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'20px 8px 6px',
          background:'linear-gradient(to top,rgba(0,0,0,0.7),transparent)' }}>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.65)', fontWeight:500 }}>
            {node.data.label as string}
          </span>
        </div>
        <div style={{ position:'absolute', top:8, right:8 }}>
          <span style={{ fontSize:9, padding:'2px 6px', background:'#3BBDAF20', border:'1px solid #3BBDAF30',
            borderRadius:4, color:'#3BBDAF', fontWeight:600 }}>{s.nodeImageDesc}</span>
        </div>
      </div>
    </>
  )
}

// ── Audio ─────────────────────────────────────────────────────────────────────

const WF_A = [4,8,14,10,18,22,16,12,20,24,18,14,10,16,20,14,8,12,18,22,16,12,10,14,20,18,12,8,14,10,6,4]
const WF_B = [6,12,20,16,10,8,14,22,18,12,16,20,14,10,18,22,20,16,12,8,14,18,22,16,10,12,18,14,8,10,12,6]

function AudioContent({ node }: { node: CanvasNode }) {
  const s    = useLang()
  const isRef = node.data.isRef as boolean
  const color = isRef ? '#4BA35A' : '#F5A523'
  const wf    = isRef ? WF_B : WF_A
  return (
    <>
      <NodeHdr label={node.data.label as string} icon={isRef ? '🔗' : '🎤'} accent={color}/>
      <div style={{ flex:1, padding:'8px 10px', display:'flex', alignItems:'center' }}>
        <div style={{ width:28, height:28, borderRadius:6, background:color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill={color}><path d="M5 3l14 9-14 9V3z"/></svg>
        </div>
        <div style={{ flex:1, marginLeft:8 }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:1.5, height:28 }}>
            {wf.map((h, i) => (
              <div key={i} style={{ width:3, borderRadius:2, height:h, background: i<10 ? color : '#2C2C2A', opacity: i<10 ? 0.9 : 0.6 }}/>
            ))}
          </div>
          <div style={{ fontSize:10, color:'#4A4A48', marginTop:3, fontFamily:"'JetBrains Mono',monospace" }}>
            {isRef ? s.ref : s.hum} · {node.data.duration as string}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Text ──────────────────────────────────────────────────────────────────────

function TextContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const [text, setText] = useState(node.data.content as string)
  const [focused, setFocused] = useState(false)
  return (
    <>
      <NodeHdr label={s.hdrText} icon="T" accent="#6B6EF5"/>
      <div style={{ flex:1, padding:'6px 10px', display:'flex' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="在此输入文字意向…"
          style={{
            width:'100%', height:'100%', resize:'none', outline:'none',
            background:'transparent',
            border: focused ? '1px solid #6B6EF540' : '1px solid transparent',
            borderRadius:5, color:'#C8C8C4',
            fontSize:11.5, lineHeight:1.65, fontStyle:'italic',
            padding:'4px 6px', fontFamily:"'Inter',sans-serif", cursor:'text',
          }}
        />
      </div>
    </>
  )
}

// ── Mood ──────────────────────────────────────────────────────────────────────

function MoodContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const colors = ['#F5A523','#E14D7B','#3BBDAF','#9B7EFF']
  const [tags, setTags] = useState(node.data.tags as string[])
  const [adding, setAdding] = useState(false)
  const [newTag, setNewTag] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  function commitTag() {
    const t = newTag.trim()
    if (t) setTags(prev => [...prev, t])
    setNewTag('')
    setAdding(false)
  }

  return (
    <>
      <div style={{ height:34, background:'#141413', borderBottom:'1px solid #2C2C2A',
        display:'flex', alignItems:'center', padding:'0 10px', gap:7, flexShrink:0 }}>
        <div style={{ width:18, height:18, borderRadius:4, background:'#9B7EFF20', border:'1px solid #9B7EFF40',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#9B7EFF', flexShrink:0 }}>✦</div>
        <span style={{ fontSize:11, fontWeight:600, color:'#7A7A76', letterSpacing:'-0.01em', flex:1 }}>{s.hdrMood}</span>
        <button
          onClick={e => { e.stopPropagation(); setAdding(a => { if (!a) setNewTag(''); return !a }) }}
          title="添加情绪"
          style={{
            width:20, height:20, borderRadius:5, border:'1px solid #2C2C2A',
            background:'transparent', color:'#5A5A56',
            fontSize:16, lineHeight:'1', cursor:'pointer', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:"'Inter',sans-serif", transition:'color 0.1s, border-color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='#9B7EFF'; e.currentTarget.style.borderColor='#9B7EFF50' }}
          onMouseLeave={e => { e.currentTarget.style.color='#5A5A56'; e.currentTarget.style.borderColor='#2C2C2A' }}
        >+</button>
      </div>
      <div style={{ flex:1, padding:'8px 10px', display:'flex', flexWrap:'wrap', gap:5, alignContent:'flex-start' }}>
        {tags.map((tag, i) => (
          <span key={i} style={{
            fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
            background:colors[i%colors.length]+'18', border:`1px solid ${colors[i%colors.length]}30`,
            color:colors[i%colors.length],
          }}>{tag}</span>
        ))}
        {adding && (
          <input
            ref={inputRef}
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') { e.preventDefault(); commitTag() }
              if (e.key === 'Escape') { setAdding(false); setNewTag('') }
            }}
            onBlur={commitTag}
            placeholder="新情绪…"
            style={{
              fontSize:11, padding:'3px 10px', borderRadius:20,
              background:'#9B7EFF18', border:'1px dashed #9B7EFF50',
              color:'#9B7EFF', outline:'none', width:76,
              fontFamily:"'Inter',sans-serif",
            }}
          />
        )}
      </div>
    </>
  )
}

// ── AI Explore — rich parameter panel ─────────────────────────────────────────

const TIME_SIGS = ['4/4','3/4','6/8','5/4','7/8']

function ExploreContent({ node, isGenerating, onGenerate }: {
  node: CanvasNode; isGenerating: boolean; onGenerate: () => void
}) {
  const s = useLang()
  const [mode,      setMode]      = useState<'create'|'remix'|'cover'>('create')
  const [lyrics,    setLyrics]    = useState<'write'|'prompt'|'inst'>('write')
  const [excludeEx, setExcludeEx] = useState('')
  const [gender,    setGender]    = useState<'male'|'female'>('female')
  const [bpm,       setBpm]       = useState(96)
  const [bpmInput,  setBpmInput]  = useState('96')
  const [timeSig,   setTimeSig]   = useState('4/4')
  const [weirdness, setWeirdness] = useState(30)
  const [styleFx,   setStyleFx]   = useState(50)
  const [audioFx,   setAudioFx]   = useState(60)
  const [durMode,   setDurMode]   = useState<'auto'|'custom'>('auto')
  const [lockedDims, setLockedDims] = useState<Set<string>>(new Set(['melody','rhythm']))
  const state = node.state

  function toggleDim(key: string) {
    setLockedDims(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function commitBpm(raw: string) {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) { const v = Math.min(300, Math.max(20, n)); setBpm(v); setBpmInput(String(v)) }
    else setBpmInput(String(bpm))
  }

  return (
    <>
      {/* Header */}
      <div style={{
        height:34, flexShrink:0,
        background:'#141413', borderBottom:'1px solid #2C2C2A', borderTop:'2px solid #6B6EF5',
        display:'flex', alignItems:'center', padding:'0 10px', gap:7,
      }}>
        <div style={{ width:18, height:18, borderRadius:4, background:'#6B6EF530', border:'1px solid #6B6EF560',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>⬡</div>
        <span style={{ fontSize:11, fontWeight:700, color:'#8A8AFF' }}>{s.aiExplore}</span>
        {state === 'done' && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#5EC96E' }}/>
            <span style={{ fontSize:9, color:'#5EC96E', fontWeight:600 }}>{s.generated}</span>
          </div>
        )}
      </div>

      {/* Body — all content shown flat, no scroll */}
      <div style={{ flex:1, overflowY:'hidden', padding:'10px 12px', display:'flex', flexDirection:'column', gap:9 }}>

        {/* Mode tabs */}
        <div style={{ display:'flex', gap:2, background:'#141413', border:'1px solid #222220', borderRadius:7, padding:2 }}>
          {(['create','remix','cover'] as const).map(m => (
            <button key={m} onClick={e=>{ e.stopPropagation(); setMode(m) }}
              style={{
                flex:1, padding:'4px 0', borderRadius:5, border:'none',
                background: mode===m ? '#2C2C2A' : 'transparent',
                color: mode===m ? '#F0F0EE' : '#5A5A56',
                fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
              }}>
              {m==='create' ? s.mode_create : m==='remix' ? s.mode_remix : s.mode_cover}
            </button>
          ))}
        </div>

        {/* Lyrics type */}
        <Param label={s.lyrics}>
          <SegCtrl
            opts={[{v:'write',l:s.lyricsWrite},{v:'prompt',l:s.lyricsPrompt},{v:'inst',l:s.lyricsInst}]}
            val={lyrics} onChange={v => setLyrics(v as typeof lyrics)}
          />
        </Param>

        {/* Exclude styles */}
        <Param label={s.excludeStyles}>
          <input value={excludeEx} onChange={e=>setExcludeEx(e.target.value)} onClick={e=>e.stopPropagation()}
            placeholder={s.excludeStylesPlaceholder}
            style={{
              width:'100%', boxSizing:'border-box',
              background:'#141413', border:'1px solid #2A2A28', borderRadius:5,
              color:'#C0C0BC', fontSize:10, padding:'4px 8px',
              fontFamily:"'Inter',sans-serif", outline:'none',
            }}/>
        </Param>

        {/* Vocal — disabled when lyrics = instrumental */}
        <div style={{ opacity: lyrics === 'inst' ? 0.32 : 1, pointerEvents: lyrics === 'inst' ? 'none' : 'auto', transition:'opacity 0.2s' }}>
          <Param label={s.vocalGender}>
            <SegCtrl
              opts={[{v:'male',l:s.male},{v:'female',l:s.female}]}
              val={gender} onChange={v => setGender(v as typeof gender)}
            />
          </Param>
        </div>

        {/* BPM — number input */}
        <Param label={s.bpm}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button
              onPointerDown={e=>e.stopPropagation()}
              onClick={e=>{ e.stopPropagation(); const v=Math.max(20,bpm-1); setBpm(v); setBpmInput(String(v)) }}
              style={{ width:22, height:22, borderRadius:4, border:'1px solid #2A2A28', background:'#141413',
                color:'#6A6A66', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Inter',sans-serif", flexShrink:0, fontSize:13 }}>−</button>
            <input
              type="text" inputMode="numeric" value={bpmInput}
              onChange={e => setBpmInput(e.target.value)}
              onBlur={e => { e.stopPropagation(); commitBpm(bpmInput) }}
              onKeyDown={e => { e.stopPropagation(); if(e.key==='Enter'){ e.preventDefault(); commitBpm(bpmInput) } }}
              onPointerDown={e=>e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              style={{
                flex:1, textAlign:'center',
                background:'#141413', border:'1px solid #2A2A28', borderRadius:5,
                color:'#C0C0BC', fontSize:12, fontWeight:600, padding:'3px 4px',
                fontFamily:"'JetBrains Mono',monospace", outline:'none',
              }}/>
            <button
              onPointerDown={e=>e.stopPropagation()}
              onClick={e=>{ e.stopPropagation(); const v=Math.min(300,bpm+1); setBpm(v); setBpmInput(String(v)) }}
              style={{ width:22, height:22, borderRadius:4, border:'1px solid #2A2A28', background:'#141413',
                color:'#6A6A66', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Inter',sans-serif", flexShrink:0, fontSize:13 }}>+</button>
          </div>
        </Param>

        {/* Time Signature */}
        <Param label={s.timeSignature}>
          <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
            {TIME_SIGS.map(ts => (
              <button key={ts} onClick={e=>{ e.stopPropagation(); setTimeSig(ts) }}
                style={{
                  padding:'3px 8px', borderRadius:4,
                  background: timeSig===ts ? '#6B6EF520' : '#1A1A19',
                  border:`1px solid ${timeSig===ts ? '#6B6EF550' : '#2A2A28'}`,
                  color: timeSig===ts ? '#8A8AFF' : '#4A4A48',
                  fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:"'JetBrains Mono',monospace",
                }}>{ts}</button>
            ))}
          </div>
        </Param>

        {/* Tick sliders */}
        <Param label={s.weirdness} value={weirdness.toString()}>
          <TickSl value={weirdness} min={0} max={100} onChange={setWeirdness} color="#9B7EFF"/>
        </Param>
        <Param label={s.styleInfluence} value={styleFx.toString()}>
          <TickSl value={styleFx} min={0} max={100} onChange={setStyleFx} color="#3BBDAF"/>
        </Param>
        <Param label={s.audioInfluence} value={audioFx.toString()}>
          <TickSl value={audioFx} min={0} max={100} onChange={setAudioFx} color="#F5A523"/>
        </Param>

        {/* Duration */}
        <Param label={s.duration}>
          <SegCtrl
            opts={[{v:'auto',l:s.durationAuto},{v:'custom',l:s.durationCustom}]}
            val={durMode} onChange={v => setDurMode(v as typeof durMode)}
          />
        </Param>

        {/* Explore dimension locks */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <span style={{ fontSize:10, color:'#5A5A56', fontWeight:500 }}>{s.exploreDimsTitle}</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {([
              { key:'melody',  label:s.dimMelody,  color:'#9B7EFF' },
              { key:'harmony', label:s.dimHarmony, color:'#6B6EF5' },
              { key:'rhythm',  label:s.dimRhythm,  color:'#3BBDAF' },
              { key:'inst',    label:s.dimInst,    color:'#F5A523' },
              { key:'texture', label:s.dimTexture, color:'#F06090' },
              { key:'atmos',   label:s.dimAtmos,   color:'#7ABCC2' },
            ]).map(dim => {
              const locked = lockedDims.has(dim.key)
              return (
                <button key={dim.key}
                  onClick={e=>{ e.stopPropagation(); toggleDim(dim.key) }}
                  style={{
                    display:'flex', alignItems:'center', gap:3,
                    padding:'2px 7px', borderRadius:4, fontSize:9, fontWeight:600,
                    cursor:'pointer', fontFamily:"'Inter',sans-serif", transition:'all 0.12s',
                    background: locked ? dim.color+'18' : 'transparent',
                    border:`1px solid ${locked ? dim.color+'45' : '#2A2A28'}`,
                    color: locked ? dim.color : '#3A3A38',
                  }}>
                  <span style={{ fontSize:8, opacity:0.8 }}>{locked ? '🔒' : '○'}</span>
                  {dim.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Generate */}
        {isGenerating ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#0F0F20',
            border:'1px solid #202040', borderRadius:7, marginTop:2, flexShrink:0 }}>
            <div style={{ display:'flex', gap:4 }}>
              <div className="ai-dot-1" style={{ width:6, height:6, borderRadius:'50%', background:'#6B6EF5' }}/>
              <div className="ai-dot-2" style={{ width:6, height:6, borderRadius:'50%', background:'#6B6EF5' }}/>
              <div className="ai-dot-3" style={{ width:6, height:6, borderRadius:'50%', background:'#6B6EF5' }}/>
            </div>
            <span style={{ fontSize:11, color:'#6B6EF5', fontWeight:500 }}>{s.generating}</span>
          </div>
        ) : (
          <button
            onClick={e=>{ e.stopPropagation(); onGenerate() }}
            style={{
              padding:'9px', marginTop:2, flexShrink:0,
              background:'linear-gradient(135deg,#6B6EF5,#9B7EFF)',
              border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:700,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              fontFamily:"'Inter',sans-serif", boxShadow:'0 4px 16px #6B6EF530', transition:'opacity 0.12s',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.opacity='0.85' }}
            onMouseLeave={e=>{ e.currentTarget.style.opacity='1' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
            {s.generate}
          </button>
        )}
      </div>
    </>
  )
}

// Shared sub-components for ExploreContent

function Param({ label, value, children }: { label:string; value?:string; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize:10, color:'#5A5A56', fontWeight:500 }}>{label}</span>
        {value && <span style={{ fontSize:10, color:'#7A7A76', fontFamily:"'JetBrains Mono',monospace" }}>{value}</span>}
      </div>
      {children}
    </div>
  )
}

function SegCtrl({ opts, val, onChange }: {
  opts: { v:string; l:string }[]; val:string; onChange:(v:string)=>void
}) {
  return (
    <div style={{ display:'flex', gap:2, background:'#141413', border:'1px solid #222220', borderRadius:6, padding:2 }}>
      {opts.map(o => (
        <button key={o.v} onClick={e=>{ e.stopPropagation(); onChange(o.v) }}
          style={{
            flex:1, padding:'3px 0', borderRadius:4, border:'none',
            background: val===o.v ? '#252523' : 'transparent',
            color: val===o.v ? '#C0C0BC' : '#4A4A48',
            fontSize:10, fontWeight:val===o.v ? 600 : 400, cursor:'pointer', fontFamily:"'Inter',sans-serif",
          }}>{o.l}</button>
      ))}
    </div>
  )
}

function TickSl({ value, min, max, onChange, color }: {
  value:number; min:number; max:number; onChange:(v:number)=>void; color:string
}) {
  return (
    <div style={{ position:'relative' }}>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'0 1px', marginBottom:3 }}>
        {Array.from({ length:11 }).map((_,i) => (
          <div key={i} style={{ width:1, height:4, background:'#262624', borderRadius:1 }}/>
        ))}
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        onClick={e=>e.stopPropagation()}
        onPointerDown={e=>e.stopPropagation()}
        className="tick-slider" style={{ '--slider-color':color } as React.CSSProperties}/>
    </div>
  )
}

// ── Direction card ─────────────────────────────────────────────────────────────

function DirActionBtn({ label, color, bg }: { label:string; color:string; bg?:string }) {
  const base = bg ?? color+'14'
  return (
    <button
      onClick={e => e.stopPropagation()}
      style={{ flex:1, padding:'4px 0', fontSize:9, fontWeight:600, color, background:base,
        border:`1px solid ${color}28`, borderRadius:5, cursor:'pointer',
        fontFamily:"'Inter',sans-serif", transition:'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color+'2A' }}
      onMouseLeave={e => { e.currentTarget.style.background = base }}
    >{label}</button>
  )
}

function DirectionContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const d = node.data; const color = d.color as string
  return (
    <>
      <div style={{ height:34, flexShrink:0, background:'#141413', borderBottom:'1px solid #2C2C2A',
        borderTop:`2px solid ${color}`, display:'flex', alignItems:'center', padding:'0 10px', gap:6 }}>
        <span style={{ fontSize:10, fontWeight:800, padding:'1px 6px', borderRadius:4, background:color+'20', color, flexShrink:0 }}>
          {d.label as string}
        </span>
        <span style={{ fontSize:11, fontWeight:600, color:'#C0C0BC', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name as string}</span>
        {!!d.mainDim && (
          <span style={{ fontSize:8, fontWeight:700, padding:'1px 7px', borderRadius:10,
            background:color+'18', border:`1px solid ${color}35`, color, flexShrink:0, whiteSpace:'nowrap' }}>
            {d.mainDim as string}
          </span>
        )}
        <span style={{ fontSize:9, fontWeight:600, padding:'1px 6px', borderRadius:10,
          background:'#1E1E1C', border:'1px solid #2C2C2A', color:'#4A4A48', flexShrink:0 }}>{s.demoLabel}</span>
      </div>
      <div style={{ flex:1, padding:'8px 12px 10px', display:'flex', flexDirection:'column', gap:6, overflow:'hidden' }}>
        {/* Tags */}
        <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
          {(d.tags as string[]).map(t => (
            <span key={t} style={{ fontSize:9, padding:'2px 7px', background:'#222220', borderRadius:20, color:'#5A5A56', fontWeight:500 }}>{t}</span>
          ))}
        </div>
        <div style={{ height:1, background:'#222220', flexShrink:0 }}/>
        {/* Properties */}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {([
            ['mood',    s.mood],
            ['style',   s.style],
            ['texture', s.texture],
            ['rhythm',  s.rhythm],
          ] as const).map(([k, label]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:'#4A4A48' }}>{label}</span>
              <span style={{ fontSize:10, color:'#8A8A86', textAlign:'right', maxWidth:110 }}>{d[k] as string}</span>
            </div>
          ))}
        </div>
        {/* Energy */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
            <span style={{ fontSize:9, color:'#4A4A48' }}>{s.energy}</span>
            <span style={{ fontSize:9, color:'#7A7A76', fontFamily:"'JetBrains Mono',monospace" }}>{d.energy as number}%</span>
          </div>
          <div style={{ height:3, background:'#222220', borderRadius:2 }}>
            <div style={{ height:'100%', width:`${d.energy as number}%`, background:color, borderRadius:2, opacity:0.8 }}/>
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ marginTop:'auto', display:'flex', gap:4 }}>
          <DirActionBtn label={s.exploreFurther} color={color}/>
          <DirActionBtn label={s.addToCompare} color="#7A7A78"/>
        </div>
      </div>
    </>
  )
}

// ── Fuse ──────────────────────────────────────────────────────────────────────

function FuseContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const d = node.data
  const inheritsA = (d.inheritsA as string[] | undefined) ?? []
  const inheritsB = (d.inheritsB as string[] | undefined) ?? []

  function TraitChip({ label, color }: { label:string; color:string }) {
    return (
      <span style={{ fontSize:9, padding:'2px 7px', borderRadius:12,
        background:color+'18', border:`1px solid ${color}35`, color, fontWeight:600 }}>{label}</span>
    )
  }

  return (
    <>
      <div style={{ height:34, flexShrink:0, background:'#141413', borderBottom:'1px solid #2C2C2A',
        borderTop:'2px solid #F06090', display:'flex', alignItems:'center', padding:'0 10px', gap:7 }}>
        <span style={{ fontSize:12, color:'#F06090' }}>⊕</span>
        <span style={{ fontSize:11, fontWeight:700, color:'#F06090' }}>{s.hdrFuse}</span>
      </div>
      <div style={{ flex:1, padding:'10px 12px', display:'flex', flexDirection:'column', gap:7 }}>
        {/* From A */}
        <div>
          <div style={{ fontSize:9, color:'#F5A52390', fontWeight:600, marginBottom:4, letterSpacing:'0.04em' }}>{s.fromDirA}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {inheritsA.length > 0 ? inheritsA.map(t => <TraitChip key={t} label={t} color="#F5A523"/>) :
              <span style={{ fontSize:9, color:'#3A3A38' }}>{s.fuseOpen}</span>}
          </div>
        </div>
        {/* Arrow divider */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ flex:1, height:1, background:'#1E1E1C' }}/>
          <span style={{ fontSize:11, color:'#F0609050' }}>⊕</span>
          <div style={{ flex:1, height:1, background:'#1E1E1C' }}/>
        </div>
        {/* From B */}
        <div>
          <div style={{ fontSize:9, color:'#7A7A7890', fontWeight:600, marginBottom:4, letterSpacing:'0.04em' }}>{s.fromDirB}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {inheritsB.length > 0 ? inheritsB.map(t => <TraitChip key={t} label={t} color="#7A7A78"/>) :
              <span style={{ fontSize:9, color:'#3A3A38' }}>{s.fuseOpen}</span>}
          </div>
        </div>
        {/* Output */}
        <div style={{ marginTop:'auto', padding:'5px 8px', background:'#F0609010', border:'1px solid #F0609025', borderRadius:6 }}>
          <div style={{ fontSize:9, color:'#F06090', fontWeight:600 }}>{s.fuseOutputLabel}</div>
        </div>
      </div>
    </>
  )
}

// ── Brief ─────────────────────────────────────────────────────────────────────

function BriefContent({ node, onExport }: { node: CanvasNode; onExport: () => void }) {
  const s = useLang()
  const d = node.data
  const sources = (d.sources as string[] | undefined) ?? []
  const dirChoice = d.dirChoice as string | undefined
  const styleTag = d.styleTag as string | undefined
  return (
    <>
      <div style={{ height:34, flexShrink:0, background:'#141413', borderBottom:'1px solid #2C2C2A',
        borderTop:'2px solid #3BBDAF', display:'flex', alignItems:'center', padding:'0 10px', gap:7 }}>
        <span style={{ fontSize:11, color:'#3BBDAF' }}>↗</span>
        <span style={{ fontSize:11, fontWeight:700, color:'#3BBDAF' }}>{s.hdrBrief}</span>
      </div>
      <div style={{ flex:1, padding:'10px 12px', display:'flex', flexDirection:'column', gap:7 }}>
        {sources.length > 0 ? (
          <>
            {/* Sources */}
            <div>
              <div style={{ fontSize:9, color:'#5A5A56', fontWeight:600, marginBottom:4, letterSpacing:'0.05em', textTransform:'uppercase' }}>{s.inspoSources}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                {sources.map(src => (
                  <span key={src} style={{ fontSize:9, padding:'2px 7px', background:'#3BBDAF15', border:'1px solid #3BBDAF30', borderRadius:12, color:'#3BBDAF', fontWeight:500 }}>{src}</span>
                ))}
              </div>
            </div>
            {/* Direction choice */}
            {dirChoice && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:9, color:'#5A5A56', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.dirChoiceLabel}</span>
                <span style={{ fontSize:10, color:'#F06090', fontWeight:700 }}>{dirChoice}</span>
              </div>
            )}
            {/* Style summary */}
            {styleTag && (
              <div style={{ padding:'5px 8px', background:'#3BBDAF08', border:'1px solid #3BBDAF20', borderRadius:5 }}>
                <div style={{ fontSize:9, color:'#5A5A56', fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.styleSummary}</div>
                <div style={{ fontSize:10, color:'#8ABCC2', fontWeight:500, lineHeight:1.4 }}>{styleTag}</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize:10, color:'#4A4A48', lineHeight:1.6 }}>{s.briefConnect}</div>
        )}
        <div style={{ marginTop:'auto' }}>
          <button onClick={e=>{ e.stopPropagation(); onExport() }}
            style={{ width:'100%', padding:'8px', background:'#3BBDAF18', border:'1px solid #3BBDAF40',
              borderRadius:6, color:'#3BBDAF', fontSize:11, fontWeight:700, cursor:'pointer',
              fontFamily:"'Inter',sans-serif", transition:'all 0.12s' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#3BBDAF30' }}
            onMouseLeave={e=>{ e.currentTarget.style.background='#3BBDAF18' }}>
            {s.exportBrief}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Result Audio — eye-catching output card ────────────────────────────────────

const RES_WF = [6,10,16,12,20,26,22,14,18,28,32,26,20,14,18,24,30,26,18,12,16,22,28,32,26,20,14,10,16,24,28,22,16,12,18,24,30,28,20,14,10,16,22,26,20,14,10,8,12,16]
const [RES_PLAYED] = [18]

function ResultContent({ node, onExport }: { node: CanvasNode; onExport: () => void }) {
  const s     = useLang()
  const [playing, setPlaying] = useState(false)
  const title  = node.data.title as string
  const bpm    = node.data.bpm as number
  const key    = node.data.key as string
  const dur    = node.data.duration as string

  return (
    <div style={{
      width:'100%', height:'100%',
      background:'linear-gradient(160deg, #0C1E22 0%, #111610 40%, #0F1220 100%)',
      borderRadius:14,
      display:'flex', flexDirection:'column',
      overflow:'hidden',
      position:'relative',
    }}>
      {/* Ambient glow layer */}
      <div style={{
        position:'absolute', top:-60, left:-30, width:200, height:200,
        borderRadius:'50%',
        background:'radial-gradient(circle, #3BBDAF08 0%, transparent 70%)',
        pointerEvents:'none',
      }}/>
      <div style={{
        position:'absolute', bottom:-40, right:-20, width:160, height:160,
        borderRadius:'50%',
        background:'radial-gradient(circle, #6B6EF508 0%, transparent 70%)',
        pointerEvents:'none',
      }}/>

      {/* Header */}
      <div style={{
        height:38, flexShrink:0,
        borderBottom:'1px solid #1C3035',
        display:'flex', alignItems:'center', padding:'0 14px', gap:8,
        background:'rgba(0,0,0,0.2)',
      }}>
        <div style={{
          width:20, height:20, borderRadius:5,
          background:'linear-gradient(135deg,#3BBDAF25,#6B6EF515)',
          border:'1px solid #3BBDAF35',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:11,
        }}>✦</div>
        <span style={{ fontSize:11, fontWeight:700, color:'#3BBDAF', letterSpacing:'-0.01em' }}>{s.hdrResult}</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
          {(node.data.status as string | undefined) === 'final' ? (
            <>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#5EC96E', boxShadow:'0 0 5px #5EC96E70' }}/>
              <span style={{ fontSize:9, color:'#5EC96E', fontWeight:600 }}>{s.resultFinalLabel}</span>
            </>
          ) : (node.data.status as string | undefined) === 'draft' ? (
            <>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#7A7A78' }}/>
              <span style={{ fontSize:9, color:'#7A7A78', fontWeight:600 }}>{s.resultDraftLabel}</span>
            </>
          ) : (
            <>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#F5A523', boxShadow:'0 0 5px #F5A52360' }}/>
              <span style={{ fontSize:9, color:'#F5A523', fontWeight:600 }}>{s.resultCandidateLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Track info */}
      <div style={{ padding:'14px 14px 0' }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#E8E8E4', letterSpacing:'-0.03em', marginBottom:3 }}>
          {title}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:10, color:'#3A5055', fontFamily:"'JetBrains Mono',monospace" }}>{dur}</span>
          <div style={{ width:1, height:10, background:'#1E3035' }}/>
          <span style={{ fontSize:10, color:'#3A5055', fontFamily:"'JetBrains Mono',monospace" }}>{bpm} BPM</span>
          <div style={{ width:1, height:10, background:'#1E3035' }}/>
          <span style={{ fontSize:10, color:'#3A5055', fontFamily:"'JetBrains Mono',monospace" }}>{key}</span>
        </div>
      </div>

      {/* Waveform */}
      <div style={{ flex:1, padding:'14px 14px 0', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:1.5, height:56, position:'relative' }}>
          {RES_WF.map((h, i) => {
            const played = i < RES_PLAYED
            return (
              <div key={i} style={{
                flex:1, borderRadius:2,
                height: Math.max(3, h * 0.9),
                background: played
                  ? `linear-gradient(to top, #3BBDAF60, #3BBDAF25)`
                  : '#1C3035',
                opacity: played ? 0.9 : 0.55,
                transition:'height 0.05s',
              }}/>
            )
          })}
          {/* Playhead line */}
          <div style={{
            position:'absolute',
            left:`${(RES_PLAYED / RES_WF.length) * 100}%`,
            top:0, bottom:0,
            width:1.5, background:'#3BBDAF',
            boxShadow:'0 0 6px #3BBDAF80',
          }}/>
        </div>
        {/* Progress track */}
        <div style={{ height:2, background:'#152025', borderRadius:2, marginTop:6, position:'relative' }}>
          <div style={{ height:'100%', width:`${(RES_PLAYED / RES_WF.length) * 100}%`,
            background:'linear-gradient(to right,#3BBDAF,#6B6EF5)', borderRadius:2 }}/>
        </div>
      </div>

      {/* Play controls */}
      <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
        {/* Play/pause button */}
        <button
          onClick={e=>{ e.stopPropagation(); setPlaying(p=>!p) }}
          style={{
            width:40, height:40, borderRadius:12, flexShrink:0,
            background:'linear-gradient(135deg,#3BBDAF28,#6B6EF518)',
            border:'1px solid #3BBDAF35',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', transition:'all 0.15s',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background='linear-gradient(135deg,#3BBDAF40,#6B6EF530)' }}
          onMouseLeave={e=>{ e.currentTarget.style.background='linear-gradient(135deg,#3BBDAF28,#6B6EF518)' }}
        >
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#3BBDAF"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="#3BBDAF"><path d="M5 3l14 9-14 9V3z"/></svg>
          }
        </button>

        {/* Metadata pills */}
        <div style={{ flex:1, display:'flex', gap:5, flexWrap:'wrap' }}>
          <Tag label={s.resultFormat}/>
          <Tag label="都市流行 · 电影感"/>
        </div>
      </div>

      {/* Separator */}
      <div style={{ height:1, background:'#152025', margin:'0 14px' }}/>

      {/* Export actions */}
      <div style={{ padding:'10px 14px 14px', display:'flex', gap:6 }}>
        <button onClick={e=>{ e.stopPropagation(); onExport() }}
          style={{
            flex:1.2, padding:'8px 0',
            background:'linear-gradient(135deg,#3BBDAF25,#3BBDAF15)',
            border:'1px solid #3BBDAF35', borderRadius:8,
            color:'#3BBDAF', fontSize:11, fontWeight:700,
            cursor:'pointer', fontFamily:"'Inter',sans-serif",
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            transition:'all 0.12s',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background='linear-gradient(135deg,#3BBDAF35,#3BBDAF25)' }}
          onMouseLeave={e=>{ e.currentTarget.style.background='linear-gradient(135deg,#3BBDAF25,#3BBDAF15)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          {s.resultDownload}
        </button>
        <button onClick={e=>e.stopPropagation()}
          style={{
            flex:1, padding:'8px 0',
            background:'#141413', border:'1px solid #1E3035', borderRadius:8,
            color:'#4A6A70', fontSize:11, fontWeight:600,
            cursor:'pointer', fontFamily:"'Inter',sans-serif",
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            transition:'all 0.12s',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.color='#8ABCC2' }}
          onMouseLeave={e=>{ e.currentTarget.style.color='#4A6A70' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
          {s.share}
        </button>
      </div>
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize:9, padding:'2px 7px', borderRadius:20,
      background:'#152025', border:'1px solid #1C3035',
      color:'#3A5A60', fontWeight:500,
    }}>{label}</span>
  )
}
