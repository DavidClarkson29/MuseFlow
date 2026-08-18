import { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react'
import type { CanvasNode, Wire } from './types'
import type { Lang } from './i18n'
import { strings } from './i18n'
import TopToolbar from './components/TopToolbar'
import LeftSidebar from './components/LeftSidebar'
import Canvas from './components/Canvas'
import Inspector from './components/Inspector'
import ExportPanel from './components/ExportPanel'

export const LangCtx = createContext<Lang>('zh')
export const useLang = () => strings[useContext(LangCtx)]

const CITY_IMG = 'https://images.unsplash.com/photo-1541702467897-41915a07d3a7?w=400&h=280&fit=crop&auto=format'

function py(i: number, total: number, h: number, top = 36, bot = 10): number {
  const body = h - top - bot
  if (total === 1) return top + body / 2
  return top + (body / (total - 1)) * i
}

// ── New node factory (for sidebar "add" clicks) ────────────────────────────

let _nodeCounter = 0
function makeNode(type: CanvasNode['type'], cx: number, cy: number): CanvasNode {
  const id  = `${type}-${++_nodeCounter}-${Date.now().toString(36)}`
  const tag = (t: string) => `${id}-${t}`

  switch (type) {
    case 'image':
      return { id, type, x: cx-98, y: cy-86, w:196, h:172, visible:true, selected:false, inputs:[],
        outputs:[{id:tag('v'), label:'Visual', dataType:'visual', color:'#3BBDAF', yRel:py(0,1,172)}],
        data:{ label:'图片素材', imageUrl:CITY_IMG } }
    case 'audio':
      return { id, type, x: cx-98, y: cy-48, w:196, h:96, visible:true, selected:false, inputs:[],
        outputs:[{id:tag('a'), label:'Audio', dataType:'audio', color:'#F5A523', yRel:py(0,1,96)}],
        data:{ label:'音频片段', duration:'0:00', isHum:true } }
    case 'text':
      return { id, type, x: cx-98, y: cy-48, w:196, h:96, visible:true, selected:false, inputs:[],
        outputs:[{id:tag('t'), label:'Text', dataType:'text', color:'#6B6EF5', yRel:py(0,1,96)}],
        data:{ content:'在此输入创意想法或歌词…' } }
    case 'mood':
      return { id, type, x: cx-98, y: cy-36, w:196, h:72, visible:true, selected:false, inputs:[],
        outputs:[{id:tag('m'), label:'Mood', dataType:'mood', color:'#9B7EFF', yRel:py(0,1,72)}],
        data:{ tags:['Nostalgic','Urban'] } }
    case 'explore': {
      const w=280, h=640
      return { id, type, x:cx-140, y:cy-260, w, h, visible:true, selected:false, state:'ready',
        inputs:[
          {id:tag('iv'),  label:'Visual',    dataType:'visual',    color:'#3BBDAF', yRel:py(0,5,h,44,20)},
          {id:tag('ia1'), label:'Audio',     dataType:'audio',     color:'#F5A523', yRel:py(1,5,h,44,20)},
          {id:tag('ia2'), label:'Reference', dataType:'audio',     color:'#F5A523', yRel:py(2,5,h,44,20)},
          {id:tag('it'),  label:'Text',      dataType:'text',      color:'#6B6EF5', yRel:py(3,5,h,44,20)},
          {id:tag('im'),  label:'Mood',      dataType:'mood',      color:'#9B7EFF', yRel:py(4,5,h,44,20)},
        ],
        outputs:[
          {id:tag('oa'), label:'Direction A', dataType:'direction', color:'#F5A523', yRel:py(0,3,h,44,20)},
          {id:tag('ob'), label:'Direction B', dataType:'direction', color:'#7A7A78', yRel:py(1,3,h,44,20)},
          {id:tag('oc'), label:'Direction C', dataType:'direction', color:'#9B7EFF', yRel:py(2,3,h,44,20)},
        ],
        data:{label:'AI 探索', mode:'create'} }
    }
    case 'fuse': {
      const h=164
      return { id, type, x:cx-98, y:cy-82, w:196, h, visible:true, selected:false,
        inputs:[
          {id:tag('ia'), label:'Direction A', dataType:'direction', color:'#F06090', yRel:py(0,2,h,44,16)},
          {id:tag('ib'), label:'Direction B', dataType:'direction', color:'#F06090', yRel:py(1,2,h,44,16)},
        ],
        outputs:[{id:tag('o'), label:'Hybrid', dataType:'direction', color:'#F06090', yRel:py(0,1,h)}],
        data:{label:'融合'} }
    }
    case 'brief': {
      const h=200
      return { id, type, x:cx-106, y:cy-100, w:212, h, visible:true, selected:false,
        inputs:[{id:tag('i'), label:'Direction', dataType:'direction', color:'#3BBDAF', yRel:py(0,1,h,44,16)}],
        outputs:[{id:tag('o'), label:'Brief', dataType:'direction', color:'#3BBDAF', yRel:py(0,1,h,44,16)}],
        data:{label:'创意摘要'} }
    }
    case 'result': {
      const h=380
      return { id, type, x:cx-126, y:cy-190, w:252, h, visible:true, selected:false,
        inputs:[{id:tag('i'), label:'Brief', dataType:'direction', color:'#3BBDAF', yRel:py(0,1,h,44,20)}],
        outputs:[],
        data:{label:'成品音频', title:'夜晚驾驶 Remix', bpm:96, key:'F# Minor', duration:'3:24'} }
    }
    default:
      return { id, type:'text', x:cx-98, y:cy-48, w:196, h:96, visible:true, selected:false,
        inputs:[], outputs:[], data:{} }
  }
}

// ── Initial full-pipeline layout ───────────────────────────────────────────

function buildInitialNodes(): CanvasNode[] {
  const expW=280, expH=640, dirH=220, dirW=212, fuseH=164, briefH=200, resH=380, resW=252

  return [
    // Sources
    { id:'img-city',  type:'image', x:40, y:50,  w:196, h:172, visible:true,  selected:false, inputs:[],
      outputs:[{id:'visual', label:'Visual', dataType:'visual', color:'#3BBDAF', yRel:py(0,1,172)}],
      data:{ label:'夜晚城市', imageUrl:CITY_IMG } },

    { id:'audio-hum', type:'audio', x:40, y:242, w:196, h:96,  visible:true,  selected:false, inputs:[],
      outputs:[{id:'audio', label:'Audio', dataType:'audio', color:'#F5A523', yRel:py(0,1,96)}],
      data:{ label:'哼唱片段', duration:'0:08', isHum:true } },

    { id:'audio-ref', type:'audio', x:40, y:358, w:196, h:96,  visible:true,  selected:false, inputs:[],
      outputs:[{id:'audio', label:'Reference', dataType:'audio', color:'#F5A523', yRel:py(0,1,96)}],
      data:{ label:'参考音频', duration:'3:42', isRef:true } },

    { id:'text-1',    type:'text',  x:40, y:474, w:196, h:96,  visible:true,  selected:false, inputs:[],
      outputs:[{id:'text', label:'Text Intent', dataType:'text', color:'#6B6EF5', yRel:py(0,1,96)}],
      data:{ content:'黄昏结束后的夜晚，不要太悲伤' } },

    { id:'mood-1',    type:'mood',  x:40, y:590, w:196, h:72,  visible:true,  selected:false, inputs:[],
      outputs:[{id:'mood', label:'Mood', dataType:'mood', color:'#9B7EFF', yRel:py(0,1,72)}],
      data:{ tags:['Nostalgic','Bittersweet','Urban'] } },

    // AI Explore — done state so full pipeline shows
    { id:'explore', type:'explore', x:308, y:60, w:expW, h:expH, visible:true, selected:false, state:'done',
      inputs:[
        {id:'in-visual',  label:'Visual',    dataType:'visual', color:'#3BBDAF', yRel:py(0,5,expH,44,20)},
        {id:'in-audio-1', label:'Audio',     dataType:'audio',  color:'#F5A523', yRel:py(1,5,expH,44,20)},
        {id:'in-audio-2', label:'Reference', dataType:'audio',  color:'#F5A523', yRel:py(2,5,expH,44,20)},
        {id:'in-text',    label:'Text',      dataType:'text',   color:'#6B6EF5', yRel:py(3,5,expH,44,20)},
        {id:'in-mood',    label:'Mood',      dataType:'mood',   color:'#9B7EFF', yRel:py(4,5,expH,44,20)},
      ],
      outputs:[
        {id:'out-dir-a', label:'Direction A', dataType:'direction', color:'#F5A523', yRel:py(0,3,expH,44,20)},
        {id:'out-dir-b', label:'Direction B', dataType:'direction', color:'#7A7A78', yRel:py(1,3,expH,44,20)},
        {id:'out-dir-c', label:'Direction C', dataType:'direction', color:'#9B7EFF', yRel:py(2,3,expH,44,20)},
      ],
      data:{ label:'AI 探索', mode:'create' } },

    // Directions — all visible
    { id:'dir-a', type:'direction', x:662, y:40,  w:dirW, h:dirH, visible:true, selected:false,
      inputs:[{id:'in', label:'From AI', dataType:'direction', color:'#F5A523', yRel:py(0,1,dirH)}],
      outputs:[
        {id:'out-keep',   label:'Use',    dataType:'direction', color:'#F5A523', yRel:py(0,2,dirH,44,20)},
        {id:'out-branch', label:'Branch', dataType:'direction', color:'#F5A523', yRel:py(1,2,dirH,44,20)},
      ],
      data:{ label:'A', name:'暖调都市流行', energy:55, mood:'Nostalgic / Bittersweet', style:'City Pop', texture:'Warm', rhythm:'Relaxed', instrumentation:'Electric Piano / Bass / Clean Guitar', color:'#F5A523', tags:['Groove','Warm texture','Guitar'],
        lyrics:'夜幕降临，街灯次第亮\n我独自穿行在熟悉的街巷\n风中带着你留下的香气\n让我想起那些好时光\n\n[副歌]\n回不去的昨天，忘不了的脸\n在这城市的夜里慢慢沉淀\n你的笑容是夜色里的光\n照亮我独行的方向' } },

    { id:'dir-b', type:'direction', x:662, y:290, w:dirW, h:dirH, visible:true, selected:false,
      inputs:[{id:'in', label:'From AI', dataType:'direction', color:'#7A7A78', yRel:py(0,1,dirH)}],
      outputs:[
        {id:'out-keep',   label:'Use',    dataType:'direction', color:'#7A7A78', yRel:py(0,2,dirH,44,20)},
        {id:'out-branch', label:'Branch', dataType:'direction', color:'#7A7A78', yRel:py(1,2,dirH,44,20)},
      ],
      data:{ label:'B', name:'暗色电影', energy:72, mood:'Melancholic / Intense', style:'Cinematic', texture:'Dark', rhythm:'Driving', instrumentation:'Strings / Piano / Low Synth', color:'#7A7A78', tags:['Space','Harmony','Dark atmosphere'],
        lyrics:'霓虹在雨中模糊成片\n玻璃上折射的光与影\n每一步都像穿越回忆\n找不到你离开的出口\n\n[副歌]\n黑暗里我还在原地等\n等一个不会来的黎明\n记忆像碎片在空气中漂\n拼不回你的轮廓' } },

    { id:'dir-c', type:'direction', x:662, y:540, w:dirW, h:dirH, visible:true, selected:false,
      inputs:[{id:'in', label:'From AI', dataType:'direction', color:'#9B7EFF', yRel:py(0,1,dirH)}],
      outputs:[
        {id:'out-keep',   label:'Use',    dataType:'direction', color:'#9B7EFF', yRel:py(0,2,dirH,44,20)},
        {id:'out-branch', label:'Branch', dataType:'direction', color:'#9B7EFF', yRel:py(1,2,dirH,44,20)},
      ],
      data:{ label:'C', name:'梦幻电子', energy:44, mood:'Ethereal / Floating', style:'Electronic / Ambient', texture:'Airy', rhythm:'Sparse', instrumentation:'Ambient Synth / Pad / Glitch', color:'#9B7EFF', tags:['Texture','Atmosphere','Space'],
        lyrics:'（纯音乐 / Instrumental）\n\n无歌词——以环境音效、\n电子合成器及空间混响为主要表达方式' } },

    // Fuse — connects dir-a + dir-b
    { id:'fuse', type:'fuse', x:954, y:168, w:196, h:fuseH, visible:true, selected:false,
      inputs:[
        {id:'in-a', label:'Direction A', dataType:'direction', color:'#F06090', yRel:py(0,2,fuseH,44,16)},
        {id:'in-b', label:'Direction B', dataType:'direction', color:'#F06090', yRel:py(1,2,fuseH,44,16)},
      ],
      outputs:[{id:'out', label:'Hybrid', dataType:'direction', color:'#F06090', yRel:py(0,1,fuseH)}],
      data:{ label:'融合' } },

    // Brief — connected to fuse output
    { id:'brief', type:'brief', x:954, y:378, w:212, h:briefH, visible:true, selected:false,
      inputs:[{id:'in', label:'Direction', dataType:'direction', color:'#3BBDAF', yRel:py(0,1,briefH,44,16)}],
      outputs:[{id:'out', label:'Brief', dataType:'direction', color:'#3BBDAF', yRel:py(0,1,briefH,44,16)}],
      data:{ label:'创意摘要' } },

    // Result audio — the "eye-catching" output card
    { id:'result', type:'result', x:1240, y:60, w:resW, h:resH, visible:true, selected:false,
      inputs:[{id:'in', label:'Brief', dataType:'direction', color:'#3BBDAF', yRel:py(0,1,resH,44,20)}],
      outputs:[],
      data:{ label:'成品音频', title:'夜晚驾驶 Remix', bpm:96, key:'F# Minor', duration:'3:24',
        lyrics:'夜幕降临，街灯次第亮\n我独自穿行在这城市的夜里\n霓虹在雨中模糊的边界\n让时光慢慢，慢慢沉淀\n\n[副歌]\n回不去的昨天，忘不了的脸\n黑暗里还有你留下的微光\n你的笑容是夜色里的光\n照亮我独行的方向' } },
  ]
}

const INITIAL_WIRES: Wire[] = [
  // Sources → Explore
  {id:'w1', fromNodeId:'img-city',  fromPortId:'visual', toNodeId:'explore', toPortId:'in-visual',  color:'#3BBDAF'},
  {id:'w2', fromNodeId:'audio-hum', fromPortId:'audio',  toNodeId:'explore', toPortId:'in-audio-1', color:'#F5A523'},
  {id:'w3', fromNodeId:'audio-ref', fromPortId:'audio',  toNodeId:'explore', toPortId:'in-audio-2', color:'#F5A523'},
  {id:'w4', fromNodeId:'text-1',    fromPortId:'text',   toNodeId:'explore', toPortId:'in-text',    color:'#6B6EF5'},
  {id:'w5', fromNodeId:'mood-1',    fromPortId:'mood',   toNodeId:'explore', toPortId:'in-mood',    color:'#9B7EFF'},
  // Explore → Directions
  {id:'wA', fromNodeId:'explore', fromPortId:'out-dir-a', toNodeId:'dir-a', toPortId:'in', color:'#F5A523'},
  {id:'wB', fromNodeId:'explore', fromPortId:'out-dir-b', toNodeId:'dir-b', toPortId:'in', color:'#7A7A78'},
  {id:'wC', fromNodeId:'explore', fromPortId:'out-dir-c', toNodeId:'dir-c', toPortId:'in', color:'#9B7EFF'},
  // Directions → Fuse
  {id:'wF1', fromNodeId:'dir-a', fromPortId:'out-keep', toNodeId:'fuse', toPortId:'in-a', color:'#F5A523'},
  {id:'wF2', fromNodeId:'dir-b', fromPortId:'out-keep', toNodeId:'fuse', toPortId:'in-b', color:'#7A7A78'},
  // Fuse → Brief
  {id:'wG', fromNodeId:'fuse',  fromPortId:'out', toNodeId:'brief',  toPortId:'in', color:'#F06090'},
  // Brief → Result
  {id:'wR', fromNodeId:'brief', fromPortId:'out', toNodeId:'result', toPortId:'in', color:'#3BBDAF'},
]

export default function App() {
  const [lang, setLang]             = useState<Lang>('zh')
  const [nodes, setNodes]           = useState<CanvasNode[]>(buildInitialNodes)
  const [wires, setWires]           = useState<Wire[]>(INITIAL_WIRES)
  const [inspectedNode, setInspectedNode] = useState<CanvasNode | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const dropCounterRef = useRef(0)

  const selectNode = useCallback((id: string | null) => {
    setNodes(prev => prev.map(n => ({ ...n, selected: n.id === id })))
  }, [])

  const openInspector = useCallback((id: string) => {
    setNodes(prev => {
      const n = prev.find(x => x.id === id) ?? null
      setInspectedNode(n)
      return prev
    })
  }, [])

  const updateNodePosition = useCallback((id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n))
  }, [])

  const addWire = useCallback((wire: Wire) => {
    setWires(prev => {
      const filtered = prev.filter(w => !(w.toNodeId === wire.toNodeId && w.toPortId === wire.toPortId))
      return [...filtered, wire]
    })
  }, [])

  const removeWire = useCallback((wireId: string) => {
    setWires(prev => prev.filter(w => w.id !== wireId))
  }, [])

  const deleteSelected = useCallback(() => {
    setNodes(prev => {
      const selIds = new Set(prev.filter(n => n.selected).map(n => n.id))
      if (selIds.size === 0) return prev
      setWires(ww => ww.filter(w => !selIds.has(w.fromNodeId) && !selIds.has(w.toNodeId)))
      setInspectedNode(inn => (inn && selIds.has(inn.id) ? null : inn))
      return prev.filter(n => !selIds.has(n.id))
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      deleteSelected()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [deleteSelected])

  const handleGenerate = useCallback((nodeId: string) => {
    if (isGenerating) return
    setIsGenerating(true)
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, state: 'running' } : n))
    setTimeout(() => {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, state: 'done' } : n))
      setIsGenerating(false)
    }, 2600)
  }, [isGenerating])

  // Factory: create a new node at canvas center-ish position with some offset
  const handleAddNode = useCallback((type: string) => {
    const count = ++dropCounterRef.current
    const cx = 460 + (count % 4) * 30
    const cy = 240 + (count % 6) * 25
    if (type === 'audio-hum') {
      const base = makeNode('audio', cx, cy)
      setNodes(prev => [...prev, { ...base, data: { ...base.data, label:'哼唱片段', isHum:true, isRef:false } }])
    } else if (type === 'audio-ref') {
      const base = makeNode('audio', cx, cy)
      setNodes(prev => [...prev, { ...base, data: { ...base.data, label:'参考音频', isRef:true, isHum:false } }])
    } else {
      setNodes(prev => [...prev, makeNode(type as CanvasNode['type'], cx, cy)])
    }
  }, [])

  const s = strings[lang]

  return (
    <LangCtx.Provider value={lang}>
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#0D0D0C', fontFamily:"'Inter',sans-serif", color:'#F0F0EE' }}>
        <TopToolbar
          lang={lang}
          onToggleLang={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
          onExport={() => setShowExport(true)}
          projectName={s.projectName}
        />
        <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0, position:'relative' }}>
          <Canvas
            nodes={nodes}
            wires={wires}
            isGenerating={isGenerating}
            onSelectNode={selectNode}
            onOpenInspector={openInspector}
            onUpdatePosition={updateNodePosition}
            onAddWire={addWire}
            onRemoveWire={removeWire}
            onGenerate={handleGenerate}
            onExport={() => setShowExport(true)}
          />
          <LeftSidebar onAddNode={handleAddNode} />
        </div>
        {inspectedNode && !showExport && (
          <Inspector node={inspectedNode} onClose={() => setInspectedNode(null)} />
        )}
        {showExport && (
          <ExportPanel onClose={() => setShowExport(false)} />
        )}
      </div>
    </LangCtx.Provider>
  )
}
