import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CanvasNode } from '../../types'
import { DEMO_CARD_H, DEMO_CARD_W, WORK_CARD_H, WORK_CARD_W } from './model'
import type { DemoItem, WorkItem } from './model'
import { DemoCard } from './DemoCard'
import { WorkCard } from './WorkCard'

export function FrameDemoDrawer({ node, onUpdateNodeData, onExtractDemo, onDemoContextMenu }: {
  node: CanvasNode
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void
  onExtractDemo: (frameId: string, demo: DemoItem, clientX: number, clientY: number) => void
  onDemoContextMenu?: (e:React.MouseEvent, demo:DemoItem) => void
}) {
  const demos = (node.data.demos as DemoItem[] | undefined) ?? []
  const generating = !!node.data.generating
  const [leavingIds, setLeavingIds] = useState<string[]>([])
  const [drawerClosing, setDrawerClosing] = useState(false)
  type ActiveDemoDrag = { demo:DemoItem; startX:number; startY:number; x:number; y:number; offsetX:number; offsetY:number; width:number; height:number; moved:boolean }
  const [dragging, setDragging] = useState<ActiveDemoDrag | null>(null)
  const demoDragRef = useRef<ActiveDemoDrag | null>(null)
  const extractedIdsRef = useRef<Set<string>>(new Set())

  const removeDemo = (id: string, instant = false) => {
    if (leavingIds.includes(id)) return
    if (instant) {
      const next = demos.filter(demo => demo.id !== id)
      if (next.length === 0) {
        // 最后一条：立即从展示层移除，避免 320ms 内残影复现；抽屉动画仍可播放（空状态）
        extractedIdsRef.current.add(id)
        setDrawerClosing(true)
        window.setTimeout(() => onUpdateNodeData(node.id, { demos: [] }), 320)
      } else {
        onUpdateNodeData(node.id, { demos: next })
      }
      return
    }
    setLeavingIds(ids => [...ids, id])
    window.setTimeout(() => {
      const next = demos.filter(demo => demo.id !== id)
      if (next.length === 0) {
        setDrawerClosing(true)
        window.setTimeout(() => onUpdateNodeData(node.id, { demos: [] }), 320)
      } else {
        onUpdateNodeData(node.id, { demos: next })
        setLeavingIds(ids => ids.filter(x => x !== id))
      }
    }, 220)
  }

  const startDemoDrag = (e: React.PointerEvent<HTMLElement>, demo: DemoItem) => {
    if (e.button !== 0) return
    if (leavingIds.includes(demo.id)) return
    e.stopPropagation()
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const next: ActiveDemoDrag = {
      demo, startX:e.clientX, startY:e.clientY, x:e.clientX, y:e.clientY,
      offsetX:e.clientX-rect.left, offsetY:e.clientY-rect.top,
      width:rect.width, height:rect.height, moved:false,
    }
    demoDragRef.current = next
    setDragging(next)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  useEffect(() => {
    if (!dragging) return
    const finish = (e: PointerEvent, cancelled = false) => {
      const active = demoDragRef.current
      if (!active) return
      demoDragRef.current = null
      setDragging(null)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      const distance = Math.hypot(e.clientX-active.startX, e.clientY-active.startY)
      if (cancelled || !active.moved || distance <= 42 || extractedIdsRef.current.has(active.demo.id)) return
      extractedIdsRef.current.add(active.demo.id)
      onExtractDemo(node.id, active.demo, e.clientX-active.offsetX, e.clientY-active.offsetY)
      removeDemo(active.demo.id, true)
    }
    const move = (e: PointerEvent) => {
      const active = demoDragRef.current
      if (!active) return
      const next = { ...active, x:e.clientX, y:e.clientY,
        moved:active.moved || Math.hypot(e.clientX-active.startX,e.clientY-active.startY) > 8 }
      demoDragRef.current = next
      setDragging(next)
    }
    const up = (e: PointerEvent) => finish(e)
    const cancel = (e: PointerEvent) => finish(e, true)
    window.addEventListener('pointermove', move, { passive:true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [dragging, node.id, onExtractDemo, demos, leavingIds])

  // 展示层过滤：已拖走的卡片不再渲染；拖动中超过 8px 即从原位移除，跟手自然移动，原地不留卡
  const displayDemos = demos.filter(d => !extractedIdsRef.current.has(d.id) && !(dragging?.demo.id === d.id && dragging.moved))
  return (
    <>
    <div className={drawerClosing ? 'drawer-up' : 'drawer-down'}
      onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
      style={{ position:'absolute', left:18, right:18, top:'100%', zIndex:12, padding:'14px 14px 16px',
        background:'linear-gradient(180deg,#151514,#10100F)', border:'1px solid #30302E', borderTop:'none',
        borderRadius:'0 0 14px 14px', boxShadow:'0 22px 48px rgba(0,0,0,.58)',
        display:'grid', gridTemplateColumns:`repeat(3,${DEMO_CARD_W}px)`, justifyContent:'center', gap:12 }}>
      {(generating ? [0,1,2] : displayDemos).map((item, index) => {
        if (typeof item === 'number') return <DemoSkeleton key={item} delay={item * 90}/>
        const demo = item as DemoItem
        return (
          <article key={demo.id} data-guide-target={`drawer-demo-${demo.id}`} className={`${leavingIds.includes(demo.id) ? 'demo-out' : 'demo-pop'}`}
            onPointerDown={e=>startDemoDrag(e,demo)}
            onContextMenu={e=>onDemoContextMenu?.(e,demo)}
            style={{ animationDelay:leavingIds.includes(demo.id) ? '0s' : `${index*90}ms`,
              width:DEMO_CARD_W, height:DEMO_CARD_H, minWidth:0, cursor:'grab', touchAction:'none',
              position:'relative', opacity:1, transition:'box-shadow .18s ease' }}>
            <DemoCard demo={demo} cardId={demo.id} onRemove={()=>removeDemo(demo.id)}/>
          </article>
        )
      })}
    </div>
    {dragging && dragging.moved && createPortal(<DemoDragPreview drag={dragging}/>, document.body)}
    </>
  )
}

function DemoDragPreview({ drag }: {
  drag:{ demo:DemoItem; x:number; y:number; offsetX:number; offsetY:number; width:number; height:number; startX:number; startY:number; moved:boolean }
}) {
  const scaleX = drag.width / DEMO_CARD_W
  const scaleY = drag.height / DEMO_CARD_H
  return (
    <div style={{ position:'fixed', left:drag.x-drag.offsetX, top:drag.y-drag.offsetY,
      width:drag.width, height:drag.height, zIndex:10000, pointerEvents:'none',
      willChange:'left, top' }}>
      <div style={{ width:DEMO_CARD_W, height:DEMO_CARD_H, transformOrigin:'top left',
        transform:`scale(${scaleX},${scaleY})` }}>
        <DemoCard demo={drag.demo} cardId={drag.demo.id}/>
      </div>
    </div>
  )
}

export function WorkDrawer({ node, onUpdateNodeData, onExtractWork, onWorkContextMenu }: {
  node:CanvasNode
  onUpdateNodeData:(id:string,patch:Record<string,unknown>)=>void
  onExtractWork:(folderId:string,work:WorkItem,clientX:number,clientY:number)=>void
  onWorkContextMenu?:(e:React.MouseEvent,work:WorkItem)=>void
}) {
  const works = (node.data.works as WorkItem[] | undefined) ?? []
  const generating = !!node.data.generating
  const [closing,setClosing] = useState(false)
  const [leavingIds,setLeavingIds] = useState<string[]>([])
  type ActiveWorkDrag = { work:WorkItem;startX:number;startY:number;x:number;y:number;offsetX:number;offsetY:number;width:number;height:number;moved:boolean }
  const [dragging,setDragging] = useState<ActiveWorkDrag|null>(null)
  const dragRef = useRef<ActiveWorkDrag|null>(null)
  const extractedRef = useRef<Set<string>>(new Set())

  const remove = (id:string,instant=false) => {
    if (leavingIds.includes(id)) return
    const finish = () => {
      const next = works.filter(work=>work.id!==id)
      if (next.length===0) {
        extractedRef.current.add(id)
        setClosing(true)
        window.setTimeout(()=>onUpdateNodeData(node.id,{works:[]}),320)
      } else {
        onUpdateNodeData(node.id,{works:next})
        setLeavingIds(ids=>ids.filter(x=>x!==id))
      }
    }
    if (instant) finish()
    else { setLeavingIds(ids=>[...ids,id]); window.setTimeout(finish,220) }
  }

  const start = (e:React.PointerEvent<HTMLElement>,work:WorkItem) => {
    if(e.button!==0)return
    e.stopPropagation(); e.preventDefault()
    const rect=e.currentTarget.getBoundingClientRect()
    const next:ActiveWorkDrag={work,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,
      offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,width:rect.width,height:rect.height,moved:false}
    dragRef.current=next;setDragging(next)
    document.body.style.userSelect='none';document.body.style.cursor='grabbing'
  }

  useEffect(()=>{
    if (!dragging) return
    const move=(e:PointerEvent)=>{
      const active=dragRef.current;if(!active)return
      const next={...active,x:e.clientX,y:e.clientY,moved:active.moved||Math.hypot(e.clientX-active.startX,e.clientY-active.startY)>8}
      dragRef.current=next;setDragging(next)
    }
    const finish=(e:PointerEvent,cancelled=false)=>{
      const active=dragRef.current;if(!active)return
      dragRef.current=null;setDragging(null);document.body.style.userSelect='';document.body.style.cursor=''
      if(cancelled||!active.moved||Math.hypot(e.clientX-active.startX,e.clientY-active.startY)<=42||extractedRef.current.has(active.work.id))return
      extractedRef.current.add(active.work.id)
      onExtractWork(node.id,active.work,e.clientX-active.offsetX,e.clientY-active.offsetY)
      remove(active.work.id,true)
    }
    const up=(e:PointerEvent)=>finish(e),cancel=(e:PointerEvent)=>finish(e,true)
    window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel)
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);document.body.style.userSelect='';document.body.style.cursor=''}
  },[dragging, node.id,works,leavingIds,onExtractWork])

  const displayWorks=works.filter(work=>!extractedRef.current.has(work.id)&&!(dragging?.work.id===work.id&&dragging.moved))
  return <>
    <div style={{position:'absolute',left:'50%',top:'100%',width:540,transform:'translateX(-50%)',zIndex:14,pointerEvents:'auto'}}>
      <div className={closing?'drawer-up':'drawer-down'} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
        style={{padding:'14px',display:'grid',gridTemplateColumns:`repeat(2,${WORK_CARD_W}px)`,gap:12,
          background:'linear-gradient(155deg,#15141D,#0F1115)',border:'1px solid #353044',borderTop:'none',borderRadius:'0 0 15px 15px',
          boxShadow:'0 26px 60px rgba(0,0,0,.64),0 0 40px rgba(124,98,255,.10)'}}>
        {(generating?[0,1]:displayWorks).map((item,index)=>{
          if(typeof item==='number')return <WorkSkeleton key={item} delay={item*110}/>
          const work=item as WorkItem
          return <article key={work.id} className={leavingIds.includes(work.id)?'demo-out':'demo-pop'} onPointerDown={e=>start(e,work)}
            onContextMenu={e=>onWorkContextMenu?.(e,work)}
            style={{animationDelay:leavingIds.includes(work.id)?'0s':`${index*110}ms`,
              width:WORK_CARD_W,height:WORK_CARD_H,minWidth:0,cursor:'grab',touchAction:'none',position:'relative'}}>
            <WorkCard work={work} cardId={work.id} onRemove={()=>remove(work.id)}/>
          </article>
        })}
      </div>
    </div>
    {dragging&&dragging.moved&&createPortal(<WorkDragPreview drag={dragging}/>,document.body)}
  </>
}

function WorkDragPreview({drag}:{
  drag:{work:WorkItem;x:number;y:number;offsetX:number;offsetY:number;width:number;height:number;startX:number;startY:number;moved:boolean}
}) {
  const scaleX=drag.width/WORK_CARD_W,scaleY=drag.height/WORK_CARD_H
  return <div style={{position:'fixed',left:drag.x-drag.offsetX,top:drag.y-drag.offsetY,
    width:drag.width,height:drag.height,zIndex:10000,pointerEvents:'none',willChange:'left,top'}}>
    <div style={{width:WORK_CARD_W,height:WORK_CARD_H,transformOrigin:'top left',transform:`scale(${scaleX},${scaleY})`}}>
      <WorkCard work={drag.work} cardId={drag.work.id}/>
    </div>
  </div>
}

function WorkSkeleton({delay}:{delay:number}) {
  return <div className="demo-pop" style={{animationDelay:`${delay}ms`,width:WORK_CARD_W,height:WORK_CARD_H,borderRadius:11,overflow:'hidden',border:'1px solid #332E44',background:'#16151D'}}>
    <div className="shimmer" style={{height:'100%',opacity:.8}}/>
  </div>
}

function DemoSkeleton({ delay }: { delay:number }) {
  return (
    <div className="demo-pop" style={{ animationDelay:`${delay}ms`, width:DEMO_CARD_W, height:DEMO_CARD_H, borderRadius:10, overflow:'hidden',
      border:'1px solid #2C2C2A', background:'#181817' }}>
      <div className="shimmer" style={{ height:'100%', opacity:.7 }}/>
    </div>
  )
}
