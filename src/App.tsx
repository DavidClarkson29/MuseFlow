import { useCallback, useEffect, useContext, createContext, useState, useRef } from 'react'
import type { CanvasNode, Wire, Port } from './types'
import type { Lang } from './i18n'
import { strings } from './i18n'
import TopToolbar from './components/TopToolbar'
import LeftSidebar from './components/LeftSidebar'
import Canvas, { DEMO_CARD_H, DEMO_CARD_W, WORK_CARD_H, WORK_CARD_W } from './components/Canvas'
import type { DemoItem, WorkItem, WorkSource } from './components/Canvas'
import Inspector from './components/Inspector'
import CompareOverlay from './components/CompareOverlay'
import CommandBar from './components/CommandBar'
import DetailPanel from './components/DetailPanel'
import ProjectGallery, { type GalleryBoard } from './components/ProjectGallery'
import GuidedTour from './components/GuidedTour'
import { useMuseFlowState } from './hooks/useMuseFlowState'
import { createImportedNodes } from './importers/materialImport'
import { clearStoredWorkspace, hydrateProject, loadProject, releaseAssetUrls, saveProject, type ImportKind, type ProjectSnapshot } from './storage/projectStore'
import { getProjectExportCounts, runProjectExport } from './projectExporters'
import { buildGuidedExampleBoard, buildGuidedExampleNodes, buildGuidedIntentNode, buildGuidedLyricsNode, ensureGuidedExampleBoard, GUIDED_EXAMPLE_ID, GUIDE_FRAME_ID, GUIDE_IMAGE_ID, GUIDE_INTENT_ID, GUIDE_LYRICS_ID, GUIDE_REF_ID } from './guidedExample'
import { placeNodeWithoutOverlap, placeNodesWithoutOverlap } from './utils/canvasPlacement'
import { emitGuideEvent } from './guideEvents'
import { GUIDED_DEMO_AUDIO, GUIDED_WORK_AUDIO, resolveGuidedAudio } from './guidedAudio'
import { localizeBuiltinText } from './contentI18n'

export const LangCtx = createContext<Lang>('zh')
export const useLang = () => strings[useContext(LangCtx)]

const CITY_IMG = 'https://images.unsplash.com/photo-1541702467897-41915a07d3a7?w=400&h=280&fit=crop&auto=format'

export const FRAME_CANVAS_W = 520
const AUDIO_FOLDER_COMPACT_H = 480
const AUDIO_FOLDER_EXPANDED_H = 560
const AUDIO_FOLDER_LYRICS_EXTRA_H = 32
const isAutoAnchorId = (id:string) => id.includes('-ghost-') || id.includes('-auto-edge-')
function upsertBoard(boards:GalleryBoard[], board:GalleryBoard) {
  const index=boards.findIndex(item=>item.id===board.id)
  return index<0 ? [board,...boards] : boards.map(item=>item.id===board.id?board:item)
}

async function blobToDataUrl(blob:Blob) {
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader()
    reader.onload=()=>resolve(String(reader.result))
    reader.onerror=()=>reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function captureBoardThumbnail(board:GalleryBoard):Promise<{url:string;aspect:number} | undefined> {
  const visibleNodes=board.nodes.filter(node=>node.visible)
  if(!visibleNodes.length) return undefined
  const bounds=visibleNodes.map(node=>({x:node.x,y:node.y,w:node.w,h:node.h}))
  const minX=Math.min(...bounds.map(item=>item.x))
  const minY=Math.min(...bounds.map(item=>item.y))
  const maxX=Math.max(...bounds.map(item=>item.x+item.w))
  const maxY=Math.max(...bounds.map(item=>item.y+item.h))
  const contentW=Math.max(1,maxX-minX)
  const contentH=Math.max(1,maxY-minY)
  const captureWidth=1280
  const captureHeight=720
  const padding=52
  const fitScale=Math.min((captureWidth-padding*2)/contentW,(captureHeight-padding*2)/contentH)
  const scale=Math.min(fitScale,1.25)
  const panX=(captureWidth-contentW*scale)/2-minX*scale
  const panY=(captureHeight-contentH*scale)/2-minY*scale

  const host=document.createElement('div')
  host.className='museflow-thumbnail-capture'
  Object.assign(host.style,{
    position:'fixed',left:'-100000px',top:'0',width:`${captureWidth}px`,height:`${captureHeight}px`,
    overflow:'hidden',pointerEvents:'none',backgroundColor:'#111110',
    backgroundImage:'radial-gradient(circle,rgba(255,255,255,.045) .7px,transparent .8px)',
    backgroundSize:'18px 18px',fontFamily:'Inter,Arial,sans-serif',
  })
  const scene=document.createElement('div')
  scene.style.position='absolute'
  scene.style.left='0'
  scene.style.top='0'
  scene.style.width='20000px'
  scene.style.height='16000px'
  scene.style.transformOrigin='0 0'
  scene.style.transform=`translate(${panX}px,${panY}px) scale(${scale})`

  const svgNS='http://www.w3.org/2000/svg'
  const svg=document.createElementNS(svgNS,'svg')
  svg.setAttribute('width','20000')
  svg.setAttribute('height','16000')
  svg.style.position='absolute'
  svg.style.inset='0'
  svg.style.overflow='visible'
  svg.style.pointerEvents='none' as never
  const nodeMap=new Map(visibleNodes.map(node=>[node.id,node] as const))
  for(const wire of board.wires){
    const from=nodeMap.get(wire.fromNodeId)
    const to=nodeMap.get(wire.toNodeId)
    if(!from||!to||!from.visible||!to.visible) continue
    const fromPort=from.outputs.find(port=>port.id===wire.fromPortId) ?? from.inputs.find(port=>port.id===wire.fromPortId)
    const toPort=to.inputs.find(port=>port.id===wire.toPortId) ?? to.outputs.find(port=>port.id===wire.toPortId)
    const y1=from.y+(fromPort?.yRel ?? from.h/2)
    const y2=to.y+(toPort?.yRel ?? to.h/2)
    const x1=from.x+from.w
    const x2=to.x
    const cx=(x1+x2)/2
    const path=document.createElementNS(svgNS,'path')
    path.setAttribute('d',`M${x1} ${y1} C${cx} ${y1},${cx} ${y2},${x2} ${y2}`)
    path.setAttribute('fill','none')
    path.setAttribute('stroke',wire.color || '#6B6EF5')
    path.setAttribute('stroke-width','3')
    path.setAttribute('opacity','.46')
    svg.appendChild(path)
  }
  scene.appendChild(svg)

  const colorFor=(type:CanvasNode['type'])=>{
    if(type==='image') return '#42D9D0'
    if(type==='audio') return '#55C46A'
    if(type==='lyrics') return '#E56B8A'
    if(type==='audioFolder'||type==='work') return '#8A72FF'
    if(type==='direction') return '#F5A523'
    if(type==='frame') return '#6B6EF5'
    return '#7777E8'
  }
  for(const node of visibleNodes){
    const card=document.createElement('div')
    card.style.position='absolute'
    card.style.left=`${node.x}px`
    card.style.top=`${node.y}px`
    card.style.width=`${node.w}px`
    card.style.height=`${node.h}px`
    card.style.background='#191918'
    card.style.border=`2px solid ${colorFor(node.type)}`
    card.style.borderRadius='12px'
    card.style.overflow='hidden'
    card.style.display='flex'
    card.style.flexDirection='column'
    const header=document.createElement('div')
    header.style.height='35px'
    header.style.flexShrink='0'
    header.style.background='#141413'
    header.style.borderBottom='1px solid #30302e'
    header.style.display='flex'
    header.style.alignItems='center'
    header.style.padding='0 10px'
    header.style.gap='6px'
    const dot=document.createElement('div')
    dot.style.width='12px'
    dot.style.height='12px'
    dot.style.borderRadius='50%'
    dot.style.background=colorFor(node.type)
    dot.style.opacity='.8'
    dot.style.flexShrink='0'
    const label=document.createElement('span')
    label.textContent=String((node.data as Record<string,unknown>).name ?? (node.data as Record<string,unknown>).label ?? (node.data as Record<string,unknown>).content ?? node.type).slice(0,18)
    label.style.color='#c8c8c4'
    label.style.fontSize='13px'
    label.style.fontWeight='700'
    label.style.fontFamily='Inter,Arial'
    label.style.overflow='hidden'
    label.style.textOverflow='ellipsis'
    label.style.whiteSpace='nowrap'
    header.appendChild(dot)
    header.appendChild(label)
    card.appendChild(header)
    const body=document.createElement('div')
    body.style.flex='1'
    body.style.padding='8px 10px'
    body.style.overflow='hidden'
    body.style.display='flex'
    body.style.flexDirection='column'
    body.style.gap='6px'
    const imageUrl=typeof (node.data as Record<string,unknown>).imageUrl === 'string' ? (node.data as Record<string,unknown>).imageUrl as string : ''
    if(imageUrl){
      const img=document.createElement('img')
      img.src=imageUrl
      img.style.width='100%'
      img.style.height='100%'
      img.style.objectFit='cover'
      img.style.opacity='.78'
      img.style.display='block'
      img.dataset.thumbnailImage='1'
      body.appendChild(img)
    } else {
      const bar1=document.createElement('div')
      bar1.style.width='100%'
      bar1.style.height='7px'
      bar1.style.borderRadius='3.5px'
      bar1.style.background=colorFor(node.type)
      bar1.style.opacity='.22'
      const bar2=document.createElement('div')
      bar2.style.width='68%'
      bar2.style.height='5px'
      bar2.style.borderRadius='2.5px'
      bar2.style.background='#555550'
      bar2.style.opacity='.4'
      body.appendChild(bar1)
      body.appendChild(bar2)
      if(node.h>110){
        const bar3=document.createElement('div')
        bar3.style.width='82%'
        bar3.style.height='5px'
        bar3.style.borderRadius='2.5px'
        bar3.style.background='#31312f'
        bar3.style.marginTop='auto'
        body.appendChild(bar3)
      }
    }
    card.appendChild(body)
    scene.appendChild(card)
  }

  host.appendChild(scene)
  const captureStyle=document.createElement('style')
  captureStyle.textContent='.museflow-thumbnail-capture *{animation:none!important;transition:none!important;caret-color:transparent!important}'
  host.appendChild(captureStyle)
  document.body.appendChild(host)
  try {
    const imgs=[...host.querySelectorAll<HTMLImageElement>('img[data-thumbnail-image]')]
    await Promise.all(imgs.map(async img=>{
      if(!img.src) return
      try{
        const response=await fetch(img.src,{mode:'cors'})
        if(!response.ok) throw new Error('image fetch failed')
        img.src=await blobToDataUrl(await response.blob())
        if(!img.complete){
          await new Promise<void>(resolve=>{ img.onload=()=>resolve(); img.onerror=()=>resolve() })
        }
      } catch { img.removeAttribute('src') }
    }))
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
    const {default:html2canvas}=await import('html2canvas')
    const canvas=await html2canvas(host,{
      width:captureWidth,height:captureHeight,scale:1,backgroundColor:'#111110',
      useCORS:true,allowTaint:false,logging:false,imageTimeout:5000,
    })
    const result=canvas.toDataURL('image/jpeg',.88)
    return {url:result,aspect:16/9}
  } catch { return undefined }
  finally { host.remove() }
}

async function captureWorkspaceThumbnail(nodes:CanvasNode[]):Promise<{url:string;aspect:number} | undefined> {
  const visibleNodes=nodes.filter(node=>node.visible)
  const sourceScene=document.querySelector('.museflow-canvas-scene') as HTMLElement | null
  if(!sourceScene || !visibleNodes.length) return undefined

  // Measure the rendered tiles themselves. Complex cards such as fusion boards
  // can render at a size that differs from their persisted model geometry.
  const visibleIds=new Set(visibleNodes.map(node=>node.id))
  const renderedBounds=[...sourceScene.querySelectorAll<HTMLElement>('[data-node="1"]')]
    .filter(element=>visibleIds.has(element.dataset.nodeId ?? ''))
    .map(element=>({
      x:element.offsetLeft,
      y:element.offsetTop,
      w:Math.max(element.offsetWidth,element.scrollWidth),
      h:Math.max(element.offsetHeight,element.scrollHeight),
    }))
  const bounds=renderedBounds.length ? renderedBounds : visibleNodes.map(node=>({x:node.x,y:node.y,w:node.w,h:node.h}))
  const minX=Math.min(...bounds.map(item=>item.x))
  const minY=Math.min(...bounds.map(item=>item.y))
  const maxX=Math.max(...bounds.map(item=>item.x+item.w))
  const maxY=Math.max(...bounds.map(item=>item.y+item.h))
  const contentW=Math.max(1,maxX-minX)
  const contentH=Math.max(1,maxY-minY)
  // Project covers are always 16:9. The cards determine only the camera scale
  // and position inside this fixed cover, never the cover's aspect ratio.
  const captureWidth=1280
  const captureHeight=720
  const padding=52
  const fitScale=Math.min((captureWidth-padding*2)/contentW,(captureHeight-padding*2)/contentH)
  const scale=Math.min(fitScale,1.25)
  const panX=(captureWidth-contentW*scale)/2-minX*scale
  const panY=(captureHeight-contentH*scale)/2-minY*scale
  document.documentElement.dataset.thumbnailCamera=`${Math.round(minX)},${Math.round(minY)},${Math.round(maxX)},${Math.round(maxY)} @ ${scale.toFixed(4)}`

  const scene=sourceScene.cloneNode(true) as HTMLElement
  scene.style.position='absolute'
  scene.style.left='0'
  scene.style.top='0'
  scene.style.transformOrigin='0 0'
  scene.style.transform=`translate(${panX}px,${panY}px) scale(${scale})`
  scene.style.opacity='1'
  scene.style.filter='none'

  const originalFields=sourceScene.querySelectorAll('input,textarea')
  const clonedFields=scene.querySelectorAll('input,textarea')
  originalFields.forEach((field,index)=>{
    const cloned=clonedFields[index] as HTMLInputElement | HTMLTextAreaElement | undefined
    if(cloned) cloned.setAttribute('value',(field as HTMLInputElement | HTMLTextAreaElement).value)
  })

  const originalImages=[...sourceScene.querySelectorAll('img')]
  const clonedImages=[...scene.querySelectorAll('img')]
  await Promise.all(originalImages.map(async (image,index)=>{
    const target=clonedImages[index]
    if(!target || !image.currentSrc) return
    try {
      const response=await fetch(image.currentSrc,{mode:'cors'})
      if(!response.ok) throw new Error('image fetch failed')
      target.src=await blobToDataUrl(await response.blob())
    } catch { target.removeAttribute('src') }
  }))

  const host=document.createElement('div')
  host.className='museflow-thumbnail-capture'
  Object.assign(host.style,{
    position:'fixed',left:'-100000px',top:'0',width:`${captureWidth}px`,height:`${captureHeight}px`,
    overflow:'hidden',pointerEvents:'none',backgroundColor:'#111110',
    backgroundImage:'radial-gradient(circle,rgba(255,255,255,.045) .7px,transparent .8px)',
    backgroundSize:'18px 18px',fontFamily:'Inter,Arial,sans-serif',
  })
  const captureStyle=document.createElement('style')
  captureStyle.textContent='.museflow-thumbnail-capture *{animation:none!important;transition:none!important;caret-color:transparent!important}'
  host.append(captureStyle,scene)
  document.body.appendChild(host)
  try {
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
    const {default:html2canvas}=await import('html2canvas')
    const canvas=await html2canvas(host,{
      width:captureWidth,height:captureHeight,scale:1,backgroundColor:'#111110',
      useCORS:true,allowTaint:false,logging:false,imageTimeout:5000,
    })
    const result=canvas.toDataURL('image/jpeg',.88)
    delete document.documentElement.dataset.thumbnailCaptureError
    return {url:result,aspect:16/9}
  } catch (error) {
    document.documentElement.dataset.thumbnailCaptureError=error instanceof Error?error.message:String(error)
    return undefined
  } finally { host.remove() }
}

function audioFolderHeight(sourceCount:number, hasLyrics:boolean): number {
  return (sourceCount >= 3 ? AUDIO_FOLDER_EXPANDED_H : AUDIO_FOLDER_COMPACT_H) + (hasLyrics ? AUDIO_FOLDER_LYRICS_EXTRA_H : 0)
}

function hasLyricsConnection(nodeId:string, nodes:CanvasNode[], wires:Wire[]): boolean {
  return wires.some(wire => {
    if (wire.toNodeId !== nodeId && wire.fromNodeId !== nodeId) return false
    const otherId = wire.toNodeId === nodeId ? wire.fromNodeId : wire.toNodeId
    return nodes.some(node => node.id === otherId && node.type === 'lyrics' && node.visible)
  })
}

function normalizeAudioFolderLayout(nodes: CanvasNode[], wires: Wire[]): CanvasNode[] {
  let changed = false
  const usedPortIds = new Set(wires.flatMap(wire => [wire.fromPortId,wire.toPortId]))
  const next = nodes.map(node => {
    const inputs = node.inputs.filter(port => !isAutoAnchorId(port.id) || usedPortIds.has(port.id))
    const outputs = node.outputs.filter(port => !isAutoAnchorId(port.id) || usedPortIds.has(port.id))
    const portsChanged = inputs.length !== node.inputs.length || outputs.length !== node.outputs.length
    if (node.type !== 'audioFolder') {
      if (!portsChanged) return node
      changed = true
      return { ...node, inputs, outputs }
    }
    const sourceCount = ((node.data.sources as WorkSource[] | undefined) ?? []).length
    const targetHeight = audioFolderHeight(sourceCount, hasLyricsConnection(node.id,nodes,wires))
    if (node.h === targetHeight && !portsChanged) return node
    changed = true
    return { ...node, h:targetHeight, inputs, outputs }
  })
  return changed ? next : nodes
}

function py(i: number, total: number, h: number, top = 36, bot = 10): number {
  const body = h - top - bot
  if (total === 1) return top + body / 2
  return top + (body / (total - 1)) * i
}

let _nodeCounter = 0
function nid(prefix: string) {
  return `${prefix}-${++_nodeCounter}-${Date.now().toString(36)}`
}

const REF_ANALYSIS = { bpm: 96, key: 'F# Minor', style: 'City Pop / Jazz Fusion', sig: '4/4' }
const IMG_KEYWORDS = ['城市夜景', '霓虹', '暖色街灯', '雨后路面']

function buildInitialNodes(): CanvasNode[] {
  return [
    { id: 'img-city', type: 'image', x: 60, y: 90, w: 200, h: 176, visible: true, selected: false, inputs: [], outputs: [],
      data: { label: '图片素材', name: '夜晚城市', imageUrl: CITY_IMG, keywords: IMG_KEYWORDS, weight: 40 } },

    { id: 'audio-hum', type: 'audio', x: 60, y: 300, w: 200, h: 100, visible: true, selected: false, inputs: [], outputs: [],
      data: { label: '小样', duration: '0:08', isHum: true, weight: 55 } },

    { id: 'audio-ref', type: 'audio', x: 300, y: 90, w: 200, h: 156, visible: true, selected: false, inputs: [], outputs: [],
      data: { label: '参考音频', fileName: 'Reference_Track.mp3', duration: '3:42', isRef: true, weight: 35, analysis: REF_ANALYSIS } },

    { id: 'text-1', type: 'text', x: 300, y: 250, w: 200, h: 100, visible: true, selected: false, inputs: [], outputs: [],
      data: { content: '黄昏结束后的夜晚，不要太悲伤', weight: 30 } },
  ]
}

// ── 发散 Demo 规格 ──
const DEMO_SPEC_SETS = [
  [
    { lb: 'A', name: '暖调都市流行', color: '#F5A523', mood: '怀旧 / 温暖', style: '都市流行', texture: '温暖模拟质感', rhythm: '松弛律动', inst: 'Electric Piano / Bass / Clean Guitar', energy: 55,
      core: '以温暖模拟质感的城市流行铺底,突出电钢琴与干净吉他的对话感;保留原始旋律作为核心记忆点,副歌明亮开阔,尾奏渐弱渐远,营造"夜晚即将结束"的余韵。' },
    { lb: 'B', name: '暗色电影', color: '#7A7A78', mood: '忧郁 / 电影感', style: '电影配乐', texture: '暗调弦乐', rhythm: '推进感', inst: 'Strings / Piano / Low Synth', energy: 72,
      core: '以弦乐与低音合成为骨架,描绘雨夜都市的电影画面;和声偏小调暗色,律动稳定向前推进,人声低语式演绎,与温暖方向形成鲜明的冷暖对比。' },
    { lb: 'C', name: '梦幻电子', color: '#9B7EFF', mood: '飘渺 / 漂浮', style: '氛围电子', texture: '空气感铺底', rhythm: '稀疏留白', inst: 'Ambient Synth / Glitch', energy: 42,
      core: '以氛围合成器与空间混响为主体,节奏稀疏、大量留白;旋律碎片化漂浮,刻意剥离原始风格里最明显的标签,探索最自由、最实验的听觉空间。' },
  ],
  [
    { lb:'A', name:'曙光公路', color:'#F5A523', mood:'希望 / 开阔', style:'公路流行', texture:'金色颗粒感', rhythm:'稳定奔跑', inst:'Acoustic Guitar / Drums / Bass', energy:64, core:'以原声吉他的连续分解和稳定鼓组打开公路感,旋律从克制的主歌逐步走向宽阔副歌,像黑夜后第一道曙光。' },
    { lb:'B', name:'雨巷低语', color:'#7A7A78', mood:'孤独 / 克制', style:'极简民谣', texture:'近距离呼吸', rhythm:'自由摇曳', inst:'Felt Piano / Vocal / Cello', energy:36, core:'以毛毡钢琴和近距离人声保留呼吸与停顿,大提琴只在句尾回应,让每段沉默都成为叙事的一部分。' },
    { lb:'C', name:'玻璃潮汐', color:'#9B7EFF', mood:'清透 / 涌动', style:'有机电子', texture:'水光反射', rhythm:'波浪循环', inst:'Pluck Synth / Field Recording / Soft Kick', energy:58, core:'将玻璃质感的短促合成音与水声环境采样编织成循环,节拍像潮汐一样靠近又离开,在副歌留出明亮空间。' },
  ],
  [
    { lb:'A', name:'霓虹轻舞', color:'#F5A523', mood:'俏皮 / 轻快', style:'新浪漫放克', texture:'糖果合成质感', rhythm:'切分弹跳', inst:'Clavinet / Synth Bass / Handclap', energy:78, core:'用切分音色与弹跳低音构建轻盈舞感,人声保持俏皮和克制,在副歌加入短促群唱形成鲜明记忆点。' },
    { lb:'B', name:'卫星失联', color:'#7A7A78', mood:'紧张 / 疏离', style:'实验工业', texture:'金属故障感', rhythm:'断裂脉冲', inst:'Distorted Percussion / Drone / Radio Noise', energy:84, core:'将无线电噪声、金属打击与断裂脉冲组成不安定的节奏,旋律如远距离信号时隐时现,保留强烈戏剧弧线。' },
    { lb:'C', name:'无重力花园', color:'#9B7EFF', mood:'奇幻 / 舒展', style:'太空氛围', texture:'柔软星云感', rhythm:'无拍漂浮', inst:'Granular Pad / Choir / Bell', energy:31, core:'以颗粒化合成铺底和遥远合唱构成无重力空间,钟声像光点偶尔闪现,让旋律缓慢生长而不被明确节拍束缚。' },
  ],
] as const

const WORK_SPEC_SETS = {
  cover: [[
    { name:'霓虹翻唱版', color:'#FF4FA3', accent:'#8A7CFF', mood:'明亮 / 人声聚焦', style:'Modern Cover', energy:68, similarity:86, duration:'3:26' },
    { name:'深夜原声版', color:'#FF8A4C', accent:'#F4D35E', mood:'亲密 / 克制', style:'Acoustic Cover', energy:48, similarity:92, duration:'3:41' },
  ],[
    { name:'蓝调钢琴版', color:'#4F8CFF', accent:'#8A7CFF', mood:'深情 / 沉静', style:'Piano Soul Cover', energy:44, similarity:89, duration:'3:34' },
    { name:'夏日乐队版', color:'#FFB84D', accent:'#4FE0C1', mood:'明朗 / 鲜活', style:'Indie Band Cover', energy:73, similarity:83, duration:'3:22' },
  ],[
    { name:'雾中女声版', color:'#B36BFF', accent:'#5CE1E6', mood:'空灵 / 脆弱', style:'Ethereal Vocal Cover', energy:39, similarity:88, duration:'3:47' },
    { name:'赤色摇滚版', color:'#FF5C57', accent:'#FFB84D', mood:'热烈 / 直接', style:'Alternative Rock Cover', energy:87, similarity:79, duration:'3:15' },
  ]],
  remix: [[
    { name:'脉冲重混版', color:'#7C5CFF', accent:'#26E6D4', mood:'流动 / 推进', style:'Electronic Remix', energy:82, ratio:42, duration:'3:18' },
    { name:'午夜俱乐部版', color:'#2ED3FF', accent:'#B84CFF', mood:'冷艳 / 开阔', style:'Club Rework', energy:76, ratio:58, duration:'4:02' },
  ],[
    { name:'爵士大乐队', color:'#FF7A59', accent:'#F4D35E', mood:'灵活 / 跳脱 / 迷离', style:'Jazz Bigband Remix', energy:52, ratio:63, duration:'2:47' },
    { name:'Citypop！', color:'#22D3A7', accent:'#7C5CFF', mood:'灵动 / 错位', style:'Funky Citypop Remix', energy:69, ratio:46, duration:'1:42' },
  ],[
    { name:'电光超载版', color:'#A855F7', accent:'#22D3EE', mood:'强烈 / 未来', style:'Hyperpop Remix', energy:91, ratio:39, duration:'3:09' },
    { name:'月面深潜版', color:'#365CFF', accent:'#A78BFA', mood:'深邃 / 失重', style:'Ambient Techno Remix', energy:61, ratio:55, duration:'4:28' },
  ]],
  mashup: [[
    { name:'交叠共振版', color:'#FF4F81', accent:'#5CE1E6', mood:'碰撞 / 共鸣', style:'Cinematic Mashup', energy:74, ratio:51, duration:'3:36' },
    { name:'双轨幻彩版', color:'#9B5CFF', accent:'#FFB84D', mood:'梦幻 / 丰富', style:'Hybrid Mashup', energy:66, ratio:47, duration:'3:52' },
  ],[
    { name:'雨夜交叉版', color:'#3B82F6', accent:'#FF4F81', mood:'叙事 / 涌动', style:'Urban Mashup', energy:71, ratio:54, duration:'3:48' },
    { name:'星尘对话版', color:'#8B5CF6', accent:'#26E6D4', mood:'空灵 / 交织', style:'Ambient Mashup', energy:57, ratio:49, duration:'4:05' },
  ],[
    { name:'屋顶节拍版', color:'#F97316', accent:'#22C55E', mood:'热闹 / 自由', style:'Festival Mashup', energy:88, ratio:52, duration:'3:27' },
    { name:'反射面双生版', color:'#EC4899', accent:'#6366F1', mood:'矛盾 / 对称', style:'Art Pop Mashup', energy:69, ratio:48, duration:'3:58' },
  ]],
  extended: [[
    { name:'夜航延展版', color:'#4F8CFF', accent:'#42D9D0', mood:'舒展 / 渐进', style:'Extended Mix', energy:64, ratio:68, duration:'5:42' },
    { name:'长镜回声版', color:'#32A6FF', accent:'#9B7EFF', mood:'沉浸 / 连续', style:'Progressive Extension', energy:58, ratio:74, duration:'6:08' },
  ],[
    { name:'无尽公路版', color:'#2563EB', accent:'#F5A523', mood:'开阔 / 推进', style:'Road Extended Mix', energy:72, ratio:62, duration:'5:18' },
    { name:'潮汐加长版', color:'#0891B2', accent:'#8A7CFF', mood:'流动 / 呼吸', style:'Ambient Extension', energy:46, ratio:79, duration:'6:36' },
  ],[
    { name:'霓虹长夜版', color:'#3B82F6', accent:'#EC4899', mood:'迷离 / 延展', style:'Night Extended Cut', energy:69, ratio:57, duration:'5:56' },
    { name:'缓升终章版', color:'#6366F1', accent:'#42D9D0', mood:'克制 / 释放', style:'Longform Rework', energy:61, ratio:71, duration:'6:22' },
  ]],
  finalize: [[
    { name:'星辉终版', color:'#F5A523', accent:'#FF6A9B', mood:'完整 / 明亮', style:'Final Master', energy:70, ratio:52, duration:'3:36' },
    { name:'深夜母带版', color:'#FF9F43', accent:'#8A7CFF', mood:'凝练 / 平衡', style:'Polished Final', energy:63, ratio:48, duration:'4:02' },
  ],[
    { name:'影院终混版', color:'#F59E0B', accent:'#4F8CFF', mood:'宽阔 / 精准', style:'Cinematic Final Mix', energy:76, ratio:55, duration:'3:48' },
    { name:'暖光定稿版', color:'#EAB308', accent:'#42D9D0', mood:'温暖 / 成熟', style:'Release Final', energy:59, ratio:46, duration:'3:54' },
  ],[
    { name:'午夜发布版', color:'#FB923C', accent:'#EC4899', mood:'清晰 / 有力', style:'Release Master', energy:81, ratio:51, duration:'3:28' },
    { name:'晨雾终曲版', color:'#D97706', accent:'#A78BFA', mood:'细腻 / 收束', style:'Final Production', energy:54, ratio:49, duration:'4:11' },
  ]],
} as const

function randomSourceRatios(count:number) {
  if (count <= 0) return []
  if (count === 1) return [100]
  const minimum = count >= 4 ? 12 : 15
  const flexible = 100 - minimum * count
  const weights = Array.from({length:count}, () => 0.35 + Math.random())
  const total = weights.reduce((sum,value) => sum + value, 0)
  const exact = weights.map(value => minimum + value / total * flexible)
  const result = exact.map(Math.floor)
  let remainder = 100 - result.reduce((sum,value) => sum + value, 0)
  const order = exact.map((value,index) => ({index,fraction:value-Math.floor(value)})).sort((a,b)=>b.fraction-a.fraction)
  for (let i=0; i<remainder; i++) result[order[i % order.length].index] += 1
  if (result.every(value => value === result[0])) { result[0] += 3; result[result.length-1] -= 3 }
  return result
}

export default function App() {
  const {
    lang, setLang, nodes, setNodes, wires, setWires,
    inspectedNode, setInspectedNode,
    compareIds, setCompareIds, showCompare, setShowCompare,
    cmdkOpen, setCmdkOpen, parkingIds, setParkingIds,
    detailId, setDetailId, viewport, setViewport, nodesRef, wiresRef,
  } = useMuseFlowState(buildInitialNodes)
  const [storageReady,setStorageReady] = useState(false)
  const [lastManualSavedAt,setLastManualSavedAt] = useState<number | null>(null)
  const [projectSaveState,setProjectSaveState] = useState<'idle'|'saving'|'saved'|'restored'|'error'>('idle')
  const [testMode,setTestMode] = useState(false)
  const [activeBoardId,setActiveBoardId] = useState(GUIDED_EXAMPLE_ID)
  const [activeProjectName,setActiveProjectName] = useState(()=>buildGuidedExampleBoard().name)
  const [boards,setBoards] = useState<GalleryBoard[]>(()=>[buildGuidedExampleBoard()])
  const [galleryMounted,setGalleryMounted] = useState(true)
  const [galleryClosing,setGalleryClosing] = useState(false)
  const [tutorialPromptOpen,setTutorialPromptOpen] = useState(true)
  const initialGalleryCaptureDoneRef = useRef(false)
  const [focusRequest,setFocusRequest] = useState<{nodeId:string;selector?:string;token:number}|undefined>()
  const handleViewportChange = useCallback((panX: number, panY: number, zoom: number, width: number, height: number) => {
    setViewport({ panX, panY, zoom, width, height })
  }, [])

  const s = strings[lang]

  useEffect(()=>{
    document.documentElement.lang=lang==='zh'?'zh-CN':'en'
  },[lang])

  const currentBoardSnapshot = useCallback(():GalleryBoard => {
    const metadata=boards.find(board=>board.id===activeBoardId)
    return {
      id:activeBoardId,
      name:activeProjectName,
      nodes:nodesRef.current.map(node=>({...node,selected:false})),
      wires:[...wiresRef.current],
      updatedAt:Date.now(),
      kind:metadata?.kind,
      description:metadata?.description,
      durationLabel:metadata?.durationLabel,
      templateVersion:metadata?.templateVersion,
      thumbnail:metadata?.thumbnail,
      thumbnailAspect:metadata?.thumbnailAspect,
    }
  },[activeBoardId,activeProjectName,boards])

  const handleOpenGallery = useCallback(async () => {
    const snapshot=currentBoardSnapshot()
    const capture=await captureWorkspaceThumbnail(nodesRef.current)
    setBoards(previous=>{
      const previousBoard=previous.find(board=>board.id===snapshot.id)
      return upsertBoard(previous,{
        ...snapshot,
        thumbnail:capture?.url ?? previousBoard?.thumbnail,
        thumbnailAspect:capture ? 16/9 : previousBoard?.thumbnailAspect,
      })
    })
    // 将“夜晚驾驶灵感”的真实画布捕获逻辑复用于“孤独霓虹”：为示例画板按需生成同款 16/9 真实缩略图，而非回退 SVG
    setBoards(previous=>{
      const exampleBoard=previous.find(board=>board.id===GUIDED_EXAMPLE_ID)
      if(!exampleBoard || exampleBoard.thumbnail) return previous
      void captureBoardThumbnail(exampleBoard).then(capture2=>{
        if(!capture2) return
        setBoards(inner=>{
          const current=inner.find(board=>board.id===GUIDED_EXAMPLE_ID)
          if(!current || current.thumbnail) return inner
          return upsertBoard(inner,{...current,thumbnail:capture2.url,thumbnailAspect:capture2.aspect})
        })
      })
      return previous
    })
    setGalleryClosing(false)
    setGalleryMounted(true)
  },[currentBoardSnapshot])

  const handleCloseGallery = useCallback(() => {
    if (galleryClosing) return
    setGalleryClosing(true)
    window.setTimeout(()=>{
      setGalleryMounted(false)
      setGalleryClosing(false)
    },320)
  },[galleryClosing])

  const applyProjectSnapshot = useCallback(async (snapshot:ProjectSnapshot) => {
    const hydrated = await hydrateProject(snapshot)
    releaseAssetUrls(nodesRef.current)
    setNodes(normalizeAudioFolderLayout(hydrated.nodes, hydrated.wires))
    setWires(hydrated.wires)
    setLang(hydrated.lang)
    setDetailId(null)
    setInspectedNode(null)
    setCompareIds([])
    setShowCompare(false)
  }, [])

  const handleOpenBoard = useCallback(async (id:string) => {
    const target=boards.find(board=>board.id===id)
    if (!target) return
    if (id!==activeBoardId) {
      setBoards(previous=>upsertBoard(upsertBoard(previous,currentBoardSnapshot()),target))
      await applyProjectSnapshot({version:1,savedAt:target.updatedAt,lang,nodes:target.nodes,wires:target.wires})
      setActiveBoardId(target.id)
      setActiveProjectName(target.name)
      setLastManualSavedAt(null)
      setProjectSaveState('idle')
    }
    handleCloseGallery()
  },[boards,activeBoardId,currentBoardSnapshot,applyProjectSnapshot,lang,handleCloseGallery])

  const handleCreateBoard = useCallback(() => {
    const id=`board-${Date.now().toString(36)}`
    const count=boards.length+1
    const name=lang==='zh'?`未命名画板 ${count}`:`Untitled Board ${count}`
    const board:GalleryBoard={id,name,nodes:[],wires:[],updatedAt:Date.now()}
    setBoards(previous=>[board,...upsertBoard(previous,currentBoardSnapshot())])
    releaseAssetUrls(nodesRef.current)
    setNodes([])
    setWires([])
    setActiveBoardId(id)
    setActiveProjectName(name)
    setDetailId(null)
    setInspectedNode(null)
    setCompareIds([])
    setShowCompare(false)
    setLastManualSavedAt(null)
    setProjectSaveState('idle')
    handleCloseGallery()
  },[boards.length,lang,currentBoardSnapshot,handleCloseGallery])

  const handleDeleteBoard = useCallback((id:string) => {
    const board=boards.find(item=>item.id===id)
    if (!board || board.kind==='example') return
    const remaining=boards.filter(item=>item.id!==id)
    if (id===activeBoardId) {
      const next=remaining.find(item=>item.kind!=='example') ?? remaining.find(item=>item.kind==='example') ?? buildGuidedExampleBoard()
      setActiveBoardId(next.id)
      setActiveProjectName(next.name)
      void applyProjectSnapshot({version:1,savedAt:next.updatedAt,lang,nodes:next.nodes,wires:next.wires})
      setLastManualSavedAt(null)
      setProjectSaveState('idle')
    }
    setBoards(remaining)
  },[boards,activeBoardId,applyProjectSnapshot,lang])

  const handleTutorialNeed = useCallback(async () => {
    setTutorialPromptOpen(false)
    await handleOpenBoard(GUIDED_EXAMPLE_ID)
  },[handleOpenBoard])

  const handleTutorialBlank = useCallback(() => {
    setTutorialPromptOpen(false)
    handleCreateBoard()
  },[handleCreateBoard])

  const handleTutorialStay = useCallback(() => {
    setTutorialPromptOpen(false)
  },[])

  useEffect(() => {
    if (!tutorialPromptOpen || !galleryMounted || galleryClosing) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleTutorialStay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tutorialPromptOpen, galleryMounted, galleryClosing, handleTutorialStay])

  useEffect(() => {
    if (!galleryMounted || galleryClosing || !storageReady || initialGalleryCaptureDoneRef.current) return
    initialGalleryCaptureDoneRef.current = true
    void captureWorkspaceThumbnail(nodesRef.current).then(capture=>{
      if(!capture) return
      const snap=currentBoardSnapshot()
      setBoards(previous=>{
        const previousBoard=previous.find(board=>board.id===snap.id)
        if(previousBoard?.thumbnail===capture.url) return previous
        return upsertBoard(previous,{...snap,thumbnail:capture.url,thumbnailAspect:16/9})
      })
    })
    setBoards(previous=>{
      const exampleBoard=previous.find(board=>board.id===GUIDED_EXAMPLE_ID)
      if(!exampleBoard || exampleBoard.thumbnail) return previous
      void captureBoardThumbnail(exampleBoard).then(capture2=>{
        if(!capture2) return
        setBoards(inner=>{
          const current=inner.find(board=>board.id===GUIDED_EXAMPLE_ID)
          if(!current || current.thumbnail) return inner
          return upsertBoard(inner,{...current,thumbnail:capture2.url,thumbnailAspect:capture2.aspect})
        })
      })
      return previous
    })
  }, [galleryMounted, galleryClosing, storageReady, currentBoardSnapshot])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await clearStoredWorkspace()
        if (cancelled) return
        localStorage.removeItem('museflow-board-library-v1')
        localStorage.removeItem('museflow-active-board-v1')
        localStorage.removeItem('museflow-active-board-name-v1')
        localStorage.removeItem('museflow-midnight-guide-v2')
        const example=buildGuidedExampleBoard()
        setBoards([example])
        setActiveBoardId(example.id)
        setActiveProjectName(example.name)
        await applyProjectSnapshot({version:1,savedAt:example.updatedAt,lang,nodes:example.nodes,wires:example.wires})
        if (!cancelled) setLastManualSavedAt(null)
      } catch {
        if (!cancelled) setProjectSaveState('error')
      } finally {
        if (!cancelled) setStorageReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [applyProjectSnapshot])

  useEffect(() => {
    if (!storageReady) return
    const timer = window.setTimeout(() => {
      saveProject('autosave',nodes,wires,lang).catch(()=>setProjectSaveState('error'))
    },700)
    return () => window.clearTimeout(timer)
  }, [storageReady,nodes,wires,lang])

  useEffect(() => {
    setNodes(prev => normalizeAudioFolderLayout(prev, wires))
  }, [wires])

  useEffect(() => {
    const update = () => document.documentElement.setAttribute('data-visibility', document.visibilityState === 'hidden' ? 'hidden' : 'visible')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  const handleSaveProject = useCallback(async () => {
    setProjectSaveState('saving')
    try {
      const savedAt = await saveProject('manual',nodesRef.current,wiresRef.current,lang)
      setLastManualSavedAt(savedAt)
      setProjectSaveState('saved')
      window.setTimeout(()=>setProjectSaveState('idle'),1800)
    } catch {
      setProjectSaveState('error')
    }
  }, [lang])

  const handleRestoreProject = useCallback(async () => {
    setProjectSaveState('saving')
    try {
      const saved = await loadProject('manual')
      if (!saved) { setProjectSaveState('idle'); return }
      await applyProjectSnapshot(saved)
      setLastManualSavedAt(saved.savedAt)
      setProjectSaveState('restored')
      window.setTimeout(()=>setProjectSaveState('idle'),1800)
    } catch {
      setProjectSaveState('error')
    }
  }, [applyProjectSnapshot])

  useEffect(() => {
    const onSaveShortcut = (e:KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return
      e.preventDefault()
      void handleSaveProject()
    }
    window.addEventListener('keydown',onSaveShortcut)
    return () => window.removeEventListener('keydown',onSaveShortcut)
  }, [handleSaveProject])

  const handleImportFiles = useCallback(async (files:File[],kind:ImportKind='auto',point?:{x:number;y:number}) => {
    if (!files.length) return
    const cx = (viewport.width/2-viewport.panX)/viewport.zoom
    const cy = (viewport.height/2-viewport.panY)/viewport.zoom
    const imported = await createImportedNodes(files,kind,point?.x ?? cx-100,point?.y ?? cy-80)
    if (!imported.length) return
    setNodes(prev=>{
      const placed=placeNodesWithoutOverlap(imported,prev,{avoidFrames:!point}).map((node,index)=>({...node,selected:index===imported.length-1}))
      return [...prev.map(n=>({...n,selected:false})),...placed]
    })
  }, [viewport])

  const selectNode = useCallback((id: string | null) => {
    setNodes(prev => prev.map(n => ({ ...n, selected: n.id === id })))
  }, [])

  const selectMany = useCallback((ids: string[] | null) => {
    setNodes(prev => prev.map(n => ({ ...n, selected: ids ? ids.includes(n.id) : false })))
  }, [])

  // 仅画布交互才联动右侧详情；机架点击仅选中画布，不跳详情
  const handleCanvasSelect = useCallback((id: string | null) => {
    setNodes(prev => prev.map(n => ({ ...n, selected: n.id === id })))
    if (id === null) {
      setDetailId(null)
      return
    }
    const n = nodesRef.current.find(x => x.id === id)
    const isDemoWork = !!(n && ((n.type === 'direction' && !!(n.data as any).demo) || n.type === 'work' || !!(n.data as any).fullTrack))
    setDetailId(isDemoWork ? id : null)
  }, [])

  const handleCanvasSelectMany = useCallback((ids: string[] | null) => {
    setNodes(prev => prev.map(n => ({ ...n, selected: ids ? ids.includes(n.id) : false })))
    if (ids && ids.length === 1) {
      const n = nodesRef.current.find(x => x.id === ids[0])
      const isDemoWork = !!(n && ((n.type === 'direction' && !!(n.data as any).demo) || n.type === 'work' || !!(n.data as any).fullTrack))
      setDetailId(isDemoWork ? ids[0] : null)
    } else {
      setDetailId(null)
    }
  }, [])

  const handleRackSelect = useCallback((id: string | null) => {
    setNodes(prev => prev.map(n => ({ ...n, selected: n.id === id })))
    setDetailId(null)
  }, [])

  const handleCanvasOpenDetail = useCallback((id: string) => {
    const n = nodesRef.current.find(x => x.id === id)
    if (!n) return
    setNodes(prev => prev.map(x => ({ ...x, selected: x.id === id })))
    setDetailId(id)
    emitGuideEvent({type:'detail-open',nodeId:id})
  }, [])

  const handleCloseDetail = useCallback(() => {
    setNodes(prev => prev.map(n => ({ ...n, selected: false })))
    setDetailId(null)
  }, [])

  const openInspector = useCallback((id: string) => {
    const n = nodesRef.current.find(x => x.id === id) ?? null
    setInspectedNode(n)
  }, [])

  const updateNodePosition = useCallback((id: string, x: number, y: number) => {
    setNodes(prev => {
      const old = prev.find(n => n.id === id)
      if (!old) return prev
      const dx = x - old.x, dy = y - old.y
      if (old.type === 'frame' && (dx !== 0 || dy !== 0)) {
        // 黑板拖动 → 场内素材保持相对位置一起移动
        const inFrame = (n: CanvasNode) =>
          ['image','audio','text'].includes(n.type) &&
          n.x + n.w/2 > old.x && n.x + n.w/2 < old.x + FRAME_CANVAS_W &&
          n.y + n.h/2 > old.y && n.y + n.h/2 < old.y + old.h
        return prev.map(n => inFrame(n) ? { ...n, x: n.x + dx, y: n.y + dy } : n.id === id ? { ...n, x, y } : n)
      }
      return prev.map(n => n.id === id ? { ...n, x, y } : n)
    })
  }, [])

  const updateGroupPositions = useCallback((updates: Array<{ id: string; x: number; y: number }>) => {
    if (updates.length === 0) return
    const updateMap = new Map(updates.map(u => [u.id, u] as const))
    setNodes(prev => {
      // 直接应用选中组的位移
      let next = prev.map(n => {
        const u = updateMap.get(n.id)
        return u ? { ...n, x: u.x, y: u.y } : n
      })
      // 同步移动：被选中的黑板需带动板内未被选中的素材一起移动（避免二次偏移）
      for (const upd of updates) {
        const old = prev.find(n => n.id === upd.id)
        if (!old || old.type !== 'frame') continue
        const dx = upd.x - old.x, dy = upd.y - old.y
        if (dx === 0 && dy === 0) continue
        const inFrame = (n: CanvasNode) =>
          ['image','audio','text'].includes(n.type) &&
          n.x + n.w/2 > old.x && n.x + n.w/2 < old.x + FRAME_CANVAS_W &&
          n.y + n.h/2 > old.y && n.y + n.h/2 < old.y + old.h
        next = next.map(n => {
          if (updateMap.has(n.id)) return n // 组内已按 delta 移动，避免二次偏移
          return inFrame(n) ? { ...n, x: n.x + dx, y: n.y + dy } : n
        })
      }
      return next
    })
  }, [])

  const updateNodeSize = useCallback((id: string, w: number, h: number) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== id) return n
      if (n.type === 'text') return { ...n, w:n.w, h:Math.max(100,h) }
      return { ...n, w:Math.max(280,w), h:Math.max(260,h) }
    }))
  }, [])

  const updateNodeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
  }, [])

  const addWire = useCallback((wire: Wire) => {
    setWires(prev => [...prev.filter(w => !(w.toNodeId === wire.toNodeId && w.toPortId === wire.toPortId)), wire])
  }, [])

  const removeWire = useCallback((wireId: string) => {
    const remaining = wiresRef.current.filter(wire => wire.id !== wireId)
    const usedPortIds = new Set(remaining.flatMap(wire => [wire.fromPortId,wire.toPortId]))
    setWires(remaining)
    setNodes(current => current.map(node => {
      const inputs = node.inputs.filter(port => !isAutoAnchorId(port.id) || usedPortIds.has(port.id))
      const outputs = node.outputs.filter(port => !isAutoAnchorId(port.id) || usedPortIds.has(port.id))
      return inputs.length === node.inputs.length && outputs.length === node.outputs.length
        ? node
        : { ...node, inputs, outputs }
    }))
  }, [])

  const deleteSelected = useCallback(() => {
    const selIds = new Set(nodesRef.current.filter(n => n.selected).map(n => n.id))
    if (selIds.size === 0) return
    setDetailId(prev => (prev && selIds.has(prev) ? null : prev))
    setCompareIds(prev => prev.filter(id => !selIds.has(id)))
    setParkingIds(prev => prev.filter(id => !selIds.has(id)))
    setWires(prev => prev.filter(w => !selIds.has(w.fromNodeId) && !selIds.has(w.toNodeId)))
    setNodes(prev => {
      const ids = new Set(prev.filter(n => n.selected).map(n => n.id))
      if (ids.size === 0) return prev
      setInspectedNode(inn => (inn && ids.has(inn.id) ? null : inn))
      return prev.filter(n => !ids.has(n.id))
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setCmdkOpen(v => !v); return
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (inField || cmdkOpen) return
      deleteSelected()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [deleteSelected, cmdkOpen])

  // ── 黑板 ──
  const handleAddFrame = useCallback(() => {
    const frame: CanvasNode = {
      id: nid('frame'), type: 'frame', x: 620, y: 100, w: 780, h: 640,
      visible: true, selected: false,
      inputs: [{ id: nid('lyin'), label: 'Lyrics', dataType: 'text', color: '#E56B8A', yRel: 44 }],
      outputs: [{ id: nid('fout'), label: 'Possibilities', dataType: 'direction', color: '#8A8A86', yRel: 70 }],
      data: { name: '', mode: 'song', vocal: 'female', timeSig: '4/4',
        prompt: '', promptDirty: false, negative: '', generating: false },
    }
    setNodes(prev => [...prev,placeNodeWithoutOverlap(frame,prev)])
  }, [])

  const compileLyrics = useCallback((sections: Array<{label:string, content:string}>) => {
    return sections.filter(s => String(s.content ?? '').trim()).map(s => `[${s.label}]\n${String(s.content).trim()}`).join('\n\n')
  }, [])

  const getConnectedLyrics = useCallback((targetId: string) => {
    const curWires = wiresRef.current
    const curNodes = nodesRef.current
    // 双向检测：无论歌词是 from 还是 to，只要与 target 相连就视为已连接
    const lyricIds = new Set(curWires
      .filter(w => w.toNodeId === targetId || w.fromNodeId === targetId)
      .map(w => w.toNodeId === targetId ? w.fromNodeId : w.toNodeId))
    const parts: string[] = []
    for (const nid of lyricIds) {
      const n = curNodes.find(x => x.id === nid && x.type === 'lyrics' && x.visible)
      if (!n) continue
      const secs = (n.data.sections as Array<{label:string, content:string}> | undefined) ?? []
      const txt = compileLyrics(secs)
      if (txt) parts.push(txt)
      const title = String(n.data.title ?? '').trim()
      if (title && !parts.some(p=>p.includes(title))) parts.unshift(`标题：${title}`)
    }
    return parts.join('\n\n')
  }, [compileLyrics])

  // ── 发散思考 ──
  // ── 发散思考：黑板底部抽屉生成 3 个 Demo ──
  const handleDivergeFrame = useCallback((frameId: string) => {
    const cur = nodesRef.current
    const frame = cur.find(n => n.id === frameId)
    if (!frame || frame.data.generating) return
    const inFrameMats = cur.filter(n =>
      ['image','audio','text'].includes(n.type) && n.visible &&
      n.x + n.w/2 > frame.x && n.x + n.w/2 < frame.x + FRAME_CANVAS_W &&
      n.y + n.h/2 > frame.y && n.y + n.h/2 < frame.y + frame.h)
    const mats = inFrameMats.length ? inFrameMats : cur.filter(n => ['image','audio','text'].includes(n.type) && n.visible)
    const negative = String(frame.data.negative ?? '')
    const refM = mats.find(m => m.data.isRef)
    const an = refM?.data.analysis as { bpm:number; key:string; style:string } | undefined
    const vocalTxt = frame.data.mode === 'inst' ? s.modeInst : `${s.modeSong} · ${frame.data.vocal==='male'?s.male:s.female}`
    const timeSigRaw2 = String(frame.data.timeSig ?? '').trim()
    const timeSigPart2 = timeSigRaw2 ? `${timeSigRaw2} 拍` : `拍号不指定`
    const headLine = `${vocalTxt},${timeSigPart2}${an?`,${an.bpm} BPM · ${an.key}`:''}。${an?`风格基调参考:${an.style}。`:''}`
    const partsLine = mats.length
      ? `素材比重:${[...mats].sort((a,b)=>(Number(b.data.weight??0))-(Number(a.data.weight??0)))
          .map(m=>`${String(m.data.name ?? m.data.label ?? (m.type==='text'?(String(m.data.title ?? '')||'文字意向'):'')).slice(0,8)} ${Number(m.data.weight??0)}%`).join(' · ')}。`
      : ''
    const negLine = negative ? `\n排除/避免:${negative}。` : ''
    const copyVariant = Number(frame.data.copyVariant ?? 0)
    // 教学实例是一套有标准答案的交互原型：无论重复生成多少次，
    // 都只返回同一组三张 Demo，方便后续绑定逐张制作的真实音频。
    const isGuidedExample = activeBoardId===GUIDED_EXAMPLE_ID
    const demoSpecs = isGuidedExample ? DEMO_SPEC_SETS[0] : DEMO_SPEC_SETS[copyVariant % DEMO_SPEC_SETS.length]

    setNodes(prev => prev.map(n => n.id === frameId ? { ...n, data: { ...n.data, generating: true } } : n))
    setTimeout(() => {
      setNodes(prev => prev.map(n => {
        if (n.id !== frameId) return n
        // 控制台当时参数快照（用于双击弹窗在 Prompt 上方回显）
        const curFrame = cur.find(x => x.id === frameId) ?? frame
        const lyricText = getConnectedLyrics(frameId)
        const lyricLine = lyricText ? `\n歌词：\n${lyricText}` : ''
        const recipe = {
          mats: mats.map(m => ({
            name: String(m.data.name ?? m.data.label ?? (m.type === 'text' ? String(m.data.title ?? '') || '文字意向' : m.id)).slice(0, 12),
            weight: Number(m.data.weight ?? 0),
            kind: String(m.type),
            isRef: !!m.data.isRef,
            fileName: m.data.fileName ? String(m.data.fileName) : undefined,
          })),
          mode: String(curFrame.data.mode ?? 'song'),
          vocal: String(curFrame.data.vocal ?? 'female'),
          timeSig: String(curFrame.data.timeSig ?? '4/4'),
          negative: String(curFrame.data.negative ?? ''),
          prompt: String(curFrame.data.promptDirty ? (curFrame.data.prompt ?? '') : ''),
          lyrics: lyricText || undefined,
        }
        const demos = demoSpecs.map(sp => ({
          id: nid('demo'), lb: sp.lb, name: sp.name, color: sp.color,
          mood: sp.mood, style: sp.style, texture: sp.texture, rhythm: sp.rhythm,
          energy: sp.energy, duration: '0:30',
          ...(isGuidedExample?GUIDED_DEMO_AUDIO[sp.name]:undefined),
          recipe,
          lyrics: lyricText || undefined,
          usedPrompt: [
            headLine,
            `方向 ${sp.lb}|${sp.name} —— ${sp.core}`,
            `配器:${sp.inst};能量 ${sp.energy}%;${sp.rhythm}。`,
            partsLine,
          ].filter(Boolean).join('\n') + negLine + lyricLine,
        }))
        return { ...n, data: { ...n.data, generating: false, demos, copyVariant:isGuidedExample?0:copyVariant + 1 } }
      }))
    }, 1500)
  }, [activeBoardId,lang])

  const handleExtractDemo = useCallback((_frameId: string, demo: DemoItem, x: number, y: number) => {
    const audio=demo.audioUrl?undefined:resolveGuidedAudio(demo.name)
    const card: CanvasNode = {
      id: demo.id,
      type: 'direction',
      x,
      y,
      w: DEMO_CARD_W,
      h: DEMO_CARD_H,
      visible: true,
      selected: true,
      inputs: [],
      outputs: [{ id:nid('demo-out'), label:'Direction', dataType:'direction', color:demo.color, yRel:70 }],
      data: { ...demo, ...(audio??{}), demo:true, label:demo.name, tags:[] },
    }
    setNodes(prev => [...prev.map(n => ({ ...n, selected:false })),placeNodeWithoutOverlap(card,prev)])
    setDetailId(demo.id)
  }, [])

  const handleCreateAudioFolder = useCallback((sourceId: string, targetId: string) => {
    const cur = nodesRef.current
    const source = cur.find(n => n.id === sourceId)
    const target = cur.find(n => n.id === targetId)
    if (!source || !target || source.id === target.id) return
    // 黑板内音频互叠不触发
    {
      const frames = cur.filter(n => n.type === 'frame' && n.visible)
      const inside = (n: CanvasNode) => frames.some(f => n.x + n.w/2 > f.x && n.x + n.w/2 < f.x + FRAME_CANVAS_W && n.y + n.h/2 > f.y && n.y + n.h/2 < f.y + f.h)
      if (inside(source) && inside(target)) return
    }
    const toSource = (n: CanvasNode) => {
      const rawName = String(n.data.name ?? n.data.label ?? n.data.fileName ?? (n.data.isHum ? '小样' : n.id))
      const isWork = n.type === 'work'
      const isDemo = n.type === 'direction' && !!(n.data as any).demo
      return {
      id:n.id,
      name:rawName === '__HUM__' ? s.addHumClip : rawName === '__REF__' ? s.qAddReference : rawName,
      kind:isDemo ? 'demo' : isWork ? 'work' : n.data.isRef ? 'reference' : n.data.isHum ? 'hum' : n.type,
      color:String(n.data.color ?? (n.data.isRef ? '#4BA35A' : '#F5A523')),
      accent: isWork ? String((n.data as any).accent ?? '#42D9D0') : undefined,
      mode: isWork ? String((n.data as any).mode ?? 'remix') : undefined,
      duration:n.data.duration ? String(n.data.duration) : undefined,
      audioUrl:typeof n.data.audioUrl==='string' ? n.data.audioUrl : undefined,
      fileName:n.data.fileName ? String(n.data.fileName) : undefined,
      mood:n.data.mood ? String(n.data.mood) : undefined,
      style:n.data.style ? String(n.data.style) : undefined,
      texture:n.data.texture ? String(n.data.texture) : undefined,
      rhythm:n.data.rhythm ? String(n.data.rhythm) : undefined,
      originalType: n.type,
      originalData: { ...n.data } as Record<string, unknown>,
      w: n.w,
      h: n.h,
    }}
    if (target.type === 'audioFolder') {
      const oldSources = (target.data.sources as ReturnType<typeof toSource>[] | undefined) ?? []
      if (oldSources.some(s => s.id === source.id) || oldSources.length >= 4) return
      const nextSources = [...oldSources,toSource(source)]
      const hasLyrics = hasLyricsConnection(target.id,nodesRef.current,wiresRef.current)
      setNodes(prev => {
        const remaining=prev.filter(n=>n.id!==source.id)
        const currentFolder=remaining.find(n=>n.id===target.id)
        if(!currentFolder)return remaining
        const expanded={...currentFolder,h:audioFolderHeight(nextSources.length,hasLyrics),selected:true,data:{...currentFolder.data,sources:nextSources}}
        const placed=placeNodeWithoutOverlap(expanded,remaining.filter(n=>n.id!==target.id))
        return remaining.map(n=>n.id===target.id?placed:{...n,selected:false})
      })
      setWires(prev => prev.filter(w => w.fromNodeId !== source.id && w.toNodeId !== source.id))
      setCompareIds(prev => prev.filter(id => id !== source.id))
      return
    }
    const folder: CanvasNode = {
      id:nid('audio-folder'), type:'audioFolder', x:target.x + target.w/2 - 270, y:target.y, w:540, h:AUDIO_FOLDER_COMPACT_H,
      visible:true, selected:true,
      inputs:[{ id: nid('lyin'), label: 'Lyrics', dataType: 'text', color: '#E56B8A', yRel: 44 }],
      outputs:[{ id:nid('folder-out'), label:'Full tracks', dataType:'audio', color:'#8A7CFF', yRel:64 }],
      data:{ name:'音频创作夹', sources:[toSource(target),toSource(source)], mode:activeBoardId===GUIDED_EXAMPLE_ID?'cover':'remix', prompt:'', generating:false, works:[], weirdness:50, styleInfluence:50, audioInfluence:25, durationMode:'auto' },
    }
    const removed = new Set([source.id,target.id])
    setNodes(prev => {
      const remaining=prev.filter(n=>!removed.has(n.id))
      const placed=placeNodeWithoutOverlap(folder,remaining)
      return [...remaining.map(n=>({...n,selected:false})),placed]
    })
    setWires(prev => prev.filter(w => !removed.has(w.fromNodeId) && !removed.has(w.toNodeId)))
    setCompareIds(prev => prev.filter(id => !removed.has(id)))
  }, [activeBoardId, s.qAddReference, s.addHumClip])

  const handleGenerateAudioFolder = useCallback((folderId: string) => {
    const folder = nodesRef.current.find(n => n.id === folderId)
    if (!folder || folder.type !== 'audioFolder' || folder.data.generating) return
    const lyricText = getConnectedLyrics(folderId)
    const lyricLine = lyricText ? `\n歌词：\n${lyricText}` : ''
    setNodes(prev => prev.map(n => n.id === folderId ? { ...n, data:{ ...n.data, generating:true } } : n))
    window.setTimeout(() => {
      setNodes(prev => prev.map(n => {
        if (n.id !== folderId) return n
        const requestedMode = String(n.data.mode ?? 'remix') as WorkItem['mode']
        const isGuidedExample = activeBoardId===GUIDED_EXAMPLE_ID
        const mode:WorkItem['mode'] = isGuidedExample?'remix':requestedMode
        const sources = (n.data.sources as WorkItem['sources'] | undefined) ?? []
        const prompt = String(n.data.prompt ?? '')
        const copyVariant = Number(n.data.copyVariant ?? 0)
        // 教学实例固定为截图中的“碎拍霓虹版 / 日落慢速版”，普通画板仍轮换文案。
        const specSets = WORK_SPEC_SETS[mode]
        const workSpecs = isGuidedExample?WORK_SPEC_SETS.remix[1]:specSets[copyVariant % specSets.length]
        const weirdness = Number(n.data.weirdness ?? 50)
        const styleInfluence = Number(n.data.styleInfluence ?? 50)
        const audioInfluence = Number(n.data.audioInfluence ?? 25)
        const durationMode = String(n.data.durationMode ?? 'auto')
        const influenceLine = `Weirdness ${weirdness}% · Style ${styleInfluence}% · Audio ${audioInfluence}% · Duration ${durationMode === 'auto' ? 'Auto' : 'Custom'}`
        const works: WorkItem[] = workSpecs.map((spec, index) => ({
          id:nid('work'), ...spec, ...(isGuidedExample?GUIDED_WORK_AUDIO[spec.name]:undefined), mode, sources,
          sourceRatios:isGuidedExample && sources.length===2 && 'ratio' in spec
            ? [Number(spec.ratio),100-Number(spec.ratio)]
            : randomSourceRatios(sources.length),
          lyrics: lyricText || undefined,
          usedPrompt:`${mode.toUpperCase()} · ${sources.map(s=>s.name).join(' + ')}${prompt ? `\n${prompt}` : ''}${lyricLine}\n${influenceLine}\nVariation ${index+1}`,
        }))
        return { ...n, data:{ ...n.data, generating:false, works, copyVariant:isGuidedExample?0:copyVariant + 1 } }
      }))
    }, 1700)
  }, [activeBoardId,getConnectedLyrics])

  const handleExtractWork = useCallback((_folderId: string, work: WorkItem, x: number, y: number) => {
    const audio=work.audioUrl?undefined:resolveGuidedAudio(work.name)
    const card: CanvasNode = {
      id:work.id, type:'work', x, y, w:WORK_CARD_W, h:WORK_CARD_H,
      visible:true, selected:true, inputs:[],
      outputs:[{ id:nid('work-out'), label:'Master audio', dataType:'audio', color:work.color, yRel:68 }],
      data:{ ...work, ...(audio??{}), label:work.name, fullTrack:true },
    }
    setNodes(prev => [...prev.map(n => ({ ...n, selected:false })),placeNodeWithoutOverlap(card,prev)])
    setDetailId(work.id)
  }, [])

  const handleExtractSourceFromFolder = useCallback((folderId: string, source: WorkSource, x: number, y: number) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== folderId || n.type !== 'audioFolder') return n
      const sources = (n.data.sources as WorkSource[] | undefined) ?? []
      const nextSources = sources.filter(s => s.id !== source.id)
      const hasLyrics = hasLyricsConnection(folderId,nodesRef.current,wiresRef.current)
      return { ...n, h:audioFolderHeight(nextSources.length, hasLyrics), data: { ...n.data, sources: nextSources } }
    }))
    const originalType = (source as any).originalType as string | undefined
    const originalData = (source as any).originalData as Record<string, unknown> | undefined
    const w = (source as any).w as number | undefined
    const h = (source as any).h as number | undefined
    let restored: CanvasNode | null = null
    const baseId = source.id
    if (originalType && originalData) {
      let ww = w ?? 200, hh = h ?? 100
      let inputs: Port[] = [], outputs: Port[] = []
      if (originalType === 'direction') {
        ww = DEMO_CARD_W; hh = DEMO_CARD_H
        outputs = [{ id: nid('demo-out'), label:'Direction', dataType:'direction', color:String((originalData as any).color ?? '#8A7CFF'), yRel:70 }]
      } else if (originalType === 'work') {
        ww = WORK_CARD_W; hh = WORK_CARD_H
        outputs = [{ id: nid('work-out'), label:'Master audio', dataType:'audio', color:String((originalData as any).color ?? '#A56CFF'), yRel:68 }]
      } else if (originalType === 'audio') {
        ww = 200; hh = (originalData as any).isRef ? 156 : 100
      } else if (originalType === 'image') {
        ww = 200; hh = 176
      } else if (originalType === 'text') {
        ww = 200; hh = 100
      } else if (originalType === 'lyrics') {
        ww = 360; hh = 380
        outputs = [{ id: nid('lyout'), label:'Lyrics', dataType:'text', color:'#E56B8A', yRel:64 }]
      } else if (originalType === 'audioFolder') {
        ww = 540; hh = AUDIO_FOLDER_COMPACT_H
        inputs = [{ id: nid('lyin'), label:'Lyrics', dataType:'text', color:'#E56B8A', yRel:44 }]
        outputs = [{ id: nid('folder-out'), label:'Full tracks', dataType:'audio', color:'#8A7CFF', yRel:64 }]
      }
      restored = {
        id: baseId,
        type: originalType as any,
        x, y, w: ww, h: hh,
        visible: true, selected: true,
        inputs, outputs,
        data: { ...originalData },
      }
    } else {
      restored = {
        id: baseId,
        type: (source.kind === 'demo' ? 'direction' : source.kind === 'work' ? 'work' : source.kind as any) as any,
        x, y, w: source.kind === 'work' ? WORK_CARD_W : source.kind === 'demo' ? DEMO_CARD_W : 200,
        h: source.kind === 'work' ? WORK_CARD_H : source.kind === 'demo' ? DEMO_CARD_H : 100,
        visible: true, selected: true,
        inputs: [], outputs: source.kind === 'work' ? [{ id: nid('work-out'), label:'Master audio', dataType:'audio', color:String(source.color), yRel:68 }] : source.kind === 'demo' ? [{ id: nid('demo-out'), label:'Direction', dataType:'direction', color:String(source.color), yRel:70 }] : [],
        data: { name: source.name, label: source.name, color: source.color, accent: (source as any).accent, mode: (source as any).mode, mood: source.mood, style: source.style, texture: source.texture, rhythm: source.rhythm, fileName: source.fileName, duration: source.duration, audioUrl:source.audioUrl } as Record<string, unknown>,
      }
    }
    if (restored) {
      setNodes(prev => [...prev.map(n => ({ ...n, selected:false })),placeNodeWithoutOverlap(restored!,prev)])
      setDetailId(restored!.id)
    }
  }, [])

  const handleRemoveSourceFromFolder = useCallback((folderId: string, sourceId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== folderId || n.type !== 'audioFolder') return n
      const sources = (n.data.sources as WorkSource[] | undefined) ?? []
      const nextSources = sources.filter(s => s.id !== sourceId)
      const hasLyrics = hasLyricsConnection(folderId,nodesRef.current,wiresRef.current)
      return { ...n, h:audioFolderHeight(nextSources.length, hasLyrics), data: { ...n.data, sources: nextSources } }
    }))
    setDetailId(prev => (prev === sourceId ? null : prev))
  }, [])

  // ── Compare / Parking ──
  const toggleCompare = useCallback((dirId: string) => {
    setCompareIds(prev => prev.includes(dirId) ? prev.filter(x => x !== dirId) : [...prev, dirId].slice(-3))
  }, [])

  const archiveNode = useCallback((id: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, visible: false } : n))
    setCompareIds(prev => prev.filter(x => x !== id))
    setParkingIds(prev => prev.includes(id) ? prev : [...prev, id])
    setDetailId(prev => (prev === id ? null : prev))
  }, [])

  // ── Fuse / Commit（方向卡后续探索保留）──
  function makeFuseNode(a: CanvasNode, b: CanvasNode): CanvasNode {
    const h = 320
    const x = Math.max(a.x, b.x) + 262
    const y = Math.min(a.y, b.y) + 30
    return {
      id: nid('fuse'), type: 'fuse', x, y, w: 226, h, visible: true, selected: false,
      inputs: [
        { id: nid('fina'), label: `From ${a.data.label}`, dataType: 'direction', color: (a.data.color as string) ?? '#F06090', yRel: py(0, 2, h, 44, 16) },
        { id: nid('finb'), label: `From ${b.data.label}`, dataType: 'direction', color: (b.data.color as string) ?? '#F06090', yRel: py(1, 2, h, 44, 16) },
      ],
      outputs: [{ id: nid('fout'), label: 'Hybrid', dataType: 'direction', color: '#F06090', yRel: py(0, 1, h) }],
      data: { label: '__FUSE__', fuseOf: [a.id, b.id],
        inheritsA: [...((a.data.tags as string[]) ?? []), (a.data.texture as string) ?? ''].filter(Boolean),
        inheritsB: [...((b.data.tags as string[]) ?? []), (b.data.texture as string) ?? ''].filter(Boolean) },
    }
  }

  const handleFuseCreate = useCallback((aId: string, bId: string) => {
    const cur = nodesRef.current
    const a = cur.find(n => n.id === aId)
    const b = cur.find(n => n.id === bId)
    if (!a || !b) return
    const fuse = makeFuseNode(a, b)
    const wa: Wire = { id: nid('wf1'), fromNodeId: a.id, fromPortId: a.outputs[0]?.id ?? '', toNodeId: fuse.id, toPortId: fuse.inputs[0].id, color: '#8A8A86', label: '__L_FUSE__' }
    const wb: Wire = { id: nid('wf2'), fromNodeId: b.id, fromPortId: b.outputs[0]?.id ?? '', toNodeId: fuse.id, toPortId: fuse.inputs[1].id, color: '#8A8A86', label: '__L_FUSE__' }
    setWires(ww => [...ww, wa, wb])
    setNodes(prev => [...prev,placeNodeWithoutOverlap(fuse,prev)])
  }, [])

  const handleCommit = useCallback((dirId: string) => {
    const cur = nodesRef.current
    if (cur.some(n => n.type === 'result')) return
    const dir = cur.find(n => n.id === dirId)
    if (!dir) return
    const h = 470
    const res: CanvasNode = {
      id: nid('result'), type: 'result', x: dir.x + 280, y: 80, w: 272, h,
      visible: true, selected: false, inputs: [], outputs: [],
      data: { title: `${dir.data.name}`, coreIdea: '__CORE_IDEA__',
        dna: [String(dir.data.mood ?? ''), String(dir.data.texture ?? ''), String(dir.data.rhythm ?? ''), String(dir.data.style ?? '')],
        constraints: ['保留原始旋律'],
        evolution: `${dir.data.label} · ${dir.data.name}`,
        bpm: (dir.data.usedPrompt as string | undefined) ? 96 : 96,
        key: 'F# Minor', duration: '0:30', status: 'selected', openQ: 0, reflection: '',
        usedPrompt: dir.data.usedPrompt ?? '' },
    }
    setNodes(prev => [...prev,placeNodeWithoutOverlap(res,prev)])
  }, [])

  // ── Sidebar add ──
  const handleAddNode = useCallback((type: string) => {
    const cx = (viewport.width / 2 - viewport.panX) / viewport.zoom
    const cy = (viewport.height / 2 - viewport.panY) / viewport.zoom
    let node: CanvasNode | null = null
    if (type === 'image') {
      node = { id: nid('img'), type: 'image', x: cx - 140, y: cy - 110, w: 200, h: 176, visible: true, selected: false, inputs: [], outputs: [],
        data: { label: '图片素材', imageUrl: CITY_IMG, keywords: ['新图像'], weight: 35 } }
    } else if (type === 'audio-hum') {
      node = { id: nid('audio'), type: 'audio', x: cx - 140, y: cy + 30, w: 200, h: 100, visible: true, selected: false, inputs: [], outputs: [],
        data: { label: '__HUM__', duration: '0:00', isHum: true, weight: 45 } }
    } else if (type === 'audio-ref') {
      node = { id: nid('audio'), type: 'audio', x: cx + 30, y: cy - 110, w: 200, h: 156, visible: true, selected: false, inputs: [], outputs: [],
        data: { label: '__REF__', fileName: '未命名音频.wav', duration: '0:00', isRef: true, weight: 35, analysis: null } }
    } else if (type === 'text') {
      if(activeBoardId===GUIDED_EXAMPLE_ID) {
        if(nodesRef.current.some(item=>item.id===GUIDE_INTENT_ID))return
        node=buildGuidedIntentNode()
      } else {
        node = { id: nid('text'), type: 'text', x: cx + 30, y: cy + 30, w: 200, h: 100, visible: true, selected: false, inputs: [], outputs: [],
          data: { content: '', weight: 30 } }
      }
    } else if (type === 'note') {
      node = { id:nid('note'), type:'note', x:cx-100, y:cy-60, w:200, h:118, visible:true, selected:false, inputs:[], outputs:[],
        data:{ text:'' } }
    } else if (type === 'lyrics') {
      if(activeBoardId===GUIDED_EXAMPLE_ID) {
        if(nodesRef.current.some(item=>item.id===GUIDE_LYRICS_ID))return
        const lyrics=buildGuidedLyricsNode()
        const folder=nodesRef.current.find(item=>item.type==='audioFolder')
        node=folder?{...lyrics,x:folder.x-lyrics.w-40,y:folder.y+20}:lyrics
      } else {
      const defaultSections = [
        { id: nid('sec'), type: 'verse', label: '主歌', content: '' },
        { id: nid('sec'), type: 'chorus', label: '副歌', content: '' },
        { id: nid('sec'), type: 'verse', label: '主歌', content: '' },
        { id: nid('sec'), type: 'chorus', label: '副歌', content: '' },
      ]
      node = { id: nid('lyrics'), type: 'lyrics', x: cx - 180, y: cy - 60, w: 360, h: 380, visible: true, selected: false,
        inputs: [],
        outputs: [{ id: nid('lyout'), label: 'Lyrics', dataType: 'text', color: '#E56B8A', yRel: 64 }],
        data: { title: '未命名歌词', sections: defaultSections } }
      }
    } else if (type === 'audioFolder') {
      node = { id: nid('audio-folder'), type: 'audioFolder', x: cx - 270, y: cy - 80, w: 540, h: AUDIO_FOLDER_COMPACT_H, visible: true, selected: false,
        inputs: [{ id: nid('lyin'), label: 'Lyrics', dataType: 'text', color: '#E56B8A', yRel: 64 }],
        outputs: [{ id: nid('folder-out'), label: 'Full tracks', dataType: 'audio', color: '#8A7CFF', yRel: 64 }],
        data: { name: '音频创作夹', sources: [], mode: 'remix', prompt: '', generating: false, works: [] } }
    } else if (type === 'fuse') {
      node = { id: nid('fuse'), type: 'fuse', x: 900, y: 200, w: 226, h: 320, visible: true, selected: false,
        inputs: [
          { id: nid('fina'), label: 'From A', dataType: 'direction', color: '#F06090', yRel: py(0, 2, 320, 44, 16) },
          { id: nid('finb'), label: 'From B', dataType: 'direction', color: '#F06090', yRel: py(1, 2, 320, 44, 16) },
        ],
        outputs: [{ id: nid('fout'), label: 'Hybrid', dataType: 'direction', color: '#F06090', yRel: py(0, 1, 320) }],
        data: { label: '__FUSE__', inheritsA: [], inheritsB: [] } }
    }
    if (node) setNodes(prev => [...prev,placeNodeWithoutOverlap(node!,prev,{avoidFrames:true})])
  }, [activeBoardId,viewport])

  // 自动边缘锚点只负责保存连线位置，不作为可见端口呈现。
  const handleAddPort = useCallback((nodeId: string, isInput: boolean, yRelAtMouse: number, colorHint?: string) => {
    const newPortId = `${nodeId}-${isInput?'in':'out'}-auto-edge-${Date.now().toString(36)}`
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node
      const sidePorts = isInput ? [...node.inputs] : [...node.outputs]
      const color = colorHint ?? (sidePorts[0]?.color ?? '#8A8A86')
      const dataType = sidePorts[0]?.dataType ?? 'any'
      const yRel = Math.max(42, Math.min(node.h - 18, yRelAtMouse))
      const newPort: Port = {
        id:newPortId,
        label:isInput ? 'Auto input anchor' : 'Auto output anchor',
        dataType:dataType as Port['dataType'],
        color,
        yRel,
      }
      return isInput
        ? { ...node, inputs:[...sidePorts,newPort] }
        : { ...node, outputs:[...sidePorts,newPort] }
    }))
    return newPortId
  }, [])

  const handleRemovePort = useCallback((nodeId:string, portId:string) => {
    if (!isAutoAnchorId(portId)) return
    setNodes(prev => prev.map(node => node.id !== nodeId ? node : {
      ...node,
      inputs:node.inputs.filter(port => port.id !== portId),
      outputs:node.outputs.filter(port => port.id !== portId),
    }))
  }, [])

  const handleGuideFocus = useCallback((nodeId:string,selector?:string) => {
    setFocusRequest({nodeId,selector,token:Date.now()})
  },[])

  const handleGuideReset = useCallback(() => {
    const fresh=buildGuidedExampleBoard()
    releaseAssetUrls(nodesRef.current)
    setNodes(fresh.nodes)
    setWires(fresh.wires)
    setBoards(previous=>{
      const existing=previous.find(board=>board.id===GUIDED_EXAMPLE_ID)
      return upsertBoard(previous,{...fresh,thumbnail:existing?.thumbnail,thumbnailAspect:existing?.thumbnailAspect})
    })
    setDetailId(null)
    setInspectedNode(null)
    setCompareIds([])
    setShowCompare(false)
    setFocusRequest({nodeId:GUIDE_IMAGE_ID,token:Date.now()})
  },[])

  const handleCopyGuidedBoard = useCallback(() => {
    const id=`board-${Date.now().toString(36)}`
    const name=lang==='zh'?'孤独霓虹 · 我的版本':'Lonely Neon · My Version'
    const board:GalleryBoard={id,name,nodes:nodesRef.current.map(node=>({...node,selected:false})),wires:[...wiresRef.current],updatedAt:Date.now(),kind:'user'}
    setBoards(previous=>[board,...upsertBoard(previous,currentBoardSnapshot())])
    setActiveBoardId(id)
    setActiveProjectName(name)
    setDetailId(null)
    setProjectSaveState('idle')
  },[currentBoardSnapshot,lang])

  const handleGuidePrepareStep = useCallback((step:number) => {
    const ensureLyricsConnection=(targetId:string)=>{
      const outputId='guide-lyrics-out'
      const inputId=targetId===GUIDE_FRAME_ID?'guide-frame-lyrics-in':`guide-folder-lyrics-in-${targetId}`
      setNodes(previous=>{
        const withLyrics=previous.some(node=>node.id===GUIDE_LYRICS_ID)?previous:[...previous,buildGuidedLyricsNode()]
        return withLyrics.map(node=>{
          if(node.id===GUIDE_LYRICS_ID && !node.outputs.some(port=>port.id===outputId))return {...node,outputs:[...node.outputs,{id:outputId,label:'Lyrics',dataType:'text',color:'#E56B8A',yRel:64}]}
          if(node.id===targetId && !node.inputs.some(port=>port.id===inputId))return {...node,inputs:[...node.inputs,{id:inputId,label:'Lyrics',dataType:'text',color:'#E56B8A',yRel:64}]}
          return node
        })
      })
      setWires(previous=>previous.some(wire=>(wire.fromNodeId===GUIDE_LYRICS_ID&&wire.toNodeId===targetId)||(wire.fromNodeId===targetId&&wire.toNodeId===GUIDE_LYRICS_ID))?previous:[...previous,{id:`guide-lyrics-wire-${targetId}`,fromNodeId:GUIDE_LYRICS_ID,fromPortId:outputId,toNodeId:targetId,toPortId:inputId,color:'#E56B8A',label:'Lyrics'}])
    }
    if(step===2) {
      setNodes(previous=>{
        const withIntent=previous.some(node=>node.id===GUIDE_INTENT_ID)?previous:[...previous.map(node=>({...node,selected:false})),buildGuidedIntentNode()]
        return withIntent.map(node=>node.id===GUIDE_INTENT_ID?{...node,x:555,y:455}:node)
      })
      return
    }
    if(step===3) {
      setNodes(previous=>previous.map(node=>node.id===GUIDE_IMAGE_ID?{...node,x:790,y:390}:node))
      return
    }
    if(step===4) {
      setNodes(previous=>previous.map(node=>node.id===GUIDE_INTENT_ID?{...node,data:{...node.data,weight:60}}:node))
      return
    }
    if(step===5) {
      const frame=nodesRef.current.find(node=>node.id===GUIDE_FRAME_ID)
      if(!((frame?.data.demos as unknown[]|undefined)?.length)) handleDivergeFrame(GUIDE_FRAME_ID)
      return
    }
    if(step===6) {
      const extract=()=>{
        const frame=nodesRef.current.find(node=>node.id===GUIDE_FRAME_ID)
        const demo=((frame?.data.demos as DemoItem[]|undefined)??[])[0]
        if(!demo)return
        handleExtractDemo(GUIDE_FRAME_ID,demo,1370,545)
        updateNodeData(GUIDE_FRAME_ID,{demos:((frame?.data.demos as DemoItem[]|undefined)??[]).filter(item=>item.id!==demo.id)})
      }
      const frame=nodesRef.current.find(node=>node.id===GUIDE_FRAME_ID)
      if(((frame?.data.demos as unknown[]|undefined)?.length??0)>0) extract()
      else {handleDivergeFrame(GUIDE_FRAME_ID);window.setTimeout(extract,1650)}
      return
    }
    if(step===7) {
      const demo=nodesRef.current.find(node=>node.type==='direction'&&node.data.demo)
      if(demo)handleCanvasOpenDetail(demo.id)
      return
    }
    if(step===8) {
      const create=()=>{
        const demo=nodesRef.current.find(node=>node.type==='direction'&&node.data.demo)
        const reference=nodesRef.current.find(node=>node.id===GUIDE_REF_ID)
        if(demo&&reference) handleCreateAudioFolder(demo.id,reference.id)
      }
      create()
      window.setTimeout(create,1750)
      const configure=()=>{
        const folder=nodesRef.current.find(node=>node.type==='audioFolder')
        if(!folder)return
        updateNodeData(folder.id,{mode:'remix',weirdness:61,styleInfluence:41,prompt:'更强的夜间驾驶感，主体段落加入更宽阔的空间层次。'})
      }
      window.setTimeout(configure,180)
      window.setTimeout(configure,1950)
      return
    }
    if(step===9) {
      setNodes(previous=>{
        if(previous.some(node=>node.id===GUIDE_LYRICS_ID))return previous
        const lyrics=buildGuidedLyricsNode()
        const folder=previous.find(node=>node.type==='audioFolder')
        const positioned=folder?{...lyrics,x:folder.x-lyrics.w-40,y:folder.y+20}:lyrics
        return [...previous.map(node=>({...node,selected:false})),placeNodeWithoutOverlap(positioned,previous,{avoidFrames:true})]
      })
      return
    }
    if(step===10) {
      const connect=()=>{
        const folder=nodesRef.current.find(node=>node.type==='audioFolder')
        if(folder)ensureLyricsConnection(folder.id)
      }
      connect()
      window.setTimeout(connect,520)
      return
    }
    if(step===11) {
      const folder=nodesRef.current.find(node=>node.type==='audioFolder')
      if(!folder)return
      updateNodeData(folder.id,{mode:'remix',weirdness:61,styleInfluence:41,prompt:'更强的夜间驾驶感，主体段落加入更宽阔的空间层次。'})
      window.setTimeout(()=>handleGenerateAudioFolder(folder.id),80)
      return
    }
    if(step===12) {
      const folder=nodesRef.current.find(node=>node.type==='audioFolder')
      const existing=nodesRef.current.find(node=>node.type==='work')
      if(!folder || existing)return
      const work=((folder.data.works as WorkItem[]|undefined)??[])[0]
      if(!work)return
      handleExtractWork(folder.id,work,folder.x+folder.w+56,folder.y+24)
      updateNodeData(folder.id,{works:((folder.data.works as WorkItem[]|undefined)??[]).filter(item=>item.id!==work.id)})
    }
  },[handleCanvasOpenDetail,handleCreateAudioFolder,handleDivergeFrame,handleExtractDemo,handleExtractWork,handleGenerateAudioFolder,updateNodeData])

  const compareDirs = compareIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as CanvasNode[]
  // 右侧常驻详情栏：仅画布点击 Demo/Work 才显示详情，机架点击仅选中
  const detailNode = detailId ? nodes.find(n => n.id === detailId) ?? null : null

  useEffect(() => {
    if (detailId && !nodes.some(n => n.id === detailId && n.visible)) {
      setDetailId(null)
    }
  }, [nodes, detailId])

  return (
    <LangCtx.Provider value={lang}>
      <div style={{ height:'100vh', overflow:'hidden', position:'relative', background:'#0D0D0C', fontFamily:"'Inter',sans-serif", color:'#F0F0EE' }}>
        <div className={`workspace-editor ${galleryMounted&&!galleryClosing?'workspace-editor--receded':''}`}
          style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <TopToolbar
          lang={lang}
          onToggleLang={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
          onSearch={() => setCmdkOpen(true)}
          projectName={localizeBuiltinText(activeProjectName,lang)}
          onOpenGallery={handleOpenGallery}
          onSaveProject={handleSaveProject}
          onRestoreProject={handleRestoreProject}
          canRestoreProject={lastManualSavedAt !== null}
          lastSavedAt={lastManualSavedAt}
          projectSaveState={projectSaveState}
          testMode={testMode}
          onTestModeChange={setTestMode}
          exportCounts={getProjectExportCounts(nodes)}
          onProjectExport={kind=>runProjectExport(kind,localizeBuiltinText(activeProjectName,lang),nodesRef.current,wiresRef.current,lang)}
        />
        <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0, position:'relative' }}>
          <Canvas
            nodes={nodes}
            wires={wires}
            compareIds={compareIds}
            onSelectNode={handleCanvasSelect}
            onSelectMany={handleCanvasSelectMany}
            onOpenInspector={openInspector}
            onUpdatePosition={updateNodePosition}
            onUpdateNodeData={updateNodeData}
            onAddWire={addWire}
            onRemoveWire={removeWire}
            onAddPort={handleAddPort}
            onRemovePort={handleRemovePort}
            onCommit={handleCommit}
            onCompareToggle={toggleCompare}
            onDivergeFrame={handleDivergeFrame}
            onExtractDemo={handleExtractDemo}
            onCreateAudioFolder={handleCreateAudioFolder}
            onGenerateAudioFolder={handleGenerateAudioFolder}
            onExtractWork={handleExtractWork}
            onExtractSource={handleExtractSourceFromFolder}
            onRemoveSource={handleRemoveSourceFromFolder}
            onOpenDemoDetail={handleCanvasOpenDetail}
            onAddFrame={handleAddFrame}
            onExport={() => {}}
            onAddNode={handleAddNode}
            onViewportChange={handleViewportChange}
            onUpdateNodeSize={updateNodeSize}
            onImportFiles={(files,x,y)=>handleImportFiles(files,'auto',{x,y})}
            onDeleteSelected={deleteSelected}
            onUpdateGroupPositions={updateGroupPositions}
            focusRequest={focusRequest}
          />
          <LeftSidebar onAddNode={handleAddNode} onAddFrame={handleAddFrame} onImportFiles={handleImportFiles} lang={lang} testMode={testMode}/>
          <DetailPanel lang={lang} node={detailNode} nodes={nodes} onClose={handleCloseDetail} onSelectNode={handleRackSelect} />
          {storageReady && activeBoardId!==GUIDED_EXAMPLE_ID && !galleryMounted && (
            <div data-prototype-disclaimer="true" role="note" aria-label={lang==='zh'?'原型功能说明':'Prototype notice'} style={{
              position:'absolute',right:312,bottom:10,zIndex:26,pointerEvents:'none',
              color:'rgba(198,198,193,0.42)',fontSize:9.5,fontWeight:500,lineHeight:1.4,
              letterSpacing:'0.01em',whiteSpace:'nowrap',textAlign:'right',userSelect:'none',
              textShadow:'0 1px 3px rgba(0,0,0,0.72)',
            }}>
              {lang==='zh'?'该作品仅作为UI/UX演示原型，并未接入AI模型，功能仍在开发中':'This work is a UI/UX demonstration prototype only. No AI model is connected, and features are still in development.'}
            </div>
          )}
        </div>
        </div>

        {storageReady && activeBoardId===GUIDED_EXAMPLE_ID && !galleryMounted && (
          <GuidedTour lang={lang} nodes={nodes} wires={wires} onFocusNode={handleGuideFocus}
            onPrepareStep={handleGuidePrepareStep} onReset={handleGuideReset} onCopy={handleCopyGuidedBoard}/>
        )}

        {galleryMounted && (
          <ProjectGallery lang={lang}
            boards={boards}
            activeBoardId={activeBoardId} closing={galleryClosing} testMode={testMode}
            onClose={handleCloseGallery} onToggleLang={()=>setLang(value=>value==='zh'?'en':'zh')} onTestModeChange={setTestMode}
            onOpenBoard={handleOpenBoard} onCreateBoard={handleCreateBoard} onDeleteBoard={handleDeleteBoard}/>
        )}

        {galleryMounted && tutorialPromptOpen && !galleryClosing && (
          <div style={{position:'fixed',inset:0,zIndex:300,display:'grid',placeItems:'center',background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)',padding:'24px'}} onClick={handleTutorialStay} role="dialog" aria-modal="true" aria-label={s.tutorialPromptTitle}>
            <div style={{width:'min(420px,90vw)',background:'#1A1A19',border:'1px solid #2C2C2A',borderRadius:16,padding:'24px',boxShadow:'0 24px 64px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column',gap:16}} onClick={event=>event.stopPropagation()}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',color:'#6B6EF5',textTransform:'uppercase'}}>Museflow</div>
                  <h2 style={{margin:'6px 0 0',fontSize:20,fontWeight:800,letterSpacing:'-0.03em',color:'#F0F0EE',lineHeight:1.2}}>{s.tutorialPromptTitle}</h2>
                </div>
                <button onClick={handleTutorialStay} aria-label="Close" style={{width:28,height:28,display:'grid',placeItems:'center',background:'transparent',border:'1px solid #2C2C2A',borderRadius:8,color:'#8A8A86',cursor:'pointer',flexShrink:0}}>×</button>
              </div>
              <p style={{margin:0,color:'#9A9A96',fontSize:12.5,lineHeight:1.7}}>{s.tutorialPromptDesc}</p>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
                <button onClick={handleTutorialNeed} style={{height:42,borderRadius:10,border:'none',background:'linear-gradient(135deg,#6B6EF5,#8A7CFF)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 8px 24px rgba(107,110,245,0.35)'}}>{s.tutorialNeed} →</button>
                <button onClick={handleTutorialBlank} style={{height:42,borderRadius:10,border:'1px solid #2C2C2A',background:'#252523',color:'#C9C9C5',fontSize:13,fontWeight:600,cursor:'pointer'}}>{s.tutorialNoNeed}</button>
                <button onClick={handleTutorialStay} style={{height:36,borderRadius:10,border:'none',background:'transparent',color:'#6A6A66',fontSize:12,cursor:'pointer'}}>{s.tutorialStay}</button>
              </div>
            </div>
          </div>
        )}

        {compareIds.length >= 2 && !showCompare && (
          <button onClick={() => setShowCompare(true)} className="bar-appear"
            style={{ position:'fixed', bottom:64, left:'50%', zIndex:60,
              display:'flex', alignItems:'center', gap:8,
              padding:'9px 16px', borderRadius:24, border:'1px solid #6B6EF550',
              background:'linear-gradient(135deg,#26264A,#1C1C34)',
              color:'#B8BAFF', fontSize:12, fontWeight:700, cursor:'pointer',
              boxShadow:'0 12px 32px rgba(0,0,0,0.55)', fontFamily:"'Inter',sans-serif" }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#6B6EF5', boxShadow:'0 0 6px #6B6EF5' }}/>
            {s.comparePill} · {compareIds.length}
            <span style={{ color:'#6B6EF5' }}>→</span>
          </button>
        )}

        {showCompare && compareDirs.length >= 2 && (
          <CompareOverlay
            lang={lang} dirs={compareDirs}
            onClose={() => { setShowCompare(false); setCompareIds([]) }}
            onKeep={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, kept: true } } : n))}
            onArchive={archiveNode}
            onFuse={handleFuseCreate}
          />
        )}

        {cmdkOpen && (
          <CommandBar
            lang={lang}
            nodes={nodes}
            onSelect={nodeId => {
              handleCanvasSelect(nodeId)
              setFocusRequest({nodeId,token:Date.now()})
            }}
            onClose={() => setCmdkOpen(false)}
          />
        )}

        {inspectedNode && (
          <Inspector node={inspectedNode} onClose={() => setInspectedNode(null)} />
        )}
      </div>
    </LangCtx.Provider>
  )
}
