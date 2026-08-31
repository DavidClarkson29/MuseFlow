import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import type { CanvasNode, Wire, PendingWire, Port } from '../types'
import { useLang } from '../App'
import { nodeThemeColor, hexToRgb } from '../theme'
import { DEMO_CARD_H, DEMO_CARD_W, WORK_CARD_H, WORK_CARD_W } from './canvas/model'
import type { DemoItem, InboundRef, WorkItem } from './canvas/model'
import { DirectionContent } from './canvas/DemoCard'
import { WorkContent } from './canvas/WorkCard'
import { FrameDemoDrawer, WorkDrawer } from './canvas/Drawers'
import { NodeHdr } from './canvas/NodeHeader'
import { LyricsContent } from './canvas/LyricsEditor'
import { AudioFolderContent } from './canvas/AudioFolder'
import { LyricsResizeHandle } from './canvas/LyricsResizeHandle'
import { PortCircle } from './canvas/PortCircle'
import { WireLayer } from './canvas/WireLayer'
import { useCanvasViewport } from './canvas/useCanvasViewport'
import { useNodeDrag } from './canvas/useNodeDrag'
import { useWireDrag } from './canvas/useWireDrag'
import { CardContextMenu, canExportNode } from './canvas/CardContextMenu'
import { emitGuideEvent } from '../guideEvents'
import { TileTypeIcon, type TileIconKind } from './TileTypeIcon'
import { MaterialMiniature } from './MaterialMiniature'
import { beginPlayback, stopPlayback, updatePlayback } from '../playbackStore'
import { formatAudioDuration } from '../hooks/useAudioPlayback'
import { resolveGuidedAudio } from '../guidedAudio'
import { localizeBuiltinText } from '../contentI18n'

export { DEMO_CARD_H, DEMO_CARD_W, WORK_CARD_H, WORK_CARD_W } from './canvas/model'
export type { DemoItem, InboundRef, WorkItem, WorkSource } from './canvas/model'

const FRAME_CANVAS_W = 520
const FRAME_HEADER_H = 50
const FRAME_LYRICS_BAR_H = 32
const WIRE_CLR = '#8A8A86'
const EDGE_SNAP_THRESHOLD = 10
const isAutoEdgePort = (port:{ id:string }) => port.id.includes('-ghost-') || port.id.includes('-auto-edge-')

interface Props {
  nodes: CanvasNode[]
  wires: Wire[]
  compareIds: string[]
  onSelectNode: (id: string | null) => void
  onSelectMany: (ids: string[] | null) => void
  onOpenInspector: (id: string) => void
  onUpdatePosition: (id: string, x: number, y: number) => void
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void
  onAddWire: (wire: Wire) => void
  onRemoveWire: (wireId: string) => void
  onAddPort: (nodeId: string, isInput: boolean, yRel: number, colorHint?: string) => string
  onRemovePort: (nodeId:string, portId:string) => void
  onCommit: (dirId: string) => void
  onCompareToggle: (dirId: string) => void
  onDivergeFrame: (frameId: string) => void
  onExtractDemo: (frameId: string, demo: DemoItem, x: number, y: number) => void
  onCreateAudioFolder: (sourceId: string, targetId: string) => void
  onGenerateAudioFolder: (folderId: string) => void
  onExtractWork: (folderId: string, work: WorkItem, x: number, y: number) => void
  onExtractSource: (folderId: string, source: import('./canvas/model').WorkSource, x: number, y: number) => void
  onRemoveSource: (folderId: string, sourceId: string) => void
  onOpenDemoDetail: (id: string) => void
  onAddFrame: () => void
  onExport: () => void
  onAddNode: (type: string) => void
  onViewportChange?: (panX: number, panY: number, zoom: number, width: number, height: number) => void
  onUpdateNodeSize?: (id: string, w: number, h: number) => void
  onImportFiles: (files:File[], x:number, y:number) => void
  onDeleteSelected?: () => void
  onUpdateGroupPositions?: (updates: Array<{ id:string; x:number; y:number }>) => void
  focusRequest?: { nodeId:string; selector?:string; token:number }
}

export default function Canvas({
  nodes, wires, compareIds,
  onSelectNode, onSelectMany, onOpenInspector,
  onUpdatePosition, onUpdateNodeData, onAddWire, onRemoveWire, onAddPort, onRemovePort,
  onCommit, onCompareToggle,
  onDivergeFrame, onExtractDemo, onCreateAudioFolder, onGenerateAudioFolder, onExtractWork, onExtractSource, onRemoveSource, onOpenDemoDetail, onAddFrame,
  onExport, onAddNode, onViewportChange, onUpdateNodeSize, onImportFiles, onDeleteSelected, onUpdateGroupPositions, focusRequest,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const panRef   = useRef<{ sx:number; sy:number; px:number; py:number } | null>(null)
  const touchRef = useRef<{ dist:number; zoom:number; px:number; py:number } | null>(null)
  const { dragRef, beginDrag, positionAt, clearDrag } = useNodeDrag()
  const groupDragRef = useRef<{ anchorId:string; sx:number; sy:number; members:Array<{ id:string; nx:number; ny:number }> } | null>(null)

  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(60)
  const [panY, setPanY] = useState(40)
  const {
    pendingWire, setPendingWire, ghost, setGhost,
    hoveredWire, setHoveredWire,
    clearWireDrag,
  } = useWireDrag()

  const [marquee, setMarquee] = useState<{ x1:number; y1:number; x2:number; y2:number } | null>(null)
  const marqueeMovedRef = useRef(false)
  const [groupTargetId, setGroupTargetId] = useState<string | null>(null)
  const [cardMenu, setCardMenu] = useState<{ node:CanvasNode; x:number; y:number } | null>(null)
  const [exportToast, setExportToast] = useState<string | null>(null)
  const [fileDropActive,setFileDropActive] = useState(false)
  const [guideCamera,setGuideCamera] = useState(false)
  const exportToastTimerRef = useRef<number | null>(null)
  useCanvasViewport(outerRef, panX, panY, zoom, onViewportChange)

  useEffect(()=>{
    if(!focusRequest || !outerRef.current)return
    const target=nodes.find(node=>node.id===focusRequest.nodeId)
    const rect=outerRef.current.getBoundingClientRect()
    const targetElement=focusRequest.selector ? document.querySelector(focusRequest.selector) as HTMLElement|null : null
    if(!target&&!targetElement)return
    const availableW=Math.max(420,rect.width-360)
    const availableH=Math.max(300,rect.height-170)
    const elementRect=targetElement?.getBoundingClientRect()
    const targetW=elementRect ? elementRect.width/zoom : target?.w ?? 520
    const targetH=elementRect ? elementRect.height/zoom : target?.h ?? 360
    const worldCenterX=elementRect ? (elementRect.left+elementRect.width/2-rect.left-panX)/zoom : (target!.x+target!.w/2)
    const worldCenterY=elementRect ? (elementRect.top+elementRect.height/2-rect.top-panY)/zoom : (target!.y+target!.h/2)
    const nextZoom=Math.max(.52,Math.min(.92,availableW/Math.max(targetW,300),availableH/Math.max(targetH,200)))
    setGuideCamera(true)
    setZoom(nextZoom)
    setPanX(rect.width/2-worldCenterX*nextZoom)
    setPanY(rect.height/2-worldCenterY*nextZoom)
    const timer=window.setTimeout(()=>setGuideCamera(false),680)
    return()=>window.clearTimeout(timer)
  },[focusRequest?.token])

  useEffect(() => {
    const close = () => setCardMenu(null)
    const onKey = (e:KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('pointerdown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
      if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current)
    }
  }, [])

  const openCardMenu = (e:React.MouseEvent, node:CanvasNode) => {
    if (!canExportNode(node) || !outerRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = outerRef.current.getBoundingClientRect()
    const menuW = 206, menuH = 44
    setCardMenu({
      node,
      x:Math.max(8, Math.min(e.clientX-rect.left, rect.width-menuW-8)),
      y:Math.max(8, Math.min(e.clientY-rect.top, rect.height-menuH-8)),
    })
    if (nodes.some(item=>item.id===node.id)) onSelectNode(node.id)
  }

  const showExportToast = (fileName:string) => {
    setExportToast(`${langS.cardExportDone} · ${fileName}`)
    if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current)
    exportToastTimerRef.current = window.setTimeout(() => setExportToast(null), 2200)
  }

  const visibleNodes = nodes.filter(n => n.visible)
  const isFolderSeed = (n: CanvasNode) =>
    (n.type === 'audio' && (!!n.data.isHum || !!n.data.isRef)) ||
    (n.type === 'direction' && !!n.data.demo) ||
    n.type === 'work'
  const resolveGroupTarget = (sourceId: string, sourceX: number, sourceY: number): CanvasNode | null => {
    const source = visibleNodes.find(n => n.id === sourceId)
    if (!source || !isFolderSeed(source)) return null
    const cx = sourceX + source.w/2, cy = sourceY + source.h/2
    // 黑板内音频互叠不触发创作夹
    const frames = visibleNodes.filter(n => n.type === 'frame')
    const isInsideFrame = (x:number, y:number) => frames.some(f => x > f.x && x < f.x + FRAME_CANVAS_W && y > f.y && y < f.y + f.h)
    const sourceInside = isInsideFrame(cx, cy)
    const candidate = visibleNodes
      .filter(n => n.id !== sourceId && (isFolderSeed(n) || n.type === 'audioFolder'))
      .map(n => ({ n, d:Math.hypot(cx-(n.x+n.w/2),cy-(n.y+n.h/2)) }))
      .filter(({ n, d }) => d < Math.min(150, Math.max(86,(source.w+n.w)*0.38)))
      .sort((a,b)=>a.d-b.d)[0]?.n ?? null
    if (candidate && sourceInside) {
      const tx = candidate.x + candidate.w/2, ty = candidate.y + candidate.h/2
      if (isInsideFrame(tx, ty)) return null
    }
    return candidate
  }
  const langS = useLang()
  const wireLabel = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined
    const map: Record<string, string> = {
      '__L_INSPIRED__': langS.lInspired,
      '__L_PRESERVE__': langS.lPreserve,
      '__L_INTERPRET__': langS.lInterpretW,
      '__L_BRANCH__': langS.branchFrom,
      '__L_FUSE__': langS.actFuse,
    }
    return map[raw] ?? raw
  }

  const zoomRef = useRef(zoom); zoomRef.current = zoom
  const panSyncRef = useRef({ x: panX, y: panY }); panSyncRef.current = { x: panX, y: panY }
  const zTargetRef = useRef<number | null>(null)
  const zAnchorRef = useRef<{ x:number; y:number } | null>(null)
  const zRafRef = useRef<number | null>(null)

  const animateZoomTo = useCallback(() => {
    if (zRafRef.current !== null) return
    const step = () => {
      const t = zTargetRef.current, a = zAnchorRef.current
      if (t == null || !a) { zRafRef.current = null; return }
      const z0 = zoomRef.current, p0 = panSyncRef.current
      const nz = Math.abs(t - z0) < 0.0004 ? t : z0 + (t - z0) * 0.28
      const ratio = nz / z0
      setZoom(nz)
      setPanX(a.x - (a.x - p0.x) * ratio)
      setPanY(a.y - (a.y - p0.y) * ratio)
      if (nz === t) { zTargetRef.current = null; zRafRef.current = null; return }
      zRafRef.current = requestAnimationFrame(step)
    }
    zRafRef.current = requestAnimationFrame(step)
  }, [])

  const pinchZoom = useCallback((factor: number, fx: number, fy: number) => {
    const base = zTargetRef.current ?? zoomRef.current
    zTargetRef.current = Math.min(3, Math.max(0.12, base * factor))
    zAnchorRef.current = { x: fx, y: fy }
    animateZoomTo()
  }, [animateZoomTo])

  const applyZoom = useCallback((newZ: number, fx: number, fy: number) => {
    newZ = Math.min(3, Math.max(0.12, newZ))
    setZoom(prev => {
      const ratio = newZ / prev
      setPanX(px => fx - (fx - px) * ratio)
      setPanY(py => fy - (fy - py) * ratio)
      return newZ
    })
  }, [])

  const gestureScaleRef = useRef<number | null>(null)
  const mousePosRef = useRef<{ x:number; y:number } | null>(null)

  useEffect(() => {
    const el = outerRef.current!
    // 滚轮 / 触控板：捏合(ctrl+wheel)用指数系数，平滑且与事件频率无关
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.explore-scroll')) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.min(1.12, Math.max(0.92, Math.exp(-e.deltaY * 0.012)))
        pinchZoom(factor, e.clientX - r.left, e.clientY - r.top)
      } else {
        const k = e.deltaMode === 1 ? 16 : 1
        setPanX(px => px - e.deltaX * k)
        setPanY(py => py - e.deltaY * k)
      }
    }
    // Safari 原生捏合手势
    const onGestureChange = (ev: Event) => {
      ev.preventDefault()
      const g = ev as WheelEvent & { scale: number }
      const prev = gestureScaleRef.current
      if (prev && prev > 0) {
        const r = el.getBoundingClientRect()
        pinchZoom(g.scale / prev, g.clientX - r.left, g.clientY - r.top)
      }
      gestureScaleRef.current = g.scale
    }
    const onGestureEnd = () => { gestureScaleRef.current = null }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturechange', onGestureChange)
    el.addEventListener('gestureend', onGestureEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('gestureend', onGestureEnd)
    }
  }, [pinchZoom])

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
    const outer = outerRef.current!
    const r = outer.getBoundingClientRect()
    return {
      x:(sx-r.left+outer.scrollLeft-panX)/zoom,
      y:(sy-r.top+outer.scrollTop-panY)/zoom,
    }
  }

  function portAbs(node: CanvasNode, port: Port, isInput: boolean) {
    return { x: isInput ? node.x : node.x + node.w, y: node.y + port.yRel }
  }

  function findPortAt(cx: number, cy: number, needInput: boolean, fromDT?: string) {
    for (const node of visibleNodes) {
      const ports = needInput ? node.inputs : node.outputs
      for (const port of ports) {
        if (isAutoEdgePort(port)) continue
        const abs = portAbs(node, port, needInput)
        const dx = cx-abs.x, dy = cy-abs.y
        // 只接受指针实际落在显式端口上的操作，不扩大命中范围做磁性吸附。
        if (Math.sqrt(dx*dx+dy*dy) <= 6) {
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
      return
    }
    if (e.button === 0) {
      const t = e.target as HTMLElement
      if (t.closest('[data-node]') || t.closest('button') || t.closest('input') || t.closest('textarea')) return
      const c = toCanvas(e.clientX, e.clientY)
      setMarquee({ x1:c.x, y1:c.y, x2:c.x, y2:c.y })
      marqueeMovedRef.current = false
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    }
  }

  function startNodeDrag(e: React.PointerEvent, node: CanvasNode) {
    if (e.button !== 0) return
    e.stopPropagation(); e.preventDefault()
    const selectedCount = visibleNodes.filter(n => n.selected).length
    const isInGroup = node.selected && selectedCount > 1 && !!onUpdateGroupPositions
    if (isInGroup) {
      const members = visibleNodes.filter(n => n.selected).map(n => ({ id:n.id, nx:n.x, ny:n.y }))
      groupDragRef.current = { anchorId: node.id, sx: e.clientX, sy: e.clientY, members }
      beginDrag(node, e.clientX, e.clientY)
      ;(e.target as Element).setPointerCapture(e.pointerId)
      // 保持多选状态，不切换为单选
      return
    }
    groupDragRef.current = null
    beginDrag(node, e.clientX, e.clientY)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    onSelectNode(node.id)
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

  function handleGhostPointerDown(e:React.PointerEvent) {
    if (!ghost) return
    e.stopPropagation()
    e.preventDefault()
    const node = nodes.find(item => item.id === ghost.nodeId)
    if (!node) return
    const portId = onAddPort(node.id,ghost.isInput,ghost.yRel,ghost.color)
    const { x,y } = toCanvas(e.clientX,e.clientY)
    setPendingWire({
      fromNodeId:node.id,
      fromPortId:portId,
      isOutput:!ghost.isInput,
      startX:ghost.isInput ? node.x : node.x+node.w,
      startY:node.y+ghost.yRel,
      mouseX:x,
      mouseY:y,
      color:ghost.color,
    })
    setGhost(null)
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY }
    setMarquee(prev => {
      if (!prev) return prev
      const c = toCanvas(e.clientX, e.clientY)
      return { ...prev, x2:c.x, y2:c.y }
    })
    if (panRef.current) {
      const { sx, sy, px, py } = panRef.current
      setPanX(px + e.clientX - sx); setPanY(py + e.clientY - sy);
      if (ghost) setGhost(null)
      return
    }
    if (groupDragRef.current && onUpdateGroupPositions) {
      const g = groupDragRef.current
      const dx = (e.clientX - g.sx) / zoom
      const dy = (e.clientY - g.sy) / zoom
      const updates = g.members.map(m => ({ id: m.id, x: m.nx + dx, y: m.ny + dy }))
      onUpdateGroupPositions(updates)
      if (ghost) setGhost(null)
      if (groupTargetId) setGroupTargetId(null)
      return
    }
    if (dragRef.current) {
      const next = positionAt(e.clientX, e.clientY, zoom)!
      onUpdatePosition(next.id, next.x, next.y)
      const nextTarget = resolveGroupTarget(next.id, next.x, next.y)
      setGroupTargetId(prev => prev === nextTarget?.id ? prev : (nextTarget?.id ?? null))
      if (ghost) setGhost(null)
      return
    }
    if (pendingWire) {
      const { x, y } = toCanvas(e.clientX, e.clientY)
      setPendingWire(pw => pw ? { ...pw, mouseX:x, mouseY:y } : null)
      if (ghost) setGhost(null)
      return
    }
    // 鼠标靠近磁贴边缘时显示唯一的临时连接入口；不会写入持久端口。
    const { x:cx,y:cy } = toCanvas(e.clientX,e.clientY)
    let best: { nodeId:string; isInput:boolean; yRel:number; color:string; distance:number } | null = null
    for (const node of visibleNodes) {
      const leftDistance = Math.abs(cx-node.x)
      const rightDistance = Math.abs(cx-(node.x+node.w))
      const distance = Math.min(leftDistance,rightDistance)
      if (distance >= 18 || (best && distance >= best.distance)) continue
      if (cy < node.y+8 || cy > node.y+node.h-8) continue
      const isInput = leftDistance <= rightDistance
      if (node.type === 'result' && !isInput) continue
      const yRel = Math.max(42,Math.min(node.h-12,cy-node.y))
      const explicitPorts = (isInput ? node.inputs : node.outputs).filter(port => !isAutoEdgePort(port))
      if (explicitPorts.some(port => Math.abs(port.yRel-yRel) < 14)) continue
      best = { nodeId:node.id, isInput, yRel, color:WIRE_CLR, distance }
    }
    setGhost(current => {
      if (!best) return current ? null : current
      if (current && current.nodeId===best.nodeId && current.isInput===best.isInput && Math.abs(current.yRel-best.yRel)<.5) return current
      const node = visibleNodes.find(item => item.id === best.nodeId)
      return { ...best, color:node ? nodeThemeColor(node) : WIRE_CLR }
    })
  }, [pendingWire, ghost, onUpdatePosition, onUpdateGroupPositions, panX, panY, zoom, visibleNodes, groupTargetId])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (marquee) {
      const x1 = Math.min(marquee.x1, marquee.x2), x2 = Math.max(marquee.x1, marquee.x2)
      const y1 = Math.min(marquee.y1, marquee.y2), y2 = Math.max(marquee.y1, marquee.y2)
      const moved = (x2-x1)*zoom + (y2-y1)*zoom > 10
      setMarquee(null)
      marqueeMovedRef.current = moved
      if (moved) {
        const hits = visibleNodes
          .filter(n => n.type !== 'field' && n.x + n.w > x1 && n.x < x2 && n.y + n.h > y1 && n.y < y2)
          .map(n => n.id)
        onSelectMany(hits.length ? hits : null)
      }
      return
    }
    if (panRef.current) { panRef.current = null; return }
    if (groupDragRef.current) {
      groupDragRef.current = null
      clearDrag()
      setGroupTargetId(null)
      return
    }
    if (dragRef.current) {
      const final = positionAt(e.clientX, e.clientY, zoom)!
      const target = resolveGroupTarget(final.id, final.x, final.y)
      clearDrag()
      setGroupTargetId(null)
      if (target) onCreateAudioFolder(final.id, target.id)
      return
    }
    if (pendingWire) {
      const { x, y } = toCanvas(e.clientX, e.clientY)
      const needInput = pendingWire.isOutput
      const fromNode  = nodes.find(n => n.id === pendingWire.fromNodeId)
      const fromPort  = (pendingWire.isOutput ? fromNode?.outputs : fromNode?.inputs)?.find(p => p.id===pendingWire.fromPortId)
      const hit = findPortAt(x, y, needInput, fromPort?.dataType)
      let connected = false
      if (hit && hit.node.id !== pendingWire.fromNodeId) {
        const [fnId, fpId, tnId, tpId] = pendingWire.isOutput
          ? [pendingWire.fromNodeId, pendingWire.fromPortId, hit.node.id, hit.port.id]
          : [hit.node.id, hit.port.id, pendingWire.fromNodeId, pendingWire.fromPortId]
        onAddWire({ id:`w-${Date.now()}`, fromNodeId:fnId, fromPortId:fpId, toNodeId:tnId, toPortId:tpId, color:WIRE_CLR })
        connected = true
      } else {
        let best: { nodeId:string; yRel:number; color:string; distance:number } | null = null
        for (const node of visibleNodes) {
          if (node.id === pendingWire.fromNodeId) continue
          if (node.type === 'result' && !needInput) continue
          const distance = needInput ? Math.abs(x-node.x) : Math.abs(x-(node.x+node.w))
          if (distance >= EDGE_SNAP_THRESHOLD || (best && distance >= best.distance)) continue
          if (y < node.y+8 || y > node.y+node.h-8) continue
          best = {
            nodeId:node.id,
            yRel:Math.max(42,Math.min(node.h-12,y-node.y)),
            color:WIRE_CLR,
            distance,
          }
        }
        if (best) {
          const newPortId = onAddPort(best.nodeId,needInput,best.yRel,best.color)
          const [fnId,fpId,tnId,tpId] = pendingWire.isOutput
            ? [pendingWire.fromNodeId,pendingWire.fromPortId,best.nodeId,newPortId]
            : [best.nodeId,newPortId,pendingWire.fromNodeId,pendingWire.fromPortId]
          onAddWire({ id:`w-${Date.now()}`, fromNodeId:fnId, fromPortId:fpId, toNodeId:tnId, toPortId:tpId, color:WIRE_CLR })
          connected = true
        }
      }
      if (!connected && isAutoEdgePort({ id:pendingWire.fromPortId })) {
        onRemovePort(pendingWire.fromNodeId,pendingWire.fromPortId)
      }
      clearWireDrag()
    }
  }, [pendingWire, nodes, visibleNodes, onAddWire, onAddPort, onRemovePort, onCreateAudioFolder, panX, panY, zoom, marquee, onSelectMany])

  const handleCanvasClick = useCallback(() => {
    if (marqueeMovedRef.current) { marqueeMovedRef.current = false; return }
    onSelectNode(null)
  }, [onSelectNode])
  const zoomPct = Math.round(zoom * 100)
  // Infinite canvas: background lives on the outer div and tracks pan+zoom
  const dotPx  = 28 * zoom
  const bgX    = ((panX % dotPx) + dotPx) % dotPx
  const bgY    = ((panY % dotPx) + dotPx) % dotPx

  const snapTarget = (() => {
    if (!pendingWire) return null
    const needInput = pendingWire.isOutput
    const fromNode = nodes.find(node => node.id === pendingWire.fromNodeId)
    const fromPort = (pendingWire.isOutput ? fromNode?.outputs : fromNode?.inputs)?.find(port => port.id === pendingWire.fromPortId)
    const hit = findPortAt(pendingWire.mouseX,pendingWire.mouseY,needInput,fromPort?.dataType)
    if (!hit || hit.node.id === pendingWire.fromNodeId) return null
    const abs = portAbs(hit.node,hit.port,needInput)
    return { nodeId:hit.node.id, portId:hit.port.id, x:abs.x, y:abs.y, color:hit.port.color }
  })()

  const edgeSnap = (() => {
    if (!pendingWire || snapTarget) return null
    const needInput = pendingWire.isOutput
    const mx = pendingWire.mouseX
    const my = pendingWire.mouseY
    let best: { nodeId:string; yRel:number; x:number; y:number; color:string; isInput:boolean; distance:number } | null = null
    for (const node of visibleNodes) {
      if (node.id === pendingWire.fromNodeId) continue
      if (node.type === 'result' && !needInput) continue
      const x = needInput ? node.x : node.x+node.w
      const distance = Math.abs(mx-x)
      if (distance >= EDGE_SNAP_THRESHOLD || (best && distance >= best.distance)) continue
      if (my < node.y+8 || my > node.y+node.h-8) continue
      const yRel = Math.max(42,Math.min(node.h-12,my-node.y))
      best = { nodeId:node.id, yRel, x, y:node.y+yRel, color:WIRE_CLR, isInput:needInput, distance }
    }
    return best
  })()

  return (
    <div
      ref={outerRef}
      className="museflow-canvas"
      style={{
        flex:1, overflow:'hidden', position:'relative',
        cursor: pendingWire ? 'crosshair' : 'default',
        background: '#111110',
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,${(0.03 + Math.min(zoom,1.4)*0.035).toFixed(3)} ${Math.max(0.4, zoom).toFixed(2)}px, transparent ${Math.max(0.4, zoom).toFixed(2)}px))`,
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
      onDragEnter={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();setFileDropActive(true)}}}
      onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';setFileDropActive(true)}}}
      onDragLeave={e=>{if(e.currentTarget===e.target)setFileDropActive(false)}}
      onDrop={e=>{
        if (!e.dataTransfer.files.length) return
        e.preventDefault();e.stopPropagation();setFileDropActive(false)
        const point=toCanvas(e.clientX,e.clientY)
        void onImportFiles(Array.from(e.dataTransfer.files),point.x,point.y)
      }}
    >
      <div
        ref={innerRef}
        className="museflow-canvas-scene"
        style={{
          position:'absolute', width:20000, height:16000,
          transformOrigin:'0 0',
          transform:`translate(${panX}px,${panY}px) scale(${zoom})`,
          transition:guideCamera?'transform 620ms cubic-bezier(.22,1,.36,1)':'none',
        }}
      >
        <WireLayer
          nodes={nodes}
          wires={wires}
          hoveredWire={hoveredWire}
          onHoverWire={setHoveredWire}
          onDeleteWire={(wireId: string) => {
            setHoveredWire(null)
            onRemoveWire(wireId)
          }}
          wireLabel={wireLabel}
          whyChangedTip={langS.whyChangedTip}
          pendingWire={pendingWire}
          snapTarget={snapTarget}
          edgeSnap={edgeSnap}
        />
        {ghost && (() => {
          const node = nodes.find(item => item.id === ghost.nodeId)
          if (!node?.visible) return null
          const x = ghost.isInput ? node.x : node.x + node.w
          const y = node.y + ghost.yRel
          return (
            <button type="button" aria-label={langS.langToggle==='EN'?'拖动连接':'Drag to connect'} onPointerDown={handleGhostPointerDown}
              style={{ position:'absolute', left:x-8, top:y-22, width:16, height:44, padding:0,
                border:0, outline:'none', background:'transparent', overflow:'visible',
                cursor:'crosshair', zIndex:24, color:ghost.color, pointerEvents:'auto' }}>
              <span aria-hidden="true" style={{ position:'absolute', top:0, bottom:0,
                ...(ghost.isInput ? { right:8, width:20 } : { left:8, width:20 }), overflow:'hidden', pointerEvents:'none' }}>
                <span style={{ position:'absolute', top:7, bottom:7, width:2,
                  ...(ghost.isInput ? { right:0 } : { left:0 }), borderRadius:2,
                  background:`linear-gradient(to bottom, transparent, ${ghost.color} 28%, ${ghost.color} 72%, transparent)`,
                  boxShadow:`0 0 8px ${ghost.color}, 0 0 18px ${ghost.color}99` }}/>
              </span>
            </button>
          )
        })()}
        {/* 融合板内的光晕统一绘制在卡片下方，并精确裁切在左侧素材区。 */}
        {visibleNodes.filter(frame => frame.type === 'frame').map(frame => {
          const hasLyrics = wires.some(w => (w.toNodeId === frame.id || w.fromNodeId === frame.id) && nodes.some(n => n.id === (w.toNodeId === frame.id ? w.fromNodeId : w.toNodeId) && n.type === 'lyrics' && n.visible))
          const canvasLeft = frame.x + 1
          const canvasTop = frame.y + 1 + FRAME_HEADER_H + (hasLyrics ? FRAME_LYRICS_BAR_H : 0)
          const materials = visibleNodes.filter(material =>
            ['image','audio','text'].includes(material.type) &&
            material.x + material.w/2 > canvasLeft && material.x + material.w/2 < canvasLeft + FRAME_CANVAS_W &&
            material.y + material.h/2 > canvasTop && material.y + material.h/2 < frame.y + frame.h)
          if (!materials.length) return null
          return (
            <div key={`frame-glows-${frame.id}`} data-frame-glow-layer={frame.id} aria-hidden="true" style={{
              position:'absolute', left:canvasLeft, top:canvasTop, width:FRAME_CANVAS_W,
              height:Math.max(0,frame.y+frame.h-1-canvasTop), overflow:'hidden',
              borderRadius:'0 0 0 13px', pointerEvents:'none', zIndex:1,
            }}>
              {materials.map(material => {
                const rgb = hexToRgb(nodeThemeColor(material))
                const weight = Number(material.data.weight ?? 35)
                const dispX = Math.min(material.x,frame.x+FRAME_CANVAS_W-material.w-6)
                return <span key={material.id} style={{
                  position:'absolute', left:dispX-canvasLeft, top:material.y-canvasTop,
                  width:material.w, height:material.h, borderRadius:10,
                  boxShadow:`0 0 ${12+weight*0.35}px rgba(${rgb},${0.10+weight*0.0028}),0 0 ${36+weight*1.2}px rgba(${rgb},${0.05+weight*0.0014})${material.selected ? `,0 0 34px rgba(${rgb},0.32)` : ''}`,
                }}/>
              })}
            </div>
          )
        })}

        {visibleNodes.map(node => {
          const inbound: InboundRef[] = wires
            .filter(w => w.toNodeId === node.id)
            .map(w => {
              const src = nodes.find(n => n.id === w.fromNodeId)
              return { name: String(src?.data?.name ?? src?.data?.label ?? ''), label: String(src?.data?.label ?? ''), color: String(src?.data?.color ?? '#8A8A86') }
            })
          return (
          <NodeCard
            key={node.id}
            node={node}
            nodes={nodes}
            wires={wires}
            onSelect={onSelectNode}
            onExtractSource={(folderId, source, clientX, clientY) => {
              const pt = toCanvas(clientX, clientY)
              onExtractSource(folderId, source, pt.x, pt.y)
            }}
            onRemoveSource={onRemoveSource}
            langS={langS}
            onUpdateNodeData={onUpdateNodeData}
            onDivergeFrame={onDivergeFrame}
            onExtractDemo={(frameId, demo, clientX, clientY) => {
              const point = toCanvas(clientX, clientY)
              onExtractDemo(frameId, demo, point.x, point.y)
            }}
            onGenerateAudioFolder={onGenerateAudioFolder}
            onExtractWork={(folderId, work, clientX, clientY) => {
              const point = toCanvas(clientX, clientY)
              onExtractWork(folderId, work, point.x, point.y)
            }}
            groupTargeted={groupTargetId === node.id}
            onOpenDemoDetail={onOpenDemoDetail}
            inbound={inbound}
            compareIds={compareIds}
            actions={{ onCommit, onCompareToggle }}
            onPointerDownHeader={e => startNodeDrag(e, node)}
            onPortPointerDown={(e, port, isOut) => startPortDrag(e, node, port, isOut)}
            onExport={onExport}
            pendingWire={pendingWire}
            onUpdateNodeSize={onUpdateNodeSize}
            onCardContextMenu={openCardMenu}
          />
          )
        })}
      </div>

      {fileDropActive && (
        <div style={{position:'absolute',inset:12,zIndex:110,pointerEvents:'none',border:'1px dashed #6B6EF5',borderRadius:14,
          background:'rgba(18,18,28,.72)',boxShadow:'inset 0 0 60px rgba(107,110,245,.08)',display:'grid',placeItems:'center',
          backdropFilter:'blur(3px)'}}>
          <div style={{padding:'14px 18px',borderRadius:10,background:'#1A1A24',border:'1px solid #6B6EF548',
            color:'#B8BAFF',fontSize:12,fontWeight:700,boxShadow:'0 14px 36px rgba(0,0,0,.45)'}}>＋ {langS.langToggle==='EN'?'将图片或音频放到这里':'Drop image or audio here'}</div>
        </div>
      )}

      {/* 框选矩形 */}
      {marquee && (() => {
        const x = Math.min(marquee.x1, marquee.x2) * zoom + panX
        const y = Math.min(marquee.y1, marquee.y2) * zoom + panY
        const w = Math.abs(marquee.x2 - marquee.x1) * zoom
        const h = Math.abs(marquee.y2 - marquee.y1) * zoom
        return (
          <div style={{ position:'absolute', left:x, top:y, width:w, height:h,
            border:'1px solid #6B6EF590', background:'#6B6EF510',
            borderRadius:4, pointerEvents:'none', zIndex:30 }}/>
        )
      })()}

      {/* 框选批量删除悬浮栏 */}
      {(() => {
        const selectedCount = visibleNodes.filter(n => n.selected).length
        if (selectedCount < 2 || !onDeleteSelected) return null
        return (
          <div
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)',
              zIndex:40, display:'flex', alignItems:'center', gap:10,
              padding:'8px 8px 8px 14px', borderRadius:24,
              background:'#1A1A19', border:'1px solid #2C2C2A',
              boxShadow:'0 12px 32px rgba(0,0,0,0.55)', userSelect:'none',
              fontFamily:"'Inter',sans-serif",
            }}>
            <span style={{ display:'flex', alignItems:'center', gap:7, color:'#C0C0BC', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#6B6EF5', boxShadow:'0 0 6px #6B6EF5' }}/>
              {langS.selectedCount} {selectedCount} {langS.cardsUnit}
            </span>
            <span style={{ width:1, height:18, background:'#2C2C2A' }}/>
            <button
              onClick={e => { e.stopPropagation(); onDeleteSelected?.() }}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'7px 14px', borderRadius:16, border:'none',
                background:'#E53E3E', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer',
                boxShadow:'0 2px 8px rgba(229,62,62,0.35)', fontFamily:"'Inter',sans-serif", whiteSpace:'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#D32F2F' }}
              onMouseLeave={e => { e.currentTarget.style.background='#E53E3E' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              {langS.batchDelete} ({selectedCount})
            </button>
            <button
              onClick={e => { e.stopPropagation(); onSelectMany(null) }}
              style={{
                padding:'7px 12px', borderRadius:16, border:'1px solid #2C2C2A',
                background:'transparent', color:'#8A8A86', fontSize:12, fontWeight:600, cursor:'pointer',
                fontFamily:"'Inter',sans-serif", whiteSpace:'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.color='#C0C0BC'; e.currentTarget.style.borderColor='#3A3A38' }}
              onMouseLeave={e => { e.currentTarget.style.color='#8A8A86'; e.currentTarget.style.borderColor='#2C2C2A' }}
            >
              {langS.clearSelection}
            </button>
          </div>
        )
      })()}

      {/* Zoom HUD — bottom-left to avoid help button */}
      <div style={{
        position:'absolute', bottom:16, left:16,
        display:'flex', alignItems:'center', gap:1,
        background:'#1A1A19', border:'1px solid #2C2C2A',
        borderRadius:8, overflow:'hidden',
        boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
        userSelect:'none', zIndex:20,
      }}>
        <ZBtn onClick={() => {
          const r = outerRef.current!.getBoundingClientRect()
          const m = mousePosRef.current
          applyZoom(zoom/1.2, m ? m.x - r.left : r.width/2, m ? m.y - r.top : r.height/2)
        }}>−</ZBtn>
        <ZoomInput zoom={zoom} applyZoom={(z) => {
          const r = outerRef.current!.getBoundingClientRect()
          const m = mousePosRef.current
          applyZoom(z, m ? m.x - r.left : r.width/2, m ? m.y - r.top : r.height/2)
        }} outerRef={outerRef}/>
        <ZBtn onClick={() => {
          const r = outerRef.current!.getBoundingClientRect()
          const m = mousePosRef.current
          applyZoom(zoom*1.2, m ? m.x - r.left : r.width/2, m ? m.y - r.top : r.height/2)
        }}>+</ZBtn>
      </div>

      {/* Empty state — Start with anything */}
      {visibleNodes.length === 0 && (
        <EmptyState onAddNode={onAddNode} onAddFrame={onAddFrame}/>
      )}

      {cardMenu && (() => {
        return <CardContextMenu node={cardMenu.node} x={cardMenu.x} y={cardMenu.y}
          onClose={()=>setCardMenu(null)} onExported={showExportToast}
          labels={{ downloadAudio:langS.cardDownloadAudio, exportLyrics:langS.cardExportLyrics }}/>
      })()}

      {exportToast && (
        <div role="status" style={{ position:'absolute', left:'50%', bottom:62, transform:'translateX(-50%)', zIndex:130,
          padding:'8px 12px', borderRadius:8, background:'rgba(24,24,23,.94)', border:'1px solid #363633',
          color:'#BFC0BA', fontSize:10.5, fontWeight:600, boxShadow:'0 10px 34px rgba(0,0,0,.5)',
          pointerEvents:'none', whiteSpace:'nowrap' }}>{exportToast}</div>
      )}
    </div>
  )
}
function ZoomInput({ zoom, applyZoom, outerRef }: {
  zoom: number
  applyZoom: (newZ: number, fx: number, fy: number) => void
  outerRef: React.RefObject<HTMLDivElement | null>
}) {
  const langS=useLang()
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
      title={langS.langToggle==='EN'?'点击输入缩放比例':'Click to enter zoom percentage'}
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


// ── NodeCard ──

interface NodeCardProps {
  node: CanvasNode
  nodes: CanvasNode[]
  wires: Wire[]
  onSelect: (id: string) => void
  langS: ReturnType<typeof useLang>
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void
  onDivergeFrame: (frameId: string) => void
  onExtractDemo: (frameId: string, demo: DemoItem, clientX: number, clientY: number) => void
  onGenerateAudioFolder: (folderId: string) => void
  onExtractWork: (folderId: string, work: WorkItem, clientX: number, clientY: number) => void
  groupTargeted: boolean
  onOpenDemoDetail: (id: string) => void
  inbound: InboundRef[]
  compareIds: string[]
  actions: IdeationActions
  onPointerDownHeader: (e: React.PointerEvent) => void
  onPortPointerDown: (e: React.PointerEvent, port: Port, isOutput: boolean) => void
  onExport: () => void
  pendingWire: PendingWire | null
  onUpdateNodeSize?: (id: string, w: number, h: number) => void
  onCardContextMenu: (e:React.MouseEvent, node:CanvasNode) => void
  onExtractSource: (folderId: string, source: import('./canvas/model').WorkSource, x: number, y: number) => void
  onRemoveSource: (folderId: string, sourceId: string) => void
}

function NodeCard({ node, nodes, wires, onSelect, langS, onUpdateNodeData, onDivergeFrame, onExtractDemo, onGenerateAudioFolder, onExtractWork, groupTargeted, onOpenDemoDetail, inbound, compareIds, actions, onPointerDownHeader, onPortPointerDown, onExport, pendingWire, onUpdateNodeSize, onCardContextMenu, onExtractSource, onRemoveSource }: NodeCardProps) {
  const isResult = node.type === 'result'
  const isPortableCard = node.type === 'work' || (node.type === 'direction' && (
    !!node.data.demo || (node.w === DEMO_CARD_W && node.h === DEMO_CARD_H)
  ))
  const [hovered, setHovered] = useState(false)
  const [showPorts, setShowPorts] = useState(false)
  const [lyricsPreviewOpen, setLyricsPreviewOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (hovered) {
      timerRef.current = window.setTimeout(() => setShowPorts(true), 320)
    } else {
      if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null }
      setShowPorts(false)
    }
    return () => { if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null } }
  }, [hovered])

  const shouldForceShow = (port: Port, isInput: boolean) => {
    if (pendingWire) {
      if (pendingWire.fromNodeId === node.id) return false
      const needInput = pendingWire.isOutput
      return isInput === needInput
    }
    return false
  }

  const isMaterial = ['image','audio','text'].includes(node.type)
  const weight = isMaterial ? Number(node.data.weight ?? 35) : 0
  const frame = isMaterial
    ? nodes.find(f => f.type === 'frame' &&
        node.x + node.w/2 > f.x && node.x + node.w/2 < f.x + FRAME_CANVAS_W &&
        node.y + node.h/2 > f.y && node.y + node.h/2 < f.y + f.h)
    : undefined
  const inFrame = !!frame
  const hidePersistentPortDots = node.type === 'frame' || (node.type === 'audioFolder' && !pendingWire)
  let dispX = node.x
  if (frame) dispX = Math.min(node.x, frame.x + FRAME_CANVAS_W - node.w - 6)
  const gravity = !!node.data.kept

  const themeRgb = hexToRgb(nodeThemeColor(node))

  return (
    <div
      className={isPortableCard ? undefined : 'node-appear'}
      data-node="1"
      data-node-id={node.id}
      onContextMenu={e=>onCardContextMenu(e,node)}
      style={{ position:'absolute', left:dispX, top:node.y, width:node.w, height:node.h,
        zIndex: node.type==='field' || node.type==='frame' ? 0
          : hovered && node.data.usedPrompt ? 60
          : node.selected ? 10 : gravity ? 8 : inFrame ? 1 + Math.round(weight/25) : 1,
        filter: gravity ? 'drop-shadow(0 0 18px rgba(94,201,110,0.18))' : undefined,
        transition:isPortableCard ? 'filter 0.25s' : 'filter 0.25s, transform 0.2s cubic-bezier(0.22,1,0.36,1)',
        transform:groupTargeted ? 'scale(1.045)' : 'scale(1)' }}
      onPointerDownCapture={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-port]') || target.closest('[data-lyrics-resize-handle]')) return
        onSelect(node.id)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={() => {
        if (hovered && !showPorts) {
          if (timerRef.current !== null) clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(() => setShowPorts(true), 320)
        }
      }}
    >
      {!hidePersistentPortDots && node.inputs.filter(port => !isAutoEdgePort(port)).map(port => {
        const forceVisible = shouldForceShow(port, true)
        const visible = showPorts || forceVisible
        return (
          <PortCircle key={port.id} port={port} isInput={true}
            visible={visible} isSnapTarget={false}
            onPointerDown={e => onPortPointerDown(e, port, false)}/>
        )
      })}
      {!hidePersistentPortDots && node.outputs.filter(port => !isAutoEdgePort(port)).map(port => {
        const forceVisible = shouldForceShow(port, false)
        const visible = showPorts || forceVisible
        return (
          <PortCircle key={port.id} port={port} isInput={false}
            visible={visible} isSnapTarget={false}
            onPointerDown={e => onPortPointerDown(e, port, true)}/>
        )
      })}

      {isMaterial && inFrame && (
        <span style={{ position:'absolute', top:5, right:7, zIndex:26, pointerEvents:'none',
          fontSize:8.5, fontWeight:800, color:'#8A8AFF',
          background:'rgba(18,18,28,0.88)', border:'1px solid #6B6EF545',
          borderRadius:4, padding:'1px 5px', fontFamily:"'JetBrains Mono',monospace" }}>
          {weight}%
        </span>
      )}
      <div
        onPointerDown={onPointerDownHeader}
        onClickCapture={e => {
          if ((node.type === 'direction' && node.data.demo) || node.type === 'work') {
            const target=e.target as HTMLElement
            if(target.closest('button,[role="slider"],input,textarea,select,audio,a'))return
            e.stopPropagation()
            onOpenDemoDetail(node.id)
          }
        }}
        className={node.selected && !inFrame ? 'sel-breathe' : undefined}
        style={{
          position:'relative', zIndex:2,
          width:'100%', height:'100%',
          borderRadius: isResult ? 14 : 10,
          background: isResult || isPortableCard ? 'transparent' : '#1A1A19',
          border: isPortableCard ? 'none' : node.selected
            ? `1px solid rgba(${themeRgb},0.42)`
            : (isMaterial && inFrame)
              ? `1px solid rgba(${themeRgb},0.34)`
              : `1px solid ${isResult ? '#1E3235' : '#2C2C2A'}`,
          overflow:'visible', cursor:'grab',
          ['--sc' as string]: themeRgb,
          boxShadow: isPortableCard
            ? (node.selected ? `0 0 0 1px rgba(${themeRgb},0.42), 0 0 22px rgba(${themeRgb},0.12)` : undefined)
            : inFrame
            ? '0 4px 16px rgba(0,0,0,0.4)'
            : node.selected
            ? undefined
            : `0 4px 16px rgba(0,0,0,0.4)`, 
          display:'flex', flexDirection:'column', userSelect:'none',
        }}
      >
        <div style={{ flex:1, minHeight:0, width:'100%', height:'100%', borderRadius: isResult ? 14 : 10, overflow:'clip', display:'flex', flexDirection:'column' }}>
          <NodeContent node={node} inbound={inbound} compareIds={compareIds} actions={actions} onExport={onExport} nodes={nodes} wires={wires} langS={langS} onUpdateNodeData={onUpdateNodeData} onUpdateNodeSize={onUpdateNodeSize} onDivergeFrame={onDivergeFrame} onGenerateAudioFolder={onGenerateAudioFolder} onOpenDemoDetail={onOpenDemoDetail} onExtractSource={onExtractSource} onRemoveSource={onRemoveSource} lyricsPreviewOpen={lyricsPreviewOpen} onToggleLyricsPreview={() => setLyricsPreviewOpen(v => !v)}/>
        </div>
        {node.type === 'lyrics' && lyricsPreviewOpen && (
          <LyricsPreviewPanel node={node} onClose={() => setLyricsPreviewOpen(false)} />
        )}
      </div>

      {node.type === 'lyrics' && onUpdateNodeSize && (
        <LyricsResizeHandle node={node} onUpdateNodeSize={onUpdateNodeSize}/>
      )}

      {groupTargeted && (
        <div style={{ position:'absolute', inset:-5, zIndex:40, pointerEvents:'none', borderRadius:14,
          border:'1px solid #A69AFF', boxShadow:'0 0 0 4px #8A7CFF18, 0 0 36px #8A7CFF55',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:38, height:32, borderRadius:9, background:'rgba(22,20,36,.94)', border:'1px solid #A69AFF88',
            boxShadow:'0 10px 26px rgba(0,0,0,.45)', display:'grid', gridTemplateColumns:'repeat(2,6px)',
            gridAutoRows:'6px', gap:4, placeContent:'center' }}>
            {[0,1,2,3].map(i=><span key={i} style={{ borderRadius:2, background:i===3?'#5CE1E6':'#A69AFF' }}/>) }
          </div>
        </div>
      )}

      {node.type === 'frame' && (!!node.data.generating || ((node.data.demos as DemoItem[] | undefined)?.length ?? 0) > 0) && (
        <FrameDemoDrawer node={node} onUpdateNodeData={onUpdateNodeData} onExtractDemo={onExtractDemo}
          onDemoContextMenu={(e,demo)=>onCardContextMenu(e,{
            id:demo.id,type:'direction',x:0,y:0,w:DEMO_CARD_W,h:DEMO_CARD_H,visible:true,selected:false,
            inputs:[],outputs:[],data:{...demo,demo:true},
          })}/>
      )}

      {node.type === 'audioFolder' && (!!node.data.generating || ((node.data.works as WorkItem[] | undefined)?.length ?? 0) > 0) && (
        <WorkDrawer node={node} onUpdateNodeData={onUpdateNodeData} onExtractWork={onExtractWork}
          onWorkContextMenu={(e,work)=>onCardContextMenu(e,{
            id:work.id,type:'work',x:0,y:0,w:WORK_CARD_W,h:WORK_CARD_H,visible:true,selected:false,
            inputs:[],outputs:[],data:{...work},
          })}/>
      )}

    </div>
  )
}

function LyricsPreviewPanel({ node, onClose }: { node: CanvasNode; onClose: () => void }) {
  const s=useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const sections = (node.data.sections as Array<{id:string, type:string, label:string, content:string}> | undefined) ?? []
  const colors: Record<string, string> = {
    intro: '#8A8AFF', verse: '#3BBDAF', preChorus: '#9B7EFF', chorus: '#E56B8A', bridge: '#F5A523', outro: '#7A7A78', custom: '#E56B8A',
  }
  const populatedSections = sections.filter(section => String(section.content ?? '').trim())

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="region"
      aria-label={s.lyricBrowse}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      onWheel={event => event.stopPropagation()}
      style={{
        position:'absolute', left:node.w + 9, top:-1, width:276, height:'calc(100% + 2px)', boxSizing:'border-box', zIndex:8,
        overflow:'hidden', borderRadius:10, border:'1px solid rgba(229,107,138,0.16)',
        background:'linear-gradient(155deg, rgba(34,29,39,0.62), rgba(13,13,18,0.54))',
        backdropFilter:'blur(18px) saturate(135%)', WebkitBackdropFilter:'blur(18px) saturate(135%)',
        boxShadow:'0 16px 42px rgba(0,0,0,0.42), inset 0 1px rgba(255,255,255,0.035), 0 0 26px rgba(229,107,138,0.04)',
        color:'#F2F2F5', fontFamily:"'Inter',sans-serif", cursor:'default',
      }}
    >
      <div className="thin-scroll explore-scroll" style={{ position:'absolute', inset:0, overflowY:'auto', overscrollBehavior:'contain', scrollBehavior:'smooth', padding:'32px 24px 54px' }}>
        {populatedSections.length === 0 ? (
          <div style={{ height:'100%', display:'grid', placeItems:'center', textAlign:'center' }}>
            <div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}><TileTypeIcon kind="lyrics" color="#4F4F59" size={24}/></div>
              <div style={{ color:'#6C6C75', fontSize:11, fontWeight:650 }}>{lang==='zh'?'还没有可浏览的歌词':'No lyrics to browse yet'}</div>
            </div>
          </div>
        ) : populatedSections.map((section, sectionIndex) => {
          const color = colors[section.type] ?? '#E56B8A'
          const lines = localizeBuiltinText(section.content,lang).split(/\r?\n/)
          return (
            <section key={section.id} style={{ marginBottom:sectionIndex === populatedSections.length - 1 ? 0 : 34, scrollSnapAlign:'start' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:11, color, fontSize:8, fontWeight:800, letterSpacing:'0.08em' }}>
                <span style={{ width:4, height:4, borderRadius:'50%', background:color, boxShadow:`0 0 8px ${color}88` }}/>
                <span>{localizeBuiltinText(section.label,lang)}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {lines.map((line, lineIndex) => (
                  line.trim() ? (
                    <div key={lineIndex} style={{ fontSize:14, lineHeight:1.55, fontWeight:630, letterSpacing:'-0.012em', color:section.type === 'chorus' ? '#EEE8EF' : '#BBB9C1', textShadow:section.type === 'chorus' ? `0 0 18px ${color}18` : 'none', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{line}</div>
                  ) : <div key={lineIndex} style={{ height:7 }} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <div aria-hidden="true" style={{ position:'absolute', inset:'0 0 auto', height:28, pointerEvents:'none', background:'linear-gradient(to bottom, rgba(25,21,29,0.9), rgba(25,21,29,0))' }}/>
      <div aria-hidden="true" style={{ position:'absolute', inset:'auto 0 0', height:48, pointerEvents:'none', background:'linear-gradient(to top, rgba(13,13,18,0.9) 14%, rgba(13,13,18,0))' }}/>
    </div>
  )
}

// ── Empty state ──

function EmptyState({ onAddNode }: { onAddNode: (type: string) => void; onAddFrame?: () => void }) {
  const s = useLang()
  const items = [
    { t: 'image', label: s.qAddImage, icon: 'image' as TileIconKind, color:'#3BBDAF' },
    { t: 'audio-hum', label: s.qRecordMelody, icon: 'hum' as TileIconKind, color:'#F5A523' },
    { t: 'text', label: s.qWriteThought, icon: 'text' as TileIconKind, color:'#6B6EF5' },
    { t: 'audio-ref', label: s.qAddReference, icon: 'reference' as TileIconKind, color:'#4BA35A' },
  ]
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:15, pointerEvents:'none' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:800, color:'#E8E8E4', letterSpacing:'-0.03em', fontStyle:'italic' }}>{s.startWhatever}</div>
        <div style={{ fontSize:12, color:'#5A5A56', marginTop:8, maxWidth:420, lineHeight:1.6 }}>{s.startSub2}</div>
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:18, flexWrap:'wrap' }}>
          {items.map(it => (
            <button key={it.t} onClick={() => onAddNode(it.t)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px',
                background:'#1A1A19', border:'1px solid #2C2C2A', borderRadius:10,
                color:'#C0C0BC', fontSize:11.5, fontWeight:600, cursor:'pointer',
                fontFamily:"'Inter',sans-serif", pointerEvents:'auto' }}>
              <TileTypeIcon kind={it.icon} color={it.color} size={16}/>{it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
// ── Image ─────────────────────────────────────────────────────────────────────

function ImageContent({ node, onUpdateNodeData }: { node: CanvasNode; onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void }) {
  const s=useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const kws = (node.data.keywords as string[] | undefined) ?? []
  return (
    <>
      <NodeHdr label={localizeBuiltinText(node.data.label ?? s.nodeImage,lang)} icon={<TileTypeIcon kind="image" color="#3BBDAF" size={17}/>} accent="#3BBDAF"
        editable onRename={v => onUpdateNodeData(node.id, { label: v })}/>
      <div style={{ flex:1, minHeight:0, position:'relative', overflow:'hidden' }}>
        <img src={node.data.imageUrl as string} alt="" draggable={false}
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', opacity:0.85 }}/>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, padding:'18px 8px 7px',
          background:'linear-gradient(to top,rgba(0,0,0,0.78),transparent)' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {kws.map(k => (
              <span key={k} style={{ fontSize:8.5, fontWeight:600, padding:'1.5px 6px',
                borderRadius:4, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.14)',
                color:'#FFD9A8' }}>{localizeBuiltinText(k,lang)}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Audio ─────────────────────────────────────────────────────────────────────

const WF_A = [4,8,14,10,18,22,16,12,20,24,18,14,10,16,20,14,8,12,18,22,16,12,10,14,20,18,12,8,14,10,6,4]
const WF_B = [6,12,20,16,10,8,14,22,18,12,16,20,14,10,18,22,20,16,12,8,14,18,22,16,10,12,18,14,8,10,12,6]

function AudioContent({ node, onUpdateNodeData }: { node: CanvasNode; onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void }) {
  const s    = useLang()
  const lang = s.langToggle==='EN'?'zh':'en'
  const isRef = node.data.isRef as boolean
  const color = isRef ? '#4BA35A' : '#F5A523'
  const wf    = isRef ? WF_B : WF_A
  const [an, setAn] = useState(node.data.analysis as { bpm:number; key:string; style:string } | null | undefined)
  const [playing,setPlaying] = useState(false)
  const [audioProgress,setAudioProgress]=useState(0)
  const [realDuration,setRealDuration]=useState(String(node.data.duration??'0:00'))
  const audioRef = useRef<HTMLAudioElement>(null)
  const playbackHandle=useRef<number|null>(null)
  const storedAudioUrl = typeof node.data.audioUrl === 'string' ? node.data.audioUrl : ''
  const fallbackAudio=resolveGuidedAudio(String(node.data.name??node.data.fileName??node.data.label??''))
  const audioUrl = storedAudioUrl||fallbackAudio?.audioUrl||''
  const guidePlayable = !!node.data.guidePlayable
  const durationLabel=realDuration
  const trackTitle=localizeBuiltinText(trToken(String(node.data.label??node.data.fileName??(isRef?s.ref:s.hum)),s),lang)
  useEffect(() => {
    if (isRef && !an) {
      const t = window.setTimeout(() => setAn({ bpm: 120, key: 'C Major', style: 'Pop / Funk' }), 1400)
      return () => window.clearTimeout(t)
    }
  }, [isRef, an])
  useEffect(()=>{
    if(!playing || audioUrl)return
    const [minutes,seconds]=durationLabel.split(':').map(Number)
    const total=Math.max(1,(Number.isFinite(minutes)?minutes:0)*60+(Number.isFinite(seconds)?seconds:0))
    let elapsed=0
    const timer=window.setInterval(()=>{
      elapsed+=.1
      const progress=Math.min(100,elapsed/total*100)
      if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{progress})
      if(progress>=100){
        if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
        playbackHandle.current=null
      }
    },100)
    return()=>window.clearInterval(timer)
  },[audioUrl,durationLabel,playing])
  useEffect(() => () => {
    audioRef.current?.pause()
    if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
  }, [])
  const toggleAudio = () => {
    const audio = audioRef.current
    if(playing){
      if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
      playbackHandle.current=null
      audio?.pause()
      setPlaying(false)
      return
    }
    const startGlobal=()=>{
      playbackHandle.current=beginPlayback({id:`audio:${node.id}`,title:trackTitle,duration:durationLabel,color,progress:audioProgress},()=>{
        audioRef.current?.pause()
        setPlaying(false)
      })
      setPlaying(true)
    }
    if(guidePlayable && !audioUrl){
      startGlobal()
      onUpdateNodeData(node.id,{guidePlayedAt:Date.now()})
      emitGuideEvent({type:'audio-play',nodeId:node.id})
      return
    }
    if (!audioUrl || !audio) return
    emitGuideEvent({type:'audio-play',nodeId:node.id})
    startGlobal()
    void audio.play().catch(()=>{
      if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
      playbackHandle.current=null
      setPlaying(false)
    })
  }
  return (
    <>
      <NodeHdr label={localizeBuiltinText(trToken(String(node.data.label ?? ''), s),lang)} icon={<TileTypeIcon kind={isRef ? 'reference' : 'hum'} color={color} size={17}/>} accent={color}
        editable onRename={v => onUpdateNodeData(node.id, { label: v })}/>
      <div style={{ flex:1, minHeight:0, padding:'6px 9px 4px', display:'flex', alignItems:'center' }}>
        <button type="button" className={guidePlayable?'guide-audio-hit':''} data-guide-target={`audio-play-${node.id}`} data-guide-audio-control="1" disabled={!audioUrl&&!guidePlayable} aria-label={playing?(lang==='zh'?'暂停音频':'Pause audio'):(lang==='zh'?'播放音频':'Play audio')}
          onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();toggleAudio()}}
          style={{ position:'relative', zIndex:guidePlayable?3:undefined, width:guidePlayable?48:24, height:guidePlayable?48:24, margin:guidePlayable?-12:0, padding:0, border:0, borderRadius:12, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            cursor:audioUrl||guidePlayable?'pointer':'default',opacity:audioUrl||guidePlayable?1:.72 }}>
          <span style={{width:24,height:24,borderRadius:6,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            {playing
              ? <svg width="9" height="9" viewBox="0 0 24 24" fill={color}><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
              : <svg width="9" height="9" viewBox="0 0 24 24" fill={color}><path d="M5 3l14 9-14 9V3z"/></svg>}
          </span>
        </button>
        {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" onLoadedMetadata={event=>{
          const next=formatAudioDuration(event.currentTarget.duration)
          setRealDuration(next)
          if(next!==String(node.data.duration??''))onUpdateNodeData(node.id,{duration:next})
          if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{duration:next})
        }}
          onTimeUpdate={event=>{
            const audio=event.currentTarget
            const progress=audio.duration>0?audio.currentTime/audio.duration*100:0
            setAudioProgress(progress)
            if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{progress})
          }}
          onEnded={()=>{
            if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
            playbackHandle.current=null
            setPlaying(false)
            setAudioProgress(0)
          }} onPause={()=>setPlaying(false)}/>} 
        <div style={{ flex:1, minWidth:0, marginLeft:7 }}>
          <div role={audioUrl?'slider':undefined} data-guide-audio-control="1" tabIndex={audioUrl?0:undefined} aria-label={audioUrl?(lang==='zh'?'音频进度':'Audio progress'):undefined} aria-valuemin={audioUrl?0:undefined} aria-valuemax={audioUrl?100:undefined} aria-valuenow={audioUrl?Math.round(audioProgress):undefined}
            onPointerDown={audioUrl?event=>{event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();const next=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100));setAudioProgress(next);if(audioRef.current&&audioRef.current.duration>0)audioRef.current.currentTime=audioRef.current.duration*next/100;if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{progress:next})}:undefined}
            style={{ display:'flex', alignItems:'flex-end', gap:1.5, height:20, cursor:audioUrl?'pointer':'default' }}>
            {wf.map((h, i) => (
              <div key={i} style={{ width:2.5, borderRadius:1.5, height:Math.round(h*0.82), background: i/wf.length*100<=audioProgress ? color : '#2C2C2A', opacity: i/wf.length*100<=audioProgress ? 0.9 : 0.6 }}/>
            ))}
          </div>
          <div style={{ fontSize:9, color:'#4A4A48', marginTop:2, fontFamily:"'JetBrains Mono',monospace" }}>
            {isRef ? s.ref : s.hum} · {durationLabel}
          </div>
          {isRef && (
            <div style={{ fontSize:8.5, color:'#6A8A70', marginTop:1.5,
              fontFamily:"'JetBrains Mono',monospace",
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
              title={localizeBuiltinText(trToken(String(node.data.fileName ?? ''), s),lang)}>
              {localizeBuiltinText(trToken(String(node.data.fileName ?? ''), s),lang)}
            </div>
          )}
        </div>
      </div>
      {isRef && (
        <div style={{ flexShrink:0, margin:'0 7px 7px', padding:'4px 7px', background:'#4BA35A0D',
          border:'1px solid #4BA35A25', borderRadius:6 }}
          onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
          {an ? (
            <div style={{ display:'flex', flexWrap:'wrap', gap:3, alignItems:'center' }}>
              <span style={{ fontSize:7.5, fontWeight:800, color:'#5EC96E', letterSpacing:'0.04em',
                marginRight:1 }}>✓</span>
              <Chip label={`${an.bpm} BPM`} c="#5EC96E"/>
              <Chip label={an.key} c="#5EC96E"/>
              <Chip label={an.style.split(' / ')[0]} c="#5EC96E"/>
            </div>
          ) : (
            <span style={{ fontSize:9, color:'#6A8A70', fontStyle:'italic' }}>{lang==='zh'?'识别中…':'Analyzing…'}</span>
          )}
        </div>
      )}
    </>
  )
}

function Chip({ label, c }: { label:string; c:string }) {
  return (
    <span style={{ fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4,
      background:c+'14', border:`1px solid ${c}30`, color:c, whiteSpace:'nowrap',
      fontFamily:"'JetBrains Mono',monospace" }}>{label}</span>
  )
}

// ── Text ──────────────────────────────────────────────────────────────────────

function TextContent({ node, onUpdateNodeData, onUpdateNodeSize }: {
  node: CanvasNode
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void
  onUpdateNodeSize?: (id: string, w: number, h: number) => void
}) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const [text, setText] = useState(localizeBuiltinText(node.data.content,lang))
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setText(localizeBuiltinText(node.data.content,lang)), [node.data.content,lang])

  useLayoutEffect(() => {
    const textarea=textareaRef.current
    if(!textarea || !onUpdateNodeSize)return
    textarea.style.height='0px'
    const contentHeight=textarea.scrollHeight
    textarea.style.height='100%'
    const desiredHeight=Math.max(100,Math.ceil(contentHeight+46))
    if(Math.abs(desiredHeight-node.h)>1)onUpdateNodeSize(node.id,node.w,desiredHeight)
  },[text,node.h,node.id,node.w,onUpdateNodeSize])

  return (
    <>
      <NodeHdr label={localizeBuiltinText(node.data.title,lang) || s.hdrText} icon={<TileTypeIcon kind="text" color="#6B6EF5" size={17}/>} accent="#6B6EF5"
        editable onRename={v => onUpdateNodeData(node.id, { title: v })}/>
      <div style={{ flex:1, padding:'6px 10px', display:'flex' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => {
            const value=e.target.value
            setText(value)
            onUpdateNodeData(node.id,{content:value})
          }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={lang==='zh'?'在此输入文字意向…':'Enter your text intent…'}
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
function IntentContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const [tags, setTags] = useState<{ t: string; locked: boolean }[]>(
    (node.data.tags as { t: string; locked: boolean }[] | undefined) ?? []
  )
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  return (
    <>
      <NodeHdr label={s.nodeIntent} icon={<TileTypeIcon kind="intent" color="#9B7EFF" size={17}/>} accent="#9B7EFF"/>
      <div style={{ flex:1, padding:'8px 10px', display:'flex', flexWrap:'wrap', gap:4, alignContent:'flex-start' }}>
        {tags.map((tag, i) => (
          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:3,
            fontSize:10.5, fontWeight:600, padding:'3px 9px', borderRadius:20,
            background:'#9B7EFF18', border:`1px solid ${tag.locked ? '#9B7EFF60' : '#9B7EFF30'}`,
            color: tag.locked ? '#C5B8FF' : '#9B7EFF' }}>
            {tag.t}
            <button onClick={e=>{ e.stopPropagation(); setTags(p => p.map((m,idx)=>idx===i?{...m,locked:!m.locked}:m)) }}
              style={{ border:'none', background:'transparent', cursor:'pointer',
                fontSize:8, padding:0, color: tag.locked ? '#C5B8FF' : '#9B7EFF70' }}>
              {tag.locked ? '🔒' : '○'}
            </button>
          </span>
        ))}
        {adding ? (
          <input ref={inputRef} value={val}
            onChange={e=>setVal(e.target.value)}
            onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
            onKeyDown={e=>{ e.stopPropagation()
              if (e.key==='Enter' && val.trim()) { setTags(p=>[...p,{t:val.trim(),locked:false}]); setVal(''); setAdding(false) }
              if (e.key==='Escape') { setAdding(false); setVal('') } }}
            onBlur={()=>{ if (val.trim()) { setTags(p=>[...p,{t:val.trim(),locked:false}]) } setVal(''); setAdding(false) }}
            placeholder="__ADD__"
            style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'#141413',
              border:'1px dashed #9B7EFF50', color:'#C5B8FF', outline:'none', width:80 }}/>
        ) : (
          <button onClick={e=>{ e.stopPropagation(); setAdding(true) }}
            style={{ width:22, height:22, borderRadius:'50%', border:'1px dashed #9B7EFF40',
              background:'transparent', color:'#9B7EFF80', cursor:'pointer', fontSize:13, lineHeight:1 }}>+</button>
        )}
      </div>
    </>
  )
}

function ConstraintContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const [text, setText] = useState(trToken(node.data.text as string, s))
  const [locked, setLocked] = useState(!!node.data.locked)
  return (
    <>
      <div style={{ height:30, flexShrink:0, background:'#141413', borderBottom:'1px solid #2A1E20',
        borderTop:'2px solid #E06A5A', display:'flex', alignItems:'center', padding:'0 10px', gap:6 }}>
        <span style={{ fontSize:11 }}>{locked ? '🔒' : '🔓'}</span>
        <span style={{ fontSize:10.5, fontWeight:700, color:'#E06A5A' }}>{s.nodeConstraintN}</span>
        <button onClick={e=>{ e.stopPropagation(); setLocked(l=>!l) }}
          style={{ marginLeft:'auto', fontSize:9, cursor:'pointer', background:'transparent',
            border:'none', color: locked ? '#E06A5A' : '#5A5A56' }}>
          {locked ? (lang==='zh'?'必须保留':'Must keep') : (lang==='zh'?'可调整':'Adjustable')}
        </button>
      </div>
      <input value={text} onChange={e=>setText(e.target.value)}
        onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
        placeholder={s.constraintPh}
        style={{ flex:1, margin:'8px 10px', background:'transparent', border:'none', outline:'none',
          color:'#D8A8A0', fontSize:11.5, fontWeight:600, fontStyle:text ? 'normal' : 'italic',
          fontFamily:"'Inter',sans-serif" }}/>
    </>
  )
}

function QuestionContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const [answer, setAnswer] = useState('')
  const [answered, setAnswered] = useState<string | null>((node.data.answered as string | null) ?? null)
  const isAI = (node.data.source ?? 'ai') === 'ai'
  const q = trToken(node.data.question as string, s)
  return (
    <>
      <div style={{ height:30, flexShrink:0, background:'#141413', borderBottom:'1px solid #222220',
        borderTop:`2px solid ${isAI ? '#F5C87A' : '#6B6EF5'}`, display:'flex', alignItems:'center', padding:'0 10px', gap:6 }}>
        <span style={{ fontSize:8.5, fontWeight:800, padding:'1px 6px', borderRadius:4,
          background:isAI?'#F5A52320':'#6B6EF520', color:isAI?'#F5C87A':'#8A8AFF', letterSpacing:'0.05em' }}>
          {isAI ? 'AI ✦' : 'ME'}
        </span>
        <span style={{ fontSize:10.5, fontWeight:700, color:isAI?'#F5C87A':'#8A8AFF' }}>{s.nodeQuestionN}</span>
        {answered && (
          <span style={{ marginLeft:'auto', fontSize:9, color:'#5EC96E', fontWeight:600 }}>✓ {s.answeredTag}</span>
        )}
      </div>
      <div style={{ flex:1, padding:'8px 11px', display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:11, color:'#D8D8D4', fontStyle:'italic', lineHeight:1.55 }}>{q}</div>
        {!answered ? (
          <div style={{ marginTop:'auto', display:'flex', gap:4 }}>
            <input value={answer} onChange={e=>setAnswer(e.target.value)}
              onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
              onKeyDown={e=>{ e.stopPropagation(); if (e.key==='Enter' && answer.trim()) setAnswered(answer.trim()) }}
              placeholder={lang==='zh'?'写下想法…':'Write a thought…'}
              style={{ flex:1, minWidth:0, background:'#141413', border:'1px solid #2A2A28', borderRadius:5,
                color:'#C0C0BC', fontSize:10, padding:'4px 8px', outline:'none' }}/>
            <button onClick={e=>{ e.stopPropagation(); if (answer.trim()) setAnswered(answer.trim()) }}
              style={{ width:24, height:24, borderRadius:5, border:'1px solid #6B6EF550',
                background:'#6B6EF518', color:'#8A8AFF', cursor:'pointer', fontSize:11 }}>→</button>
          </div>
        ) : (
          <div style={{ marginTop:'auto', padding:'5px 8px', background:'#5EC96E08',
            border:'1px solid #5EC96E25', borderRadius:5, fontSize:10, color:'#9AD4A6', lineHeight:1.45 }}>
            “{answered}”
          </div>
        )}
      </div>
    </>
  )
}

function NoteContent({ node, onUpdateNodeData }: {
  node: CanvasNode
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void
}) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const [text, setText] = useState(localizeBuiltinText(node.data.text,lang))
  useEffect(() => setText(localizeBuiltinText(node.data.text,lang)), [node.data.text,lang])
  return (
    <div style={{
      width:'100%', height:'100%', background:'linear-gradient(180deg,#F5E6A8,#EBD98F)',
      borderRadius:4, boxShadow:'0 4px 14px rgba(0,0,0,0.35)',
      transform:'rotate(-1deg)', padding:'18px 11px 10px', display:'flex', flexDirection:'column',
    }}>
      <textarea value={text} onChange={e=>{
        const value=e.target.value
        setText(value)
        onUpdateNodeData(node.id,{text:value})
      }}
        onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
        placeholder={s.notePh}
        style={{ flex:1, resize:'none', background:'transparent', border:'none', outline:'none',
          color:'#5A4E22', fontSize:11, lineHeight:1.55, fontStyle:'italic', fontFamily:"'Inter',sans-serif" }}/>
    </div>
  )
}

// ── Negotiated Interpretation（保留类型）──

function InterpretationContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const [agreed, setAgreed] = useState(!!node.data.agreed)
  const [editing, setEditing] = useState(false)
  const [hyp, setHyp] = useState(s.hypothesisText)
  const [whyOpen, setWhyOpen] = useState(false)
  const [cores, setCores] = useState<Set<string>>(new Set())
  const strong = [s.sigWarmImg, s.sigDescMelody, s.sigEndText]
  const weak = [s.sigCityPopRef]
  const SignalRow = ({ t, w }: { t:string; w?:boolean }) => (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'2.5px 0' }}>
      <button onClick={()=>setCores(prev=>{const n=new Set(prev); n.has(t)?n.delete(t):n.add(t); return n})}
        onPointerDown={e=>e.stopPropagation()} title={s.reweightB}
        style={{ width:14, height:14, flexShrink:0, borderRadius:'50%', cursor:'pointer',
          border:'none', background: cores.has(t) ? '#F5C87A30' : 'transparent',
          color: cores.has(t) ? '#F5C87A' : '#3A3A38', fontSize:9, lineHeight:1 }}>{cores.has(t)?'★':'☆'}</button>
      <span style={{ fontSize:10.5, color: w ? '#6A6A66' : '#B8B8B4' }}>{t}</span>
      {cores.has(t) && <span style={{ fontSize:8, fontWeight:800, color:'#F5C87A' }}>{s.centralTag}</span>}
      <span style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%',
        background: w ? '#3A3A38' : '#5EC96E', flexShrink:0 }}/>
    </div>
  )
  return (
    <>
      <div style={{ height:34, flexShrink:0, background:'#141413', borderBottom:'1px solid #2C2C2A',
        borderTop:'2px solid #6B6EF5', display:'flex', alignItems:'center', padding:'0 10px', gap:7 }}>
        <div style={{ width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <TileTypeIcon kind="spark" color="#8A8AFF" size={17}/>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'#8A8AFF' }}>{s.aiUnderstanding}</span>
        {agreed && <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, color:'#5EC96E' }}>✓</span>}
      </div>
      <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:9 }} className="thin-scroll">
        <div style={{ padding:'8px 10px', background:'#14141E', border:'1px solid #23233A',
          borderLeft:'2px solid #6B6EF5', borderRadius:6 }}>
          <div style={{ fontSize:8.5, fontWeight:800, color:'#6A6A8A', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:3 }}>{s.hypothesisL}</div>
          {editing ? (
            <textarea value={hyp} onChange={e=>setHyp(e.target.value)}
              onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
              style={{ width:'100%', boxSizing:'border-box', minHeight:52, resize:'none',
              background:'#0F0F18', border:'1px solid #2C2C44', borderRadius:5,
              color:'#C8C8E8', fontSize:10.5, lineHeight:1.5, outline:'none', padding:6 }}/>
          ) : (
            <div style={{ fontSize:11, color:'#C8C8E8', fontStyle:'italic', lineHeight:1.55 }}>{hyp}</div>
          )}
        </div>
        <div>
          <div style={{ fontSize:8.5, fontWeight:800, color:'#5EC96E90', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:2 }}>{s.strongSignals}</div>
          {strong.map(t => <SignalRow key={t} t={t}/>)}
          <div style={{ fontSize:8.5, fontWeight:800, color:'#5A5A66', textTransform:'uppercase',
            letterSpacing:'0.06em', margin:'5px 0 2px' }}>{s.weakSignals}</div>
          {weak.map(t => <SignalRow key={t} t={t} w/>)}
        </div>
        <div style={{ padding:'7px 9px', background:'#F5A52308', border:'1px dashed #F5A52340', borderRadius:6 }}>
          <div style={{ fontSize:8.5, fontWeight:800, color:'#F5A52390', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:2 }}>{s.uncertainLabel}</div>
          <div style={{ fontSize:10, color:'#C0B8A8', lineHeight:1.5 }}>{s.uncertainText}</div>
        </div>
        {whyOpen && (
          <div style={{ padding:'7px 9px', background:'#141413', border:'1px solid #222220', borderRadius:6,
            fontSize:10, color:'#8A8A86', lineHeight:1.55 }}>{s.askWhyAns}</div>
        )}
        <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ display:'flex', gap:4 }}>
            <IBtn label={editing ? '✓' : '✎ Edit'} onClick={()=>setEditing(e=>!e)}/>
            <IBtn label={s.askWhyB} onClick={()=>setWhyOpen(w=>!w)}/>
          </div>
          <button onPointerDown={e=>e.stopPropagation()} onClick={()=>setAgreed(a=>!a)}
            style={{ padding:'8px', borderRadius:7, cursor:'pointer',
              background: agreed ? '#1E2A22' : 'linear-gradient(135deg,#6B6EF5,#9B7EFF)',
              border: agreed ? '1px solid #5EC96E45' : '1px solid transparent',
              color: agreed ? '#5EC96E' : '#fff', fontSize:11.5, fontWeight:800 }}>
            {agreed ? `✓ ${s.agreeB}` : s.agreeB}
          </button>
        </div>
      </div>
    </>
  )
}

function IBtn({ label, onClick }: { label:string; onClick:()=>void }) {
  return (
    <button onPointerDown={e=>e.stopPropagation()} onClick={onClick}
      style={{ flex:1, padding:'5px 0', background:'#1E1E1C', border:'1px solid #2C2C2A',
        borderRadius:5, color:'#8A8A86', fontSize:9.5, fontWeight:600, cursor:'pointer' }}>{label}</button>
  )
}

function FieldContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const [name, setName] = useState(localizeBuiltinText(node.data.name,lang))
  return (
    <div style={{ width:'100%', height:'100%', position:'relative', pointerEvents:'none' }}>
      <div style={{ position:'absolute', inset:0, borderRadius:18,
        background:'radial-gradient(120% 120% at 30% 20%, rgba(107,110,245,0.055), rgba(59,189,175,0.03) 60%, rgba(107,110,245,0.02))',
        border:'1.5px dashed rgba(120,122,245,0.22)' }}/>
      <div style={{ position:'absolute', top:-11, left:16, display:'flex', alignItems:'center', gap:6 }}
        onPointerDown={e=>e.stopPropagation()}>
        <span style={{ fontSize:8.5, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
          color:'#8A8AFF', background:'#14141E', border:'1px solid #2C2C44', borderRadius:6, padding:'2px 8px' }}>
          ▢ {s.fieldNode}
        </span>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={s.fieldPh}
          onClick={e=>e.stopPropagation()} onPointerDown={e=>{ e.stopPropagation(); (e.target as HTMLElement).focus() }}
          style={{ width:150, background:'rgba(20,20,25,0.85)', border:'1px solid #2C2C44', borderRadius:6,
            color:'#C8C8E8', fontSize:10.5, fontWeight:600, padding:'3px 8px', outline:'none',
            fontStyle: name ? 'normal' : 'italic', pointerEvents:'auto' }}/>
      </div>
    </div>
  )
}

// ── Node content router ──

function NodeContent({ node, inbound, compareIds, actions, onExport, nodes, wires, langS, onUpdateNodeData, onUpdateNodeSize, onDivergeFrame, onGenerateAudioFolder, onOpenDemoDetail, onExtractSource, onRemoveSource, lyricsPreviewOpen, onToggleLyricsPreview }: {
  node: CanvasNode; inbound: InboundRef[]
  compareIds: string[]
  actions: IdeationActions; onExport: () => void
  nodes: CanvasNode[]; wires: Wire[]; langS: ReturnType<typeof useLang>
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void
  onUpdateNodeSize?: (id: string, w: number, h: number) => void
  onDivergeFrame: (frameId: string) => void
  onGenerateAudioFolder: (folderId: string) => void
  onOpenDemoDetail: (id: string) => void
  onExtractSource: (folderId: string, source: import('./canvas/model').WorkSource, x: number, y: number) => void
  onRemoveSource: (folderId: string, sourceId: string) => void
  lyricsPreviewOpen?: boolean
  onToggleLyricsPreview?: () => void
}) {
  switch (node.type) {
    case 'image':          return <ImageContent node={node} onUpdateNodeData={onUpdateNodeData}/>
    case 'audio':          return <AudioContent node={node} onUpdateNodeData={onUpdateNodeData}/>
    case 'text':           return <TextContent node={node} onUpdateNodeData={onUpdateNodeData} onUpdateNodeSize={onUpdateNodeSize}/>
    case 'intent':         return <IntentContent node={node}/>
    case 'constraint':     return <ConstraintContent node={node}/>
    case 'question':       return <QuestionContent node={node}/>
    case 'note':           return <NoteContent node={node} onUpdateNodeData={onUpdateNodeData}/>
    case 'interpretation': return <InterpretationContent node={node}/>
    case 'field':          return <FieldContent node={node}/>
    case 'lyrics':         return <LyricsContent node={node} onUpdateNodeData={onUpdateNodeData} previewOpen={lyricsPreviewOpen} onTogglePreview={onToggleLyricsPreview}/>
    case 'frame':          return <FrameContent node={node} nodes={nodes} wires={wires} langS={langS} onUpdateNodeData={onUpdateNodeData} onDivergeFrame={onDivergeFrame}/>
    case 'audioFolder':    return <AudioFolderContent node={node} nodes={nodes} wires={wires} onUpdateNodeData={onUpdateNodeData} onGenerate={onGenerateAudioFolder} onExtractSource={onExtractSource} onRemoveSource={onRemoveSource}/>
    case 'work':           return <WorkContent node={node} onOpenDetail={onOpenDemoDetail}/>
    case 'prompt':         return <PromptContent node={node}/>
    case 'direction':      return <DirectionContent node={node} onOpenDetail={onOpenDemoDetail}/>
    case 'fuse':           return <FuseContent node={node} inbound={inbound}/>
    case 'brief':          return <BriefContent node={node} onExport={onExport}/>
    case 'result':         return <SelectedDirectionContent node={node} onExport={onExport}/>
    default:               return null
  }
}

// 占位 token → 当前语言文案
function trToken(v: string | undefined, s: ReturnType<typeof useLang>): string {
  const map: Record<string,string> = {
    '__Q_WHICH__': s.qWhichElem,
    '__Q_CHALLENGE__': s.challengeQ,
    '__L_INSPIRED__': s.lInspired,
    '__L_PRESERVE__': s.lPreserve,
    '__L_INTERPRET__': s.lInterpretW,
    '__L_BRANCH__': s.branchFrom,
    '__L_FUSE__': s.actFuse,
    '__CORE_IDEA__': s.coreIdeaText,
    '__IMG__': s.nodeImage,
    '__HUM__': s.addHumClip,
    '__REF__': s.addRefAudio,
    '__EXPLORE__': s.aiExplore,
    '__FUSE__': s.hdrFuse,
    '__ASK_TENSION__': s.askTension,
    '__OPT_MELODY__': s.optMelody,
    '__OPT_REF__': s.optRef,
    '__OPT_BALANCE__': s.optBalance,
  }
  return (v && map[v]) || (v ?? '')
}

interface IdeationActions {
  onCommit:(id:string)=>void
  onCompareToggle:(id:string)=>void
}

// ── Fuse（保留能力，暂不在默认流）──

function FuseContent({ node, inbound: _inbound }: { node: CanvasNode; inbound: InboundRef[] }) {
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
        <div>
          <div style={{ fontSize:9, color:'#F5A52390', fontWeight:600, marginBottom:4 }}>{s.fromDirA}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {inheritsA.length > 0 ? inheritsA.map(t => <TraitChip key={t} label={t} color="#F5A523"/>) :
              <span style={{ fontSize:9, color:'#3A3A38' }}>{s.fuseOpen}</span>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ flex:1, height:1, background:'#1E1E1C' }}/>
          <span style={{ fontSize:11, color:'#F0609050' }}>⊕</span>
          <div style={{ flex:1, height:1, background:'#1E1E1C' }}/>
        </div>
        <div>
          <div style={{ fontSize:9, color:'#7A7A7890', fontWeight:600, marginBottom:4 }}>{s.fromDirB}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {inheritsB.length > 0 ? inheritsB.map(t => <TraitChip key={t} label={t} color="#7A7A78"/>) :
              <span style={{ fontSize:9, color:'#3A3A38' }}>{s.fuseOpen}</span>}
          </div>
        </div>
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

// ── Selected Direction / Creative Brief（终点：Ready to Produce）───────────────

const SD_WF = [6,10,16,12,20,26,22,14,18,28,32,26,20,14,18,24,30,26,18,12,16,22,28,32,26,20,14,10,16,24]

function SelectedDirectionContent({ node, onExport }: { node: CanvasNode; onExport: () => void }) {
  const s = useLang()
  const [committed, setCommitted] = useState(false)
  const [transOpen, setTransOpen] = useState(false)
  const [reflection, setReflection] = useState(String(node.data.reflection ?? ''))
  const [reflSaved, setReflSaved] = useState(false)
  const d = node.data
  const openQ = Number(d.openQ ?? 0)
  const confident = openQ === 0
  const title = trToken(d.title as string, s)
  const dna = (d.dna as string[] | undefined) ?? []
  const constraints = ((d.constraints as string[] | undefined) ?? []).map(c => trToken(c, s))
  const evolution = trToken(d.evolution as string, s)

  return (
    <div style={{
      width:'100%', height:'100%',
      background:'linear-gradient(160deg,#0E1A22 0%,#111610 40%,#101020 100%)',
      borderRadius:14, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative',
    }}>
      {/* Header */}
      <div style={{ height:38, flexShrink:0, borderBottom:'1px solid #1C3035',
        display:'flex', alignItems:'center', padding:'0 14px', gap:8, background:'rgba(0,0,0,0.2)' }}>
        <div style={{ width:20, height:20, borderRadius:5,
          background:'linear-gradient(135deg,#3BBDAF25,#6B6EF515)', border:'1px solid #3BBDAF35',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>✓</div>
        <span style={{ fontSize:11, fontWeight:700, color:'#3BBDAF' }}>{s.selectedDir}</span>
        {committed && (
          <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, padding:'2px 8px',
            borderRadius:10, background:'#5EC96E15', border:'1px solid #5EC96E40', color:'#5EC96E' }}>
            {s.committedTag}
          </span>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }} className="thin-scroll">
        {/* §29 Decision Confidence 提示（不阻止 Commit） */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 9px',
          borderRadius:7, background: confident ? '#5EC96E0C' : '#F5C87A0A',
          border:`1px solid ${confident ? '#5EC96E30' : '#F5C87A35'}` }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: confident ? '#5EC96E' : '#F5C87A' }}/>
          <span style={{ fontSize:9.5, fontWeight:700, color: confident ? '#5EC96E' : '#F5C87A' }}>
            {confident ? s.confReady : `${s.confStill} · ${openQ} ${s.openQ}`}
          </span>
        </div>

        {/* Title */}
        <div>
          <div style={{ fontSize:15.5, fontWeight:700, color:'#E8E8E4', letterSpacing:'-0.02em', lineHeight:1.3 }}>{title}</div>
          <div style={{ display:'flex', gap:7, marginTop:4 }}>
            <span style={{ fontSize:9.5, color:'#3A5055', fontFamily:"'JetBrains Mono',monospace" }}>{String(d.duration ?? '')}</span>
            <span style={{ fontSize:9.5, color:'#3A5055', fontFamily:"'JetBrains Mono',monospace" }}>{String(d.bpm ?? '')} BPM</span>
            <span style={{ fontSize:9.5, color:'#3A5055', fontFamily:"'JetBrains Mono',monospace" }}>{String(d.key ?? '')}</span>
          </div>
        </div>

        {/* Core Idea */}
        <div style={{ padding:'7px 9px', background:'#141413', borderLeft:'2px solid #3BBDAF60', borderRadius:6 }}>
          <div style={{ fontSize:8.5, color:'#4A4A48', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2 }}>{s.coreIdea}</div>
          <div style={{ fontSize:10.5, color:'#B8C4C2', fontStyle:'italic', lineHeight:1.5 }}>“{trToken(String(d.coreIdea ?? ''), s)}”</div>
        </div>

        {/* DNA chips */}
        <div>
          <div style={{ fontSize:8.5, color:'#4A4A48', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Creative DNA</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {dna.map(c => (
              <span key={c} style={{ fontSize:9.5, fontWeight:600, padding:'2px 8px', borderRadius:20,
                background:'#3BBDAF12', border:'1px solid #3BBDAF28', color:'#5FCFC3' }}>{c}</span>
            ))}
          </div>
        </div>

        {/* Constraints */}
        <div>
          <div style={{ fontSize:8.5, color:'#4A4A48', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{s.constraintsTitle}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {constraints.map((c,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#C0C0BC' }}>
                🔒 {c}
              </div>
            ))}
          </div>
        </div>

        {/* Evolution path */}
        <div>
          <div style={{ fontSize:8.5, color:'#4A4A48', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{s.evoPath}</div>
          <div style={{ fontSize:10, color:'#8A8AFF', fontFamily:"'JetBrains Mono',monospace", lineHeight:1.6,
            padding:'6px 8px', background:'#14141E', border:'1px solid #222238', borderRadius:6 }}>
            {evolution}
          </div>
        </div>

        {/* Sketch waveform */}
        <div style={{ display:'flex', alignItems:'center', gap:1.2, height:34 }}>
          {SD_WF.map((h,i) => (
            <div key={i} style={{ flex:1, borderRadius:2, height:Math.max(3,h*0.85),
              background: i<12 ? 'linear-gradient(to top,#3BBDAF70,#3BBDAF30)' : '#1C3035' }}/>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding:'10px 14px 13px', borderTop:'1px solid #152025', display:'flex', flexDirection:'column', gap:6 }}>
        {!committed ? (
          <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{ e.stopPropagation(); setCommitted(true) }}
            style={{ width:'100%', padding:'9px', background:'linear-gradient(135deg,#3BBDAF,#2EA89B)',
              border:'none', borderRadius:8, color:'#06201E', fontSize:12, fontWeight:800, cursor:'pointer',
              fontFamily:"'Inter',sans-serif", boxShadow:'0 4px 20px #3BBDAF35' }}>
            ✓ {s.commitDirection}
          </button>
        ) : (
          <>
            {/* §38 Reflection */}
            {!reflSaved ? (
              <div style={{ padding:'7px 9px', background:'#14141E', border:'1px solid #23233A', borderRadius:7 }}>
                <div style={{ fontSize:9.5, color:'#8A8AFF', fontWeight:700, marginBottom:4 }}>{s.reflectQ}</div>
                <input value={reflection} onChange={e=>setReflection(e.target.value)}
                  onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
                  placeholder={s.reflectPh}
                  style={{ width:'100%', boxSizing:'border-box', background:'#0F0F18',
                    border:'1px solid #2C2C44', borderRadius:5, color:'#C8C8E8', fontSize:10,
                    padding:'5px 8px', outline:'none', marginBottom:5 }}/>
                <div style={{ display:'flex', gap:4 }}>
                  <button onPointerDown={e=>e.stopPropagation()}
                    onClick={()=>{ if (reflection.trim()) setReflSaved(true) }}
                    style={{ flex:1, padding:'4px', background:'#6B6EF525', border:'none',
                      borderRadius:4, color:'#A8AAFF', fontSize:9, fontWeight:700, cursor:'pointer' }}>✓</button>
                  <button onPointerDown={e=>e.stopPropagation()} onClick={()=>setReflSaved(true)}
                    style={{ flex:1, padding:'4px', background:'transparent', border:'1px solid #2C2C2A',
                      borderRadius:4, color:'#5A5A56', fontSize:9, cursor:'pointer' }}>{s.reflectSkip}</button>
                </div>
              </div>
            ) : reflSaved && reflection.trim() ? (
              <div style={{ fontSize:9.5, color:'#9AD4A6', fontStyle:'italic', lineHeight:1.5,
                padding:'5px 8px', background:'#5EC96E08', borderRadius:6, border:'1px solid #5EC96E20' }}>
                “{reflection}”
              </div>
            ) : null}

            {/* §26 Translation Preview */}
            <div style={{ border:'1px solid #1E3035', borderRadius:7, overflow:'hidden' }}>
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>setTransOpen(o=>!o)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:6,
                  padding:'6px 9px', background:'#101A1E', border:'none', cursor:'pointer' }}>
                <span style={{ fontSize:9, fontWeight:800, color:'#5FA8A0', letterSpacing:'0.04em' }}>
                  {s.transPreview}
                </span>
                <span style={{ marginLeft:'auto', fontSize:9, color:'#3A5055' }}>{transOpen ? '▾' : '▸'}</span>
              </button>
              <div style={{ padding:'0 9px 7px', fontSize:9.5, color:'#7FA8A2', lineHeight:1.5 }}>
                {s.transSummary}
                {transOpen && (
                  <pre style={{ margin:'6px 0 0', padding:'7px 8px', background:'#0C1214',
                    border:'1px solid #16242A', borderRadius:5, fontSize:8.5, color:'#5A7A80',
                    whiteSpace:'pre-wrap', fontFamily:"'JetBrains Mono',monospace" }}>
{`direction: warm restrained city-pop
mood: nostalgic, bittersweet
energy: 0.55  texture: warm analog
keep: original melody
avoid: heavy EDM drops`}
                  </pre>
                )}
                {transOpen && (
                  <div style={{ fontSize:8.5, color:'#3A5055', marginTop:4 }}>{s.transParams}</div>
                )}
              </div>
            </div>

            {/* §27 Output Compatibility */}
            <div style={{ fontSize:8.5, fontWeight:800, color:'#4A6A70', textTransform:'uppercase',
              letterSpacing:'0.06em' }}>{s.readyFor}</div>
            <div style={{ display:'flex', gap:5 }}>
              <SDBtn label={s.readyAI} onClick={()=>{}} accent/>
              <SDBtn label={s.readyProd} onClick={onExport}/>
              <SDBtn label={s.readyCollab} onClick={onExport}/>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SDBtn({ label, onClick, accent }: { label:string; onClick:()=>void; accent?:boolean }) {
  return (
    <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{ e.stopPropagation(); onClick() }}
      style={{
        flex:1, padding:'7px 0',
        background: accent ? '#141413' : '#141413',
        border: accent ? '1px solid #F5A52345' : '1px solid #1E3035', borderRadius:7,
        color: accent ? '#F0B45A' : '#5FA8A0', fontSize:10.5, fontWeight:600,
        cursor:'pointer', fontFamily:"'Inter',sans-serif", transition:'all 0.12s',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor = accent ? '#F5A52380' : '#2E5058'; e.currentTarget.style.color = accent ? '#FFD08A' : '#8ACCC4' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor = accent ? '#F5A52345' : '#1E3035'; e.currentTarget.style.color = accent ? '#F0B45A' : '#5FA8A0' }}
    >{label}</button>
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

// ── 音频创作夹：Cover / Remix / Mashup ──

function FrameContent({ node, nodes, wires, langS: s, onUpdateNodeData, onDivergeFrame }: {
  node: CanvasNode; nodes: CanvasNode[]; wires: Wire[]; langS: ReturnType<typeof useLang>
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void
  onDivergeFrame: (frameId: string) => void
}) {
  const lang=s.langToggle==='EN'?'zh':'en'
  const connectedLyrics = wires
    .filter(w => w.toNodeId === node.id || w.fromNodeId === node.id)
    .map(w => {
      const otherId = w.toNodeId === node.id ? w.fromNodeId : w.toNodeId
      return nodes.find(n => n.id === otherId && n.type === 'lyrics' && n.visible)
    })
    .filter(Boolean) as CanvasNode[]
  const wOf = (m: CanvasNode) => Number(m.data.weight ?? 35)
  const mats = nodes.filter(n =>
    ['image','audio','text'].includes(n.type) && n.visible &&
    n.x + n.w/2 > node.x && n.x + n.w/2 < node.x + FRAME_CANVAS_W &&
    n.y + n.h/2 > node.y && n.y + n.h/2 < node.y + node.h)
  const d = node.data
  const generating = !!d.generating
  const set = (patch: Record<string, unknown>) => onUpdateNodeData(node.id, patch)
  const matIcon = (m: CanvasNode):TileIconKind => m.type === 'image' ? 'image' : m.type === 'text' ? 'text' : (m.data.isRef ? 'reference' : 'hum')
  const matName = (m: CanvasNode) => {
    if (m.type === 'text') return String(m.data.title ?? '') || s.hdrText
    const raw = String(m.data.label ?? m.data.name ?? '')
    if (raw === '__HUM__') return s.addHumClip
    if (raw === '__REF__') return s.addRefAudio
    if (raw === '__HUM__' || raw === '__REF__' || raw.startsWith('__')) return raw.replace(/__/g, '')
    return localizeBuiltinText(raw || s.nodeAudio,lang)
  }
  const matColor = (m: CanvasNode) => nodeThemeColor(m)
  // 场本地坐标：扣除黑板头部 + 卡片边框 1px
  const mrect = (m: CanvasNode) => {
    const frameHasLyricsM = wires.some(w => (w.toNodeId === node.id || w.fromNodeId === node.id) && nodes.some(n => n.id === (w.toNodeId === node.id ? w.fromNodeId : w.toNodeId) && n.type === 'lyrics' && n.visible))
    const dispX = Math.min(m.x, node.x + FRAME_CANVAS_W - m.w - 6)
    const x = dispX - node.x - 1, y = m.y - node.y - FRAME_HEADER_H - (frameHasLyricsM ? FRAME_LYRICS_BAR_H : 0) - 1
    return { x, y, w: m.w, h: m.h, cx: x + m.w/2, cy: y + m.h/2 }
  }

  // 清晰度（比重分布熵）
  const ws = mats.map(wOf)
  const total = ws.reduce((a,b)=>a+b,0)
  let clarity = 0
  if (ws.length > 1 && total > 0) {
    const H = -ws.reduce((acc,w)=>{ const p=w/total; return acc + (p>0 ? p*Math.log(p) : 0) },0)
    clarity = 1 - H/Math.log(ws.length)
  }
  const clCfg = clarity < 0.35 ? { c:'#7A7A78', t:s.amb0 }
    : clarity < 0.62 ? { c:'#F5C87A', t:s.amb1 } : { c:'#5EC96E', t:s.amb2 }
  const CIRC = 2 * Math.PI * 9
  const autoPrompt = composeFramePrompt(s, node, mats)
  const prompt = d.promptDirty ? String(d.prompt ?? '') : autoPrompt

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', borderRadius:14 }}>
      {/* Header — 上层遮盖 */}
      <div data-frame-header={node.id} style={{ position:'relative', zIndex:10, flexShrink:0, height:FRAME_HEADER_H, boxSizing:'border-box', background:'#131312', borderBottom:'1px solid #26262A',
        display:'flex', alignItems:'center', gap:9, padding:'10px 14px' }}>
        <MaterialMiniature colors={mats.map(matColor)} accent="#6B6EF5"/>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
            <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'#8A8AFF', flexShrink:0 }}>{s.frameTitle}</span>
            <input value={localizeBuiltinText(d.name,lang)} placeholder={s.fieldPh}
              onClick={e=>e.stopPropagation()} onPointerDown={e=>{ e.stopPropagation(); (e.target as HTMLElement).focus() }}
              onChange={e=>set({ name: e.target.value })}
              style={{ width:140, flexShrink:0, background:'transparent', border:'none', outline:'none',
                color:'#ECEBF5', fontSize:11.5, fontWeight:800, padding:'1px 4px',
                fontStyle: d.name ? 'normal' : 'italic', overflow:'hidden', textOverflow:'ellipsis' }}/>
          </div>
          <div style={{ fontSize:8.5, color:'#69677A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {mats.length ? mats.map(m=>matName(m)).join(' + ') : s.frameEmptyHint}
          </div>
        </div>
        <span style={{ fontSize:8.5, color:'#6B6EF5', fontWeight:800, fontFamily:"'JetBrains Mono',monospace", flexShrink:0, marginLeft:8 }}>
          {mats.length} {s.inFrameTag}
        </span>
        <div style={{ width:28, height:28, flexShrink:0, display:'grid', placeItems:'center' }}>
          <TileTypeIcon kind="frame" color="#8A8AFF" size={22}/>
        </div>
      </div>
      {connectedLyrics.length > 0 && (
        <div style={{ position:'relative', zIndex:10, flexShrink:0, height:FRAME_LYRICS_BAR_H, boxSizing:'border-box', background:'#1A1218', borderBottom:'1px solid #2E1E26', padding:'6px 14px', display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:8, fontWeight:700, color:'#E56B8A', background:'#E56B8A18', border:'1px solid #E56B8A30', borderRadius:10, padding:'2px 6px', flexShrink:0, display:'inline-flex', alignItems:'center', gap:4 }}>
            <TileTypeIcon kind="lyrics" color="#E56B8A" size={10}/> {lang==='zh'?'已连接歌词':'Lyrics connected'}
          </span>
          <span style={{ flex:1, minWidth:0, fontSize:9.5, color:'#D8B0BE', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {connectedLyrics.map(n => localizeBuiltinText((n.data as any).title ?? '未命名歌词',lang)).join(' · ')}
          </span>
          <span style={{ fontSize:8, color:'#8A5A6E', flexShrink:0 }}>{connectedLyrics.length} {lang==='zh'?'首':'tracks'}</span>
        </div>
      )}

      <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:`${FRAME_CANVAS_W}px 1fr` }}>
        <div data-frame-canvas={node.id} style={{ position:'relative', zIndex:1, overflow:'hidden', background:'#141413', borderRight:'1px solid #292928', contain:'paint', clipPath:'inset(0)' }}>
          <svg aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none"
            style={{ position:'absolute', inset:0, opacity:0.045, pointerEvents:'none', mixBlendMode:'soft-light' }}>
            <filter id={`board-noise-${node.id}`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" seed="17" stitchTiles="stitch"/>
            </filter>
            <rect width="100%" height="100%" filter={`url(#board-noise-${node.id})`} opacity="0.7"/>
          </svg>
          <div style={{ position:'absolute', inset:0, opacity:0.18,
            backgroundImage:'radial-gradient(#3A3A38 0.65px, transparent 0.65px)', backgroundSize:'18px 18px' }}/>
          {mats.length === 0 && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
              color:'#4A4A48', fontSize:11, letterSpacing:'0.02em' }}>
              {s.frameEmptyHint}
            </div>
          )}
          {mats.length > 1 && (
            <svg width="100%" height="100%" style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
              <defs>
                {mats.flatMap((a, i) => mats.slice(i+1).map(b => {
                  const ca = matColor(a), cb = matColor(b)
                  return <linearGradient key={`g-${a.id}-${b.id}`} id={`grad-${a.id}-${b.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={ca} stopOpacity="0.58"/>
                    <stop offset="100%" stopColor={cb} stopOpacity="0.58"/>
                  </linearGradient>
                }))}
              </defs>
              {mats.flatMap((a, i) => mats.slice(i+1).map(b => {
                const ra = mrect(a), rb = mrect(b)
                const avgW = (wOf(a) + wOf(b)) / 2
                return <line key={`${a.id}-${b.id}`} x1={ra.cx} y1={ra.cy} x2={rb.cx} y2={rb.cy}
                  stroke={`url(#grad-${a.id}-${b.id})`} strokeWidth="1.1" strokeLinecap="round" strokeDasharray="4 6" opacity={0.34 + avgW/420}/>
              }))}
            </svg>
          )}
        </div>

        <div style={{ position:'relative', zIndex:10, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden',
          background:'linear-gradient(180deg,#121211,#10100F)' }}>
          <div className="thin-scroll explore-scroll" style={{ flex:1, minHeight:0, overflowY:'auto', padding:'13px 13px 12px', display:'flex', flexDirection:'column', gap:12, overscrollBehavior:'contain' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:10.5, fontWeight:800, color:'#A0A09C' }}>{s.panelTitle}</span>
              <span style={{ fontSize:8.5, color:'#4A4A48' }}>{s.weightHint}</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:9, color:'#62625E', fontWeight:700 }}>{s.weightL}</div>
              {mats.map(m => (
                <div
                  key={m.id}
                  data-guide-target={`weight-${m.id}`}
                  onPointerDown={e=>{
                    e.stopPropagation()
                    const el = e.currentTarget as HTMLElement
                    const rect = el.getBoundingClientRect()
                    const toWeight = (cx:number) => Math.max(5, Math.min(100, Math.round(((cx - rect.left) / rect.width) * 100)))
                    onUpdateNodeData(m.id, { weight: toWeight(e.clientX) })
                    const onMove = (ev: PointerEvent) => onUpdateNodeData(m.id, { weight: toWeight(ev.clientX) })
                    const onUp = () => {
                      window.removeEventListener('pointermove', onMove)
                      window.removeEventListener('pointerup', onUp)
                    }
                    window.addEventListener('pointermove', onMove)
                    window.addEventListener('pointerup', onUp)
                    try { el.setPointerCapture((e as unknown as { pointerId:number }).pointerId) } catch {}
                  }}
                  style={{ position:'relative', height:25, borderRadius:7, overflow:'hidden',
                  border:`1px solid ${matColor(m)}30`, background:'#171716', cursor:'ew-resize' }}>
                  <div style={{ position:'absolute', inset:'0 auto 0 0', width:`${wOf(m)}%`, background:matColor(m)+'20', transition:'none' }}/>
                  <div style={{ position:'relative', height:'100%', padding:'0 8px', display:'flex', alignItems:'center', gap:6, pointerEvents:'none' }}>
                    <TileTypeIcon kind={matIcon(m)} color={matColor(m)} size={13}/>
                    <span style={{ flex:1, minWidth:0, fontSize:9.5, fontWeight:650, color:'#A0A09C', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{matName(m)}</span>
                    <span style={{ color:matColor(m), fontSize:9, fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>{wOf(m)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <SegRow label={s.modeL}>
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>set({ mode:'inst' })} style={segBtn(d.mode==='inst','#3BBDAF')}>{s.modeInst}</button>
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>set({ mode:'song' })} style={segBtn(d.mode!=='inst','#3BBDAF')}>{s.modeSong}</button>
            </SegRow>

            {d.mode !== 'inst' && (
              <SegRow label={s.vocalL}>
                <button onPointerDown={e=>e.stopPropagation()} onClick={()=>set({ vocal:'male' })} style={segBtn(d.vocal==='male','#F5A523')}>{s.male}</button>
                <button onPointerDown={e=>e.stopPropagation()} onClick={()=>set({ vocal:'female' })} style={segBtn(d.vocal!=='male','#F5A523')}>{s.female}</button>
              </SegRow>
            )}

            <SegRow label={s.timeSignature}>
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>set({ timeSig: '' })}
                style={{ ...segBtn(!d.timeSig || d.timeSig==='' ,'#9B7EFF'), flex:1, padding:'5px 0' }}>{lang==='zh'?'不指定':'Any'}</button>
              {['4/4','3/4','6/8','5/4','7/8'].map(sig => (
                <button key={sig} onPointerDown={e=>e.stopPropagation()} onClick={()=>set({ timeSig:sig })}
                  style={{ ...segBtn(d.timeSig===sig,'#9B7EFF'), flex:1, padding:'5px 0' }}>{sig}</button>
              ))}
            </SegRow>

            <div style={{ display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:9, color:'#A65C50', fontWeight:700, marginBottom:5 }}>⊘ {s.negativeL}</div>
              <textarea value={localizeBuiltinText(d.negative,lang)} placeholder={s.negativePh}
                onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
                onChange={e=>set({ negative:e.target.value })}
                style={{ height:72, width:'100%', resize:'none', padding:'7px 8px', borderRadius:7,
                  background:'#140F0E', border:'1px solid #3A2422', color:'#9A6A64', fontSize:9,
                  lineHeight:1.45, outline:'none', fontFamily:"'Inter',sans-serif" }}/>
            </div>
          </div>
          <div style={{ flexShrink:0, padding:'0 13px 14px', background:'linear-gradient(180deg,#121211,#10100F)', borderTop:'1px solid #1E1E1E' }}>
            <button data-guide-target={`frame-generate-${node.id}`} disabled={generating || mats.length === 0}
              onPointerDown={e=>e.stopPropagation()} onClick={e=>{ e.stopPropagation(); onDivergeFrame(node.id) }}
              style={{ width:'100%', minHeight:38, border:0, borderRadius:8, cursor:generating || mats.length===0 ? 'default' : 'pointer',
                color:'#F4F4FF', fontSize:11.5, fontWeight:800,
                background:generating || mats.length===0 ? '#28282A' : 'linear-gradient(100deg,#686CF4,#9877F4)',
                boxShadow:generating ? 'none' : '0 8px 24px rgba(107,110,245,.2)', opacity:mats.length===0 ? .5 : 1 }}>
              {generating ? <span>✦ {s.divergingB} <i className="ai-dot-1">·</i><i className="ai-dot-2">·</i><i className="ai-dot-3">·</i></span> : `✦ ${s.divergeBtn}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function segBtn(active: boolean, color: string): React.CSSProperties {
  return {
    flex:1, padding:'5px 0', borderRadius:6, cursor:'pointer',
    background: active ? color+'20' : '#1A1A19',
    border:`1px solid ${active ? color+'55' : '#2A2A28'}`,
    color: active ? color : '#5A5A56',
    fontSize:10, fontWeight: active ? 700 : 500,
  }
}

function SegRow({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:9, color:'#5A5A56', fontWeight:600, marginBottom:4 }}>{label}</div>
      <div style={{ display:'flex', gap:3 }}>{children}</div>
    </div>
  )
}

function composeFramePrompt(s: ReturnType<typeof useLang>, frame: CanvasNode, mats: CanvasNode[]): string {
  const lang=s.langToggle==='EN'?'zh':'en'
  const sorted = [...mats].sort((a,b)=>(Number(b.data.weight??0))-(Number(a.data.weight??0)))
  const parts = sorted.map(m => `${localizeBuiltinText(m.data.name ?? m.data.label,lang).slice(0,18)} ${Number(m.data.weight??0)}%`)
  const vocal = frame.data.mode === 'inst' ? s.modeInst : `${s.modeSong} · ${frame.data.vocal==='male'?s.male:s.female}`
  const ref = mats.find(m=>m.data.isRef)
  const an = ref?.data.analysis as { bpm:number; key:string; style:string } | undefined
  const timeSigRaw = String(frame.data.timeSig ?? '').trim()
  const timeSigPart = timeSigRaw ? `${timeSigRaw} ${s.timeSignature}` : `${s.timeSignature}: ${s.durationAuto}`
  const L = [
    `${vocal}，${timeSigPart}${an ? `，${an.bpm} BPM · ${an.key}` : ''}。`,
    an ? `${s.styleL}: ${an.style}。` : '',
    sorted[0] ? `${s.weightL}: ${parts.join(' · ')}。` : '',
    `${s.tensionText}。`,
  ]
  return L.filter(Boolean).join('')
}

// ── Prompt 卡 ──

function PromptContent({ node }: { node: CanvasNode }) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  return (
    <div style={{ width:'100%', height:'100%', background:'#101014', borderRadius:10,
      border:'1px solid #26263A', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:32, flexShrink:0, display:'flex', alignItems:'center', gap:7,
        padding:'0 11px', borderBottom:'1px solid #1E1E2C' }}>
        <span style={{ fontSize:9, fontWeight:800, color:'#8A8AFF', letterSpacing:'0.06em',
          textTransform:'uppercase' }}>✦ {s.usedPromptL}</span>
      </div>
      <pre style={{ flex:1, minHeight:0, margin:0, padding:'10px 12px', overflowY:'auto',
        fontSize:10, lineHeight:1.7, color:'#9A9AC0', whiteSpace:'pre-wrap',
        fontFamily:"'JetBrains Mono',monospace" }} className="thin-scroll">{localizeBuiltinText(node.data.text,lang)}</pre>
    </div>
  )
}
