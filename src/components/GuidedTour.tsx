import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasNode, Wire } from '../types'
import { GUIDE_EVENT_NAME, type MuseFlowGuideEvent } from '../guideEvents'
import { GUIDE_FRAME_ID, GUIDE_HUM_ID, GUIDE_IMAGE_ID, GUIDE_INTENT_ID, GUIDE_LYRICS_ID, GUIDE_REF_ID } from '../guidedExample'
import type { Lang } from '../i18n'

const STORAGE_KEY='museflow-midnight-guide-v2'

type Phase='intro'|'active'|'free'|'done'
type SavedProgress={phase:Phase;step:number}

const steps=[
  {
    title:'先认识工作空间',body:'点击右侧机架里的“小样”，它可以快速选中画板中的对应磁贴。',why:'Canvas 负责组织关系；右侧机架负责定位磁贴，并在选择 Demo 或作品后展示完整详情。',hint:'点击右侧的小样',
    titleEn:'Meet the workspace',bodyEn:'Click the Hum Clip in the right rack to quickly select its matching tile on the board.',whyEn:'The canvas organizes relationships; the right rack locates tiles and shows full details for a selected demo or track.',hintEn:'Click the Hum Clip on the right',nodeId:GUIDE_HUM_ID,target:`[data-guide-target="rack-node-${GUIDE_HUM_ID}"]`,
  },
  {
    title:'先听见原始想法',body:'点击播放这段未经处理的哼唱。它会成为作品的旋律线索。',why:'MuseFlow 不要求先准备完整歌曲，一段旋律片段也能成为创作起点。',hint:'点击播放按钮',
    titleEn:'Hear the original idea',bodyEn:'Play this untreated hum. It will become a melodic clue for the track.',whyEn:'MuseFlow does not require a finished song—a short melodic fragment can be a creative starting point.',hintEn:'Click the play button',nodeId:GUIDE_HUM_ID,target:`[data-guide-target="audio-play-${GUIDE_HUM_ID}"]`,
  },
  {
    title:'添加文字并建立关系',body:'点击左侧“文字”生成一张文字意向卡片，再把它拖进融合板的素材区域。',why:'新卡片先出现在融合板外；只有主动拖入后，它才会成为这一轮生成关系的一部分。',hint:'添加文字，再把文字卡片拖入融合板',
    titleEn:'Add text and build a relationship',bodyEn:'Click Text on the left to create a text-intent card, then drag it into the material area of the Fusion Board.',whyEn:'New cards first appear outside the board. They affect this generation only after you deliberately drag them in.',hintEn:'Add text, then drag the card into the Fusion Board',nodeId:GUIDE_INTENT_ID,target:'[data-guide-target="capture-text"]',
  },
  {
    title:'把视觉也变成音乐线索',body:'把画板上的“图片素材”卡片拖进融合板的素材区域。',why:'图片不会被直接转换成声音；它提供色彩、环境和氛围线索，与文字和音频共同影响生成方向。',hint:'按住图片卡片并拖入融合板',
    titleEn:'Turn visuals into musical clues',bodyEn:'Drag the Image Material card into the Fusion Board’s material area.',whyEn:'The image is not converted directly into sound. It contributes color, environment, and atmosphere alongside text and audio.',hintEn:'Drag the image card into the Fusion Board',nodeId:GUIDE_IMAGE_ID,target:`[data-node-id="${GUIDE_IMAGE_ID}"]`,
  },
  {
    title:'决定素材的影响力',body:'在控制台中把文字意向的权重调整到 60% 左右。歌曲形态、人声、拍号和禁忌元素也都在这里。',why:'权重表达生成时的相对影响程度，不是音轨音量，也不要求所有数值相加等于 100%。',hint:'可接受 55%–65%',
    titleEn:'Set each material’s influence',bodyEn:'In the console, set the Text Intent weight to about 60%. Format, vocals, time signature, and excluded elements are here too.',whyEn:'Weights express relative influence during generation—not track volume—and they do not need to total 100%.',hintEn:'Any value from 55%–65% works',nodeId:GUIDE_FRAME_ID,target:`[data-guide-target="weight-${GUIDE_INTENT_ID}"]`,
  },
  {
    title:'先探索，再决定',body:'生成 3 个 30 秒 Demo，并播放其中任意两版比较氛围差异。',why:'Demo 是用于快速比较方向的草稿，不是被截短的最终作品。',hint:'生成后试听两张 Demo',
    titleEn:'Explore before deciding',bodyEn:'Generate three 30-second demos and play any two to compare their atmosphere.',whyEn:'Demos are drafts for quickly comparing directions, not shortened final tracks.',hintEn:'Generate, then audition two demos',nodeId:GUIDE_FRAME_ID,target:`[data-guide-target="frame-generate-${GUIDE_FRAME_ID}"]`,
  },
  {
    title:'保留喜欢的方向',body:'把任意一张 Demo 从抽屉拖到右侧 Canvas。',why:'生成结果可以继续成为素材，进入下一轮组合与重构。',hint:'按住卡片，拖出抽屉后松开',
    titleEn:'Keep a direction you like',bodyEn:'Drag any demo out of the drawer onto the canvas on the right.',whyEn:'Generated results can become new material for another round of combination and reconstruction.',hintEn:'Hold the card, drag it out, then release',nodeId:GUIDE_FRAME_ID,target:'[data-guide-target^="drawer-demo-"]',
  },
  {
    title:'查看更完整的信息',body:'点击刚拖出的 Demo，右侧详情区会显示创作方向、素材配方、歌词和后台 Prompt。',why:'卡片用于快速浏览；右侧详情区用于理解一个结果为什么会这样生成。',hint:'点击 Canvas 上的 Demo 卡片',
    titleEn:'Inspect the full details',bodyEn:'Click the demo you just extracted. The right panel shows its creative direction, source recipe, lyrics, and generation prompt.',whyEn:'Cards support quick scanning; the detail panel explains why a result was generated this way.',hintEn:'Click the demo card on the canvas',nodeId:GUIDE_FRAME_ID,target:'[data-node-id]',
  },
  {
    title:'建立音频创作夹',body:'把 Demo 拖到它右侧的绿色参考音频上；选择 Remix、移动取向象限，并输入这一轮的 Prompt。',why:'模式决定生成方法，象限控制整体取向，Prompt 补充无法结构化表达的意图。',hint:'Demo + 右侧绿色参考音频 → Remix',
    titleEn:'Create an Audio Studio',bodyEn:'Drag the demo onto the green Reference Audio to its right. Choose Remix, adjust the orientation quadrant, and enter a prompt.',whyEn:'The mode sets the generation method, the quadrant controls overall direction, and the prompt adds intentions that resist structured controls.',hintEn:'Demo + green Reference Audio → Remix',nodeId:GUIDE_REF_ID,target:`[data-node-id="${GUIDE_REF_ID}"]`,
  },
  {
    title:'为 Remix 创建歌词',body:'点击左侧“歌词”，创建一张包含主歌与副歌的示例歌词卡片。创建后可点击卡片右上角的列表按钮，检视全部歌词。',why:'歌词不是 Prompt，而是一种可以独立编辑、重排和复用的创作素材。右上角的列表按钮会展开完整歌词浏览，不影响当前编辑位置。',hint:'点击歌词入口；右上角按钮可浏览全部歌词',
    titleEn:'Create lyrics for the Remix',bodyEn:'Click Lyrics on the left to create an example card with verses and choruses. Use the list button at the top right to inspect all lyrics.',whyEn:'Lyrics are not a prompt; they are independently editable, reorderable, and reusable creative material. The list button opens the full lyric browser without changing your edit position.',hintEn:'Click Lyrics; use the top-right button to browse all lyrics',nodeId:GUIDE_LYRICS_ID,target:'[data-guide-target="create-lyrics"]',
  },
  {
    title:'让歌词参与 Remix',body:'歌词左侧的段落可以上下重排。现在从歌词卡片边缘拖出连线，连接到音频创作夹。',why:'歌词已经作为独立素材准备好；连到创作夹后，它只参与这一次 Remix，不会影响前面的 Demo 探索。',hint:'把歌词连到音频创作夹',
    titleEn:'Bring lyrics into the Remix',bodyEn:'Lyric sections can be reordered in the left column. Now drag a wire from the edge of the lyric card to the Audio Studio.',whyEn:'The lyrics are ready as independent material. Connecting them affects only this Remix and does not change the earlier demo exploration.',hintEn:'Connect the lyrics to the Audio Studio',nodeId:GUIDE_LYRICS_ID,target:`[data-node-id="${GUIDE_LYRICS_ID}"]`,
  },
  {
    title:'生成完整作品',body:'点击“生成完整作品”，系统会给出两个可继续使用的 Remix 结果。',why:'两个结果共享来源关系，但会在比例、长度和后台 Prompt 上产生可比较的变化。',hint:'生成两个结果',
    titleEn:'Generate complete tracks',bodyEn:'Click Generate Full Tracks to create two reusable Remix results.',whyEn:'The results share the same source relationships but vary in ratio, length, and generation prompt for comparison.',hintEn:'Generate two results',nodeId:'guide-audio-folder',target:'[data-guide-target^="folder-generate-"]',
  },
  {
    title:'导出这一版 Remix',body:'把任意一张 Remix 卡片从抽屉拖到 Canvas，右键点击卡片并选择“下载音频”。',why:'抽屉保存本轮生成结果；拖到 Canvas 后，它会成为可以继续编排、连接或导出的正式作品卡片。',hint:'拖出 Remix → 右键 → 下载音频',
    titleEn:'Export this Remix',bodyEn:'Drag any Remix card from the drawer onto the canvas, right-click it, and choose Download Audio.',whyEn:'The drawer holds this round’s results. Once extracted, a result becomes a track card you can arrange, connect, or export.',hintEn:'Drag out a Remix → right-click → Download Audio',nodeId:'guide-audio-folder',target:'[data-guide-target^="drawer-work-"]',
  },
] as const

function readProgress():SavedProgress {
  try {
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as SavedProgress
    if(parsed && ['intro','active','free','done'].includes(parsed.phase) && Number.isInteger(parsed.step)) return {...parsed,step:Math.max(0,Math.min(steps.length-1,parsed.step))}
  } catch { /* use fresh progress */ }
  return {phase:'intro',step:0}
}

export default function GuidedTour({lang,nodes,wires,onFocusNode,onPrepareStep,onReset,onCopy}:{
  lang:Lang
  nodes:CanvasNode[]
  wires:Wire[]
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
  const [blockedAttempt,setBlockedAttempt]=useState(false)
  const lastTargetRect=useRef<{x:number;y:number;width:number;height:number}|null>(null)
  const playedDemos=useRef(new Set<string>())
  const orientationTouched=useRef(false)
  const advancing=useRef(false)
  const dragStart=useRef<{x:number;y:number}|null>(null)
  const restoreHintTimer=useRef<number|null>(null)
  const blockedHintTimer=useRef<number|null>(null)
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
      if(progress.step===0 && detail.type==='rack-select' && detail.nodeId===GUIDE_HUM_ID) advance()
      if(progress.step===1 && detail.type==='audio-play' && detail.nodeId===GUIDE_HUM_ID) advance()
      if(progress.step===5 && detail.type==='demo-play') {
        playedDemos.current.add(detail.cardId)
        const frame=nodes.find(node=>node.id===GUIDE_FRAME_ID)
        const demos=(frame?.data.demos as unknown[]|undefined)??[]
        if(demos.length>=3 && playedDemos.current.size>=2) advance()
      }
      if(progress.step===7 && detail.type==='detail-open' && nodes.some(node=>node.id===detail.nodeId && node.type==='direction' && node.data.demo))advance()
      if(progress.step===12 && detail.type==='audio-download' && nodes.some(node=>node.id===detail.nodeId && node.type==='work'))advance()
    }
    window.addEventListener(GUIDE_EVENT_NAME,listener)
    return()=>window.removeEventListener(GUIDE_EVENT_NAME,listener)
  },[advance,nodes,progress.phase,progress.step])

  useEffect(()=>{
    if(progress.phase!=='active')return
    const intent=nodes.find(node=>node.id===GUIDE_INTENT_ID)
    const frame=nodes.find(node=>node.id===GUIDE_FRAME_ID)
    const folder=nodes.find(node=>node.type==='audioFolder')
    const lyrics=nodes.find(node=>node.id===GUIDE_LYRICS_ID)
    const connected=(a:string,b:string)=>wires.some(wire=>(wire.fromNodeId===a&&wire.toNodeId===b)||(wire.fromNodeId===b&&wire.toNodeId===a))
    if(progress.step===1 && nodes.find(node=>node.id===GUIDE_HUM_ID)?.data.guidePlayedAt) advance()
    if(progress.step===2 && intent && frame && intent.x+intent.w/2>frame.x && intent.x+intent.w/2<frame.x+520 && intent.y+intent.h/2>frame.y+50 && intent.y+intent.h/2<frame.y+frame.h) advance()
    const image=nodes.find(node=>node.id===GUIDE_IMAGE_ID)
    if(progress.step===3 && image && frame && image.x+image.w/2>frame.x && image.x+image.w/2<frame.x+520 && image.y+image.h/2>frame.y+50 && image.y+image.h/2<frame.y+frame.h) advance()
    if(progress.step===4 && intent && Number(intent.data.weight)>=55 && Number(intent.data.weight)<=65) advance()
    if(progress.step===6 && nodes.some(node=>node.type==='direction' && node.data.demo)) advance()
    if(progress.step===8 && folder) {
      if(Number(folder.data.weirdness)!==50) orientationTouched.current=true
      const sources=(folder.data.sources as unknown[]|undefined)??[]
      if(sources.length>=2 && folder.data.mode==='remix' && orientationTouched.current && String(folder.data.prompt??'').trim()) advance()
    }
    if(progress.step===9 && lyrics)advance()
    if(progress.step===10 && lyrics && folder && connected(lyrics.id,folder.id))advance()
    if(progress.step===11 && folder && ((folder.data.works as unknown[]|undefined)?.length??0)>=2) advance()
  },[advance,nodes,progress.phase,progress.step,wires])

  const rawStep=steps[progress.step]
  const step=zh ? rawStep : {...rawStep,title:rawStep.titleEn,body:rawStep.bodyEn,why:rawStep.whyEn,hint:rawStep.hintEn}
  const frame=nodes.find(node=>node.id===GUIDE_FRAME_ID)
  const folder=nodes.find(node=>node.type==='audioFolder')
  const canvasDemo=nodes.find(node=>node.type==='direction' && node.data.demo)
  const canvasWork=nodes.find(node=>node.type==='work')
  const intent=nodes.find(node=>node.id===GUIDE_INTENT_ID)
  const lyrics=nodes.find(node=>node.id===GUIDE_LYRICS_ID)
  const hasDemos=((frame?.data.demos as unknown[]|undefined)?.length??0)>0
  const focusTarget=useMemo(()=>{
    if(progress.step===0) return {id:GUIDE_HUM_ID,selector:`[data-guide-target="rack-node-${GUIDE_HUM_ID}"]`,camera:false}
    if(progress.step===1) return {id:GUIDE_HUM_ID,selector:`[data-node-id="${GUIDE_HUM_ID}"]`}
    if(progress.step===2 && intent) return {id:GUIDE_INTENT_ID,selector:`[data-node-id="${GUIDE_INTENT_ID}"]`}
    if(progress.step===2) return {id:GUIDE_INTENT_ID,selector:'[data-guide-target="capture-text"]',camera:false}
    if(progress.step===3) return {id:GUIDE_IMAGE_ID,selector:`[data-node-id="${GUIDE_IMAGE_ID}"]`}
    if(progress.step===4) return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
    if(progress.step===5 && hasDemos) return {id:GUIDE_FRAME_ID,selector:'[data-guide-target^="drawer-demo-"]'}
    if(progress.step===5) return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
    if(progress.step===6 && hasDemos) return {id:GUIDE_FRAME_ID,selector:'[data-guide-target^="drawer-demo-"]'}
    if(progress.step===6) return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
    if(progress.step===7 && canvasDemo)return {id:canvasDemo.id,selector:`[data-node-id="${canvasDemo.id}"]`}
    if(progress.step===8 && folder) return {id:folder.id,selector:`[data-node-id="${folder.id}"]`}
    if(progress.step===8 && canvasDemo) return {id:canvasDemo.id,selector:`[data-node-id="${canvasDemo.id}"]`}
    if(progress.step===8) return {id:GUIDE_REF_ID,selector:`[data-node-id="${GUIDE_REF_ID}"]`}
    if(progress.step===9 && lyrics)return {id:lyrics.id,selector:`[data-node-id="${lyrics.id}"]`}
    if(progress.step===9)return {id:GUIDE_REF_ID,selector:'[data-guide-target="create-lyrics"]',camera:false}
    if(progress.step===10 && lyrics&&folder) return {id:folder.id,selector:`[data-node-id="${folder.id}"]`}
    if(progress.step===10 && lyrics) return {id:lyrics.id,selector:`[data-node-id="${lyrics.id}"]`}
    if(progress.step===11 && folder) return {id:folder.id,selector:`[data-node-id="${folder.id}"]`}
    if(progress.step===12 && canvasWork)return {id:canvasWork.id,selector:`[data-node-id="${canvasWork.id}"]`}
    if(progress.step===12 && folder)return {id:folder.id,selector:'[data-guide-target^="drawer-work-"]'}
    return {id:GUIDE_FRAME_ID,selector:`[data-node-id="${GUIDE_FRAME_ID}"]`}
  },[canvasDemo?.id,canvasWork?.id,folder?.id,hasDemos,intent?.id,lyrics?.id,progress.step])

  useEffect(()=>{
    if(progress.phase!=='active' || !step)return
    if(focusTarget.camera===false)return
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

  const activeTargetSelector=(()=>{
    if(progress.step===0)return `[data-guide-target="rack-node-${GUIDE_HUM_ID}"]`
    if(progress.step===1)return `[data-guide-target="audio-play-${GUIDE_HUM_ID}"]`
    if(progress.step===2)return intent?`[data-node-id="${GUIDE_INTENT_ID}"]`:'[data-guide-target="capture-text"]'
    if(progress.step===3)return `[data-node-id="${GUIDE_IMAGE_ID}"]`
    if(progress.step===4)return `[data-guide-target="weight-${GUIDE_INTENT_ID}"]`
    if(progress.step===5)return hasDemos?'[data-guide-target^="demo-play-"]':`[data-guide-target="frame-generate-${GUIDE_FRAME_ID}"]`
    if(progress.step===6)return hasDemos?'[data-guide-target^="drawer-demo-"]':`[data-node-id="${GUIDE_FRAME_ID}"]`
    if(progress.step===7 && canvasDemo)return `[data-node-id="${canvasDemo.id}"]`
    if(progress.step===8 && folder)return `[data-node-id="${folder.id}"]`
    if(progress.step===8 && canvasDemo)return `[data-node-id="${canvasDemo.id}"]`
    if(progress.step===9)return lyrics?`[data-node-id="${lyrics.id}"]`:'[data-guide-target="create-lyrics"]'
    if(progress.step===10 && lyrics&&folder)return `[data-node-id="${lyrics.id}"],[data-node-id="${folder.id}"],[data-wire-edge-for="${lyrics.id}"],[data-wire-edge-for="${folder.id}"]`
    if(progress.step===10 && lyrics)return `[data-node-id="${lyrics.id}"]`
    if(progress.step===11 && folder)return `[data-guide-target^="folder-generate-${folder.id}"]`
    if(progress.step===12 && canvasWork)return `[data-node-id="${canvasWork.id}"]`
    if(progress.step===12 && folder)return '[data-guide-target^="drawer-work-"]'
    return step.target
  })()

  useEffect(()=>{
    if(progress.phase!=='active')return
    const showBlockedHint=()=>{
      setBlockedAttempt(true)
      if(blockedHintTimer.current!==null)window.clearTimeout(blockedHintTimer.current)
      blockedHintTimer.current=window.setTimeout(()=>setBlockedAttempt(false),1300)
    }
    const allowed=(target:EventTarget|null)=>{
      const element=target instanceof Element?target:null
      if(!element)return false
      if(element.closest('.guide-bubble,.guide-reset,.guide-lock-toast'))return true
      if(element.closest('[data-guide-audio-control]'))return true
      if(progress.step===12&&element.closest('[data-card-context-menu]'))return true
      try{return !!element.closest(activeTargetSelector)}catch{return false}
    }
    const blockPointer=(event:Event)=>{
      if(allowed(event.target))return
      event.preventDefault()
      event.stopPropagation()
      ;(event as Event & {stopImmediatePropagation?:()=>void}).stopImmediatePropagation?.()
      showBlockedHint()
    }
    const blockKey=(event:KeyboardEvent)=>{
      if(allowed(event.target))return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      showBlockedHint()
    }
    document.addEventListener('pointerdown',blockPointer,true)
    document.addEventListener('click',blockPointer,true)
    document.addEventListener('contextmenu',blockPointer,true)
    document.addEventListener('keydown',blockKey,true)
    return()=>{
      document.removeEventListener('pointerdown',blockPointer,true)
      document.removeEventListener('click',blockPointer,true)
      document.removeEventListener('contextmenu',blockPointer,true)
      document.removeEventListener('keydown',blockKey,true)
      if(blockedHintTimer.current!==null)window.clearTimeout(blockedHintTimer.current)
      blockedHintTimer.current=null
      setBlockedAttempt(false)
    }
  },[activeTargetSelector,progress.phase,progress.step])

  useEffect(()=>{
    if(progress.phase!=='active')return
    let stopped=false
    let frameId=0
    let trackingUntil=performance.now()+900
    const update=()=>{
      if(stopped)return
      const rect=document.querySelector(activeTargetSelector)?.getBoundingClientRect() ?? null
      const previous=lastTargetRect.current
      if(!rect) {
        if(previous)setTargetRect(null)
        lastTargetRect.current=null
      } else if(!previous || Math.abs(previous.x-rect.x)>.2 || Math.abs(previous.y-rect.y)>.2 || Math.abs(previous.width-rect.width)>.2 || Math.abs(previous.height-rect.height)>.2) {
        lastTargetRect.current={x:rect.x,y:rect.y,width:rect.width,height:rect.height}
        setTargetRect(rect)
      }
      frameId=0
      if(performance.now()<trackingUntil)frameId=requestAnimationFrame(update)
    }
    const trackFor=(duration:number)=>{
      trackingUntil=Math.max(trackingUntil,performance.now()+duration)
      if(!frameId)frameId=requestAnimationFrame(update)
    }
    trackFor(900)
    const onResize=()=>{lastTargetRect.current=null;trackFor(320)}
    const onViewportGesture=()=>trackFor(260)
    const onPointerMove=(event:PointerEvent)=>{if(event.buttons)trackFor(180)}
    window.addEventListener('resize',onResize)
    window.addEventListener('wheel',onViewportGesture,{passive:true,capture:true})
    window.addEventListener('pointermove',onPointerMove,{passive:true,capture:true})
    return()=>{
      stopped=true
      if(frameId)cancelAnimationFrame(frameId)
      window.removeEventListener('resize',onResize)
      window.removeEventListener('wheel',onViewportGesture,true)
      window.removeEventListener('pointermove',onPointerMove,true)
    }
  },[activeTargetSelector,nodes,progress.phase,progress.step])

  const dragCollapseSelector=progress.step===2
    ? `[data-node-id="${GUIDE_INTENT_ID}"]`
    : progress.step===3
      ? `[data-node-id="${GUIDE_IMAGE_ID}"]`
    : progress.step===6 && hasDemos
      ? '[data-guide-target^="drawer-demo-"]'
      : progress.step===8 && canvasDemo && !folder
        ? `[data-node-id="${canvasDemo.id}"]`
        : progress.step===12 && folder && !canvasWork
          ? '[data-guide-target^="drawer-work-"]'
        : null

  useEffect(()=>{
    if(progress.phase!=='active' || !dragCollapseSelector) {
      dragStart.current=null
      setDragHintCollapsed(false)
      return
    }
    // A collapsed hint belongs only to the drag that created it. When the
    // tutorial advances from one drag step to the next, always reveal the new
    // instruction before the user begins dragging again.
    dragStart.current=null
    setDragHintCollapsed(false)
    if(restoreHintTimer.current!==null) {
      window.clearTimeout(restoreHintTimer.current)
      restoreHintTimer.current=null
    }
    const onPointerDown=(event:PointerEvent)=>{
      const target=event.target as HTMLElement|null
      if(!target?.closest(dragCollapseSelector))return
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
  },[dragCollapseSelector,progress.phase])

  const bubbleStyle=useMemo(()=>{
    if(progress.step===7) {
      const panel=document.querySelector('[data-guide-target="detail-panel"],[data-guide-target="rack-overview"]')?.getBoundingClientRect()
      if(panel) {
        const width=286
        return {left:Math.max(18,panel.left-width-16),top:Math.max(72,Math.min(window.innerHeight-260,panel.top+54))}
      }
    }
    if(!targetRect)return {left:'50%',top:84,transform:'translateX(-50%)'}
    const width=286
    const preferRight=targetRect.right+width+22<window.innerWidth
    const left=preferRight?targetRect.right+16:Math.max(18,Math.min(window.innerWidth-width-18,targetRect.left))
    const top=Math.max(72,Math.min(window.innerHeight-260,targetRect.bottom+14))
    return {left,top}
  },[progress.step,targetRect])

  const resetButton=<GuideResetButton zh={zh} onClick={resetAll} canvasRect={canvasRect}/>

  if(progress.phase==='free') return <>{resetButton}<GuideDock label={zh?'继续引导':'Resume guide'} onClick={()=>save({phase:'active',step:progress.step})}/></>

  if(progress.phase==='intro') return <>{resetButton}<div className="guide-intro">
    <div className="guide-intro__card">
      <span className="guide-kicker">INTERACTIVE EXAMPLE</span>
      <h2>{zh?'孤独霓虹':'Lonely Neon'}</h2>
      <p>{zh?'从一段文字意向、一段哼唱和一首参考音乐出发，完成一版新的城市流行作品。':'Turn a text intention, a hum and a reference track into a new city-pop work.'}</p>
      <div className="guide-intro__meta"><span>◷ {zh?'约 8 分钟':'About 8 min'}</span><span>13 {zh?'个真实操作':'real actions'}</span><span>{zh?'每步仅开放提示操作':'Only the prompted action is enabled'}</span></div>
      <div className="guide-intro__actions"><button onClick={()=>save({phase:'free',step:0})}>{zh?'自由浏览':'Explore freely'}</button><button className="is-primary" onClick={()=>save({phase:'active',step:0})}>{zh?'开始探索':'Start exploring'} →</button></div>
    </div>
  </div></>

  if(progress.phase==='done') return <>{resetButton}<div className="guide-complete">
    <span>✓</span><div><b>{zh?'你已经完成一次完整创作':'You completed a full creative flow'}</b><p>{zh?'文字素材 → Demo 探索 → Remix + 歌词连接 → 完整作品 → 右键导出':'Text material → Demos → Remix + Lyrics → Full work → Export'}</p></div>
    <button onClick={onCopy}>{zh?'复制为我的画板':'Copy to my boards'}</button>
    <button onClick={()=>save({phase:'free',step:steps.length-1})}>{zh?'继续探索':'Keep exploring'}</button>
    <button onClick={resetAll}>{zh?'重新开始':'Restart'}</button>
  </div></>

  return <>
    {resetButton}
    {blockedAttempt && <div className="guide-lock-toast">{zh?'请按当前步骤的提示操作':'Follow the current guided action'}</div>}
    {targetRect && <div className="guide-target-ring" style={{left:targetRect.left-6,top:targetRect.top-6,width:targetRect.width+12,height:targetRect.height+12}}/>}
    {!dragHintCollapsed && <aside className="guide-bubble" style={bubbleStyle}>
      <div className="guide-bubble__top"><span>{progress.step+1} / {steps.length}</span><button onClick={()=>save({phase:'free',step:progress.step})}>×</button></div>
      <h3>{step.title}</h3><p>{step.body}</p><em>{step.hint}</em>
      {showWhy && <div className="guide-bubble__why">{step.why}</div>}
      <div className="guide-bubble__actions"><button onClick={()=>setShowWhy(value=>!value)}>{showWhy?(zh?'收起':'Hide'):(zh?'为什么？':'Why?')}</button><button onClick={()=>{onPrepareStep(progress.step);advance()}}>{zh?'跳过':'Skip'}</button></div>
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
