import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasNode } from '../types'
import { GUIDE_EVENT_NAME, type MuseFlowGuideEvent } from '../guideEvents'
import { GUIDE_FRAME_ID, GUIDE_HUM_ID, GUIDE_IMAGE_ID, GUIDE_REF_ID } from '../guidedExample'
import type { Lang } from '../i18n'

const STORAGE_KEY='museflow-midnight-guide-v1'

type Phase='intro'|'active'|'free'|'done'
type SavedProgress={phase:Phase;step:number}

const steps=[
  {
    title:'先听见原始想法',
    body:'点击播放这段未经处理的哼唱。它会成为作品的旋律线索。',
    why:'MuseFlow 不要求先准备完整歌曲，一段旋律片段也能成为创作起点。',
    nodeId:GUIDE_HUM_ID,target:`[data-guide-target="audio-play-${GUIDE_HUM_ID}"]`,hint:'点击播放按钮',
  },
  {
    title:'让不同素材建立关系',
    body:'把左侧的“雨夜霓虹街道”图片拖进融合板的素材区域。',
    why:'卡片进入融合板后，才会从摆放关系变成参与生成的创作关系。',
    nodeId:GUIDE_IMAGE_ID,target:`[data-node-id="${GUIDE_IMAGE_ID}"]`,hint:'按住卡片并拖入融合板',
  },
  {
    title:'决定素材的影响力',
    body:'在控制台中把图片素材的权重调整到 60% 左右。',
    why:'权重表达生成时的相对影响程度，不是音轨音量，也不要求所有数值相加等于 100%。',
    nodeId:GUIDE_FRAME_ID,target:`[data-guide-target="weight-${GUIDE_IMAGE_ID}"]`,hint:'可接受 55%–65%',
  },
  {
    title:'先探索，再决定',
    body:'生成 3 个 30 秒 Demo，并播放其中任意两版比较氛围差异。',
    why:'Demo 是用于快速比较方向的草稿，不是被截短的最终作品。',
    nodeId:GUIDE_FRAME_ID,target:`[data-guide-target="frame-generate-${GUIDE_FRAME_ID}"]`,hint:'生成后试听两张 Demo',
  },
  {
    title:'保留喜欢的方向',
    body:'把任意一张 Demo 从抽屉拖到右侧 Canvas。',
    why:'生成结果可以继续成为素材，进入下一轮组合与重构。',
    nodeId:GUIDE_FRAME_ID,target:'[data-guide-target^="drawer-demo-"]',hint:'按住卡片，拖出抽屉后松开',
  },
  {
    title:'建立音频创作夹',
    body:'把刚拖出的 Demo 叠到右侧参考音频上；选择 Remix，移动一次取向象限并输入一句 Prompt。',
    why:'模式决定生成方法，象限控制整体取向，Prompt 补充无法结构化表达的意图。',
    nodeId:GUIDE_REF_ID,target:`[data-node-id="${GUIDE_REF_ID}"]`,hint:'Demo + 参考音频 → Remix',
  },
  {
    title:'生成完整作品',
    body:'点击“生成完整作品”，系统会给出两个可继续使用的 Remix 结果。',
    why:'两个结果共享来源关系，但会在比例、长度和后台 Prompt 上产生可比较的变化。',
    nodeId:'guide-audio-folder',target:'[data-guide-target^="folder-generate-"]',hint:'生成两个结果',
  },
] as const

function readProgress():SavedProgress {
  try {
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as SavedProgress
    if(parsed && ['intro','active','free','done'].includes(parsed.phase) && Number.isInteger(parsed.step)) return {...parsed,step:Math.max(0,Math.min(steps.length-1,parsed.step))}
  } catch { /* use fresh progress */ }
  return {phase:'intro',step:0}
}

export default function GuidedTour({lang,nodes,onFocusNode,onPrepareStep,onReset,onCopy}:{
  lang:Lang
  nodes:CanvasNode[]
  onFocusNode:(id:string,selector?:string)=>void
  onPrepareStep:(step:number)=>void
  onReset:()=>void
  onCopy:()=>void
}) {
  const [progress,setProgress]=useState<SavedProgress>(readProgress)
  const [showWhy,setShowWhy]=useState(false)
  const [targetRect,setTargetRect]=useState<DOMRect|null>(null)
  const [canvasRect,setCanvasRect]=useState<DOMRect|null>(null)
  const [dragHintCollapsed,setDragHintCollapsed]=useState(false)
  const playedDemos=useRef(new Set<string>())
  const orientationTouched=useRef(false)
  const advancing=useRef(false)
  const dragStart=useRef<{x:number;y:number}|null>(null)
  const restoreHintTimer=useRef<number|null>(null)
  const zh=lang==='zh'

  const save=useCallback((next:SavedProgress)=>{
    setProgress(next)
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next))
  },[])

  const resetAll=useCallback(()=>{
    onReset()
    save({phase:'intro',step:0})
    playedDemos.current.clear()
    orientationTouched.current=false
    dragStart.current=null
    setDragHintCollapsed(false)
    setShowWhy(false)
  },[onReset,save])

  const advance=useCallback(()=>{
    if(advancing.current)return
    advancing.current=true
    window.setTimeout(()=>{
      setProgress(current=>{
        const next=current.step>=steps.length-1?{phase:'done' as const,step:steps.length-1}:{phase:'active' as const,step:current.step+1}
        localStorage.setItem(STORAGE_KEY,JSON.stringify(next))
        return next
      })
      setShowWhy(false)
      advancing.current=false
    },420)
  },[])

  useEffect(()=>{
    const listener=(event:Event)=>{
      if(progress.phase!=='active')return
      const detail=(event as CustomEvent<MuseFlowGuideEvent>).detail
      if(progress.step===0 && detail.type==='audio-play' && detail.nodeId===GUIDE_HUM_ID) advance()
      if(progress.step===3 && detail.type==='demo-play') {
        playedDemos.current.add(detail.cardId)
        const frame=nodes.find(node=>node.id===GUIDE_FRAME_ID)
        const demos=(frame?.data.demos as unknown[]|undefined)??[]
        if(demos.length>=3 && playedDemos.current.size>=2) advance()
      }
    }
    window.addEventListener(GUIDE_EVENT_NAME,listener)
    return()=>window.removeEventListener(GUIDE_EVENT_NAME,listener)
  },[advance,nodes,progress.phase,progress.step])

  useEffect(()=>{
    if(progress.phase!=='active')return
    const image=nodes.find(node=>node.id===GUIDE_IMAGE_ID)
    const frame=nodes.find(node=>node.id===GUIDE_FRAME_ID)
    const folder=nodes.find(node=>node.type==='audioFolder')
    if(progress.step===0 && nodes.find(node=>node.id===GUIDE_HUM_ID)?.data.guidePlayedAt) advance()
    if(progress.step===1 && image && frame && image.x+image.w/2>frame.x && image.x+image.w/2<frame.x+520 && image.y+image.h/2>frame.y+50 && image.y+image.h/2<frame.y+frame.h) advance()
    if(progress.step===2 && image && Number(image.data.weight)>=55 && Number(image.data.weight)<=65) advance()
    if(progress.step===4 && nodes.some(node=>node.type==='direction' && node.data.demo)) advance()
    if(progress.step===5 && folder) {
      if(Number(folder.data.weirdness)!==50) orientationTouched.current=true
      const sources=(folder.data.sources as unknown[]|undefined)??[]
      if(sources.length>=2 && folder.data.mode==='remix' && orientationTouched.current && String(folder.data.prompt??'').trim()) advance()
    }
    if(progress.step===6 && folder && ((folder.data.works as unknown[]|undefined)?.length??0)>=2) advance()
  },[advance,nodes,progress.phase,progress.step])

  const step=steps[progress.step]
  const frame=nodes.find(node=>node.id===GUIDE_FRAME_ID)
  const folder=nodes.find(node=>node.type==='audioFolder')
  const canvasDemo=nodes.find(node=>node.type==='direction' && node.data.demo)
  const hasDemos=((frame?.data.demos as unknown[]|undefined)?.length??0)>0
  const focusTarget=useMemo(()=>{
    if(progress.step===0) return {id:GUIDE_HUM_ID,selector:`[data-node-id="${GUIDE_HUM_ID}"]`}
    if(progress.step===1) return {id:GUIDE_IMAGE_ID,selector:`[data-node-id="${GUIDE_IMAGE_ID}"]`}
    if(progress.step===2) return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
    if(progress.step===3 && hasDemos) return {id:GUIDE_FRAME_ID,selector:'[data-guide-target^="drawer-demo-"]'}
    if(progress.step===3) return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
    if(progress.step===4 && hasDemos) return {id:GUIDE_FRAME_ID,selector:'[data-guide-target^="drawer-demo-"]'}
    if(progress.step===4) return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
    if(progress.step===5 && folder) return {id:folder.id,selector:`[data-node-id="${folder.id}"]`}
    if(progress.step===5 && canvasDemo) return {id:canvasDemo.id,selector:`[data-node-id="${canvasDemo.id}"]`}
    if(progress.step===5) return {id:GUIDE_REF_ID,selector:`[data-node-id="${GUIDE_REF_ID}"]`}
    if(progress.step===6 && folder) return {id:folder.id,selector:`[data-node-id="${folder.id}"]`}
    return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
  },[canvasDemo?.id,folder?.id,hasDemos,progress.step])

  useEffect(()=>{
    if(progress.phase!=='active' || !step)return
    const timer=window.setTimeout(()=>onFocusNode(focusTarget.id,focusTarget.selector),80)
    return()=>window.clearTimeout(timer)
  },[focusTarget.id,focusTarget.selector,onFocusNode,progress.phase,step])

  useEffect(()=>{
    const update=()=>setCanvasRect(document.querySelector('.museflow-canvas')?.getBoundingClientRect() ?? null)
    update()
    const canvas=document.querySelector('.museflow-canvas')
    const observer=canvas ? new ResizeObserver(update) : null
    if(canvas)observer?.observe(canvas)
    window.addEventListener('resize',update)
    return()=>{observer?.disconnect();window.removeEventListener('resize',update)}
  },[])

  const activeTargetSelector=progress.step===3 && hasDemos
    ? '[data-guide-target^="demo-play-"]'
    : progress.step>=6 && folder
      ? `[data-guide-target^="folder-generate-${folder.id}"]`
      : progress.step===5 && folder
        ? `[data-node-id="${folder.id}"]`
        : step.target

  useEffect(()=>{
    if(progress.phase!=='active')return
    let stopped=false
    const update=()=>{
      if(stopped)return
      setTargetRect(document.querySelector(activeTargetSelector)?.getBoundingClientRect() ?? null)
    }
    const timers=[40,180,420,760].map(delay=>window.setTimeout(update,delay))
    window.addEventListener('resize',update)
    return()=>{stopped=true;timers.forEach(window.clearTimeout);window.removeEventListener('resize',update)}
  },[activeTargetSelector,nodes,progress.phase,progress.step])

  useEffect(()=>{
    if(progress.phase!=='active' || progress.step!==1) {
      dragStart.current=null
      setDragHintCollapsed(false)
      return
    }
    const onPointerDown=(event:PointerEvent)=>{
      const target=event.target as HTMLElement|null
      if(!target?.closest(`[data-node-id="${GUIDE_IMAGE_ID}"]`))return
      dragStart.current={x:event.clientX,y:event.clientY}
      if(restoreHintTimer.current!==null)window.clearTimeout(restoreHintTimer.current)
    }
    const onPointerMove=(event:PointerEvent)=>{
      const start=dragStart.current
      if(!start || Math.hypot(event.clientX-start.x,event.clientY-start.y)<6)return
      setDragHintCollapsed(true)
    }
    const onPointerEnd=()=>{
      if(!dragStart.current)return
      dragStart.current=null
      restoreHintTimer.current=window.setTimeout(()=>setDragHintCollapsed(false),520)
    }
    document.addEventListener('pointerdown',onPointerDown,true)
    window.addEventListener('pointermove',onPointerMove,true)
    window.addEventListener('pointerup',onPointerEnd,true)
    window.addEventListener('pointercancel',onPointerEnd,true)
    return()=>{
      document.removeEventListener('pointerdown',onPointerDown,true)
      window.removeEventListener('pointermove',onPointerMove,true)
      window.removeEventListener('pointerup',onPointerEnd,true)
      window.removeEventListener('pointercancel',onPointerEnd,true)
      if(restoreHintTimer.current!==null)window.clearTimeout(restoreHintTimer.current)
    }
  },[progress.phase,progress.step])

  const bubbleStyle=useMemo(()=>{
    if(!targetRect)return {left:'50%',top:84,transform:'translateX(-50%)'}
    const width=286
    const preferRight=targetRect.right+width+22<window.innerWidth
    const left=preferRight?targetRect.right+16:Math.max(18,Math.min(window.innerWidth-width-18,targetRect.left))
    const top=Math.max(72,Math.min(window.innerHeight-260,targetRect.bottom+14))
    return {left,top}
  },[targetRect])

  const resetButton=<GuideResetButton zh={zh} onClick={resetAll} canvasRect={canvasRect}/>

  if(progress.phase==='free') return <>{resetButton}<GuideDock label={zh?'继续引导':'Resume guide'} onClick={()=>save({phase:'active',step:progress.step})}/></>

  if(progress.phase==='intro') return <>{resetButton}<div className="guide-intro">
    <div className="guide-intro__card">
      <span className="guide-kicker">INTERACTIVE EXAMPLE</span>
      <h2>{zh?'午夜城市重构':'Midnight City Rework'}</h2>
      <p>{zh?'用一张夜景照片、一段哼唱和一首参考音乐，完成一版新的城市流行作品。':'Turn a night photo, a hum and a reference track into a new city-pop work.'}</p>
      <div className="guide-intro__meta"><span>◷ {zh?'约 5 分钟':'About 5 min'}</span><span>7 {zh?'个真实操作':'real actions'}</span><span>{zh?'可随时退出':'Exit anytime'}</span></div>
      <div className="guide-intro__actions"><button onClick={()=>save({phase:'free',step:0})}>{zh?'自由浏览':'Explore freely'}</button><button className="is-primary" onClick={()=>save({phase:'active',step:0})}>{zh?'开始探索':'Start exploring'} →</button></div>
    </div>
  </div></>

  if(progress.phase==='done') return <>{resetButton}<div className="guide-complete">
    <span>✓</span><div><b>{zh?'你已经完成一次完整创作':'You completed a full creative flow'}</b><p>{zh?'多模态素材 → 融合权重 → Demo 探索 → Remix → 完整作品':'Multimodal sources → Weights → Demos → Remix → Full work'}</p></div>
    <button onClick={onCopy}>{zh?'复制为我的画板':'Copy to my boards'}</button>
    <button onClick={()=>save({phase:'free',step:steps.length-1})}>{zh?'继续探索':'Keep exploring'}</button>
    <button onClick={resetAll}>{zh?'重新开始':'Restart'}</button>
  </div></>

  return <>
    {resetButton}
    {targetRect && <div className="guide-target-ring" style={{left:targetRect.left-6,top:targetRect.top-6,width:targetRect.width+12,height:targetRect.height+12}}/>}
    {!dragHintCollapsed && <aside className="guide-bubble" style={bubbleStyle}>
      <div className="guide-bubble__top"><span>{progress.step+1} / {steps.length}</span><button onClick={()=>save({phase:'free',step:progress.step})}>×</button></div>
      <h3>{step.title}</h3><p>{step.body}</p><em>{step.hint}</em>
      {showWhy && <div className="guide-bubble__why">{step.why}</div>}
      <div className="guide-bubble__actions"><button onClick={()=>setShowWhy(value=>!value)}>{showWhy?'收起':'为什么？'}</button><button onClick={()=>{onPrepareStep(progress.step);advance()}}>跳过</button></div>
      <i style={{width:`${((progress.step+1)/steps.length)*100}%`}}/>
    </aside>}
  </>
}

function GuideResetButton({zh,onClick,canvasRect}:{zh:boolean;onClick:()=>void;canvasRect:DOMRect|null}) {
  const style=canvasRect?{left:canvasRect.right-14,top:canvasRect.top+14,transform:'translateX(-100%)'}:undefined
  return <button className="guide-reset" style={style} onClick={onClick} title={zh?'恢复实例并从第一步重新开始':'Reset the example and restart'}><span>↻</span>{zh?'恢复实例':'Reset example'}</button>
}

function GuideDock({label,onClick}:{label:string;onClick:()=>void}) {
  return <button className="guide-dock" onClick={onClick}><span>✦</span>{label}<b>→</b></button>
}
