import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { CanvasNode, Wire } from '../../types'
import { useLang } from '../../App'
import type { WorkSource } from './model'
import { TileTypeIcon } from '../TileTypeIcon'
import { MaterialMiniature } from '../MaterialMiniature'
import { beginPlayback, stopPlayback, updatePlayback } from '../../playbackStore'
import { durationSeconds } from './AudioCardPrimitives'
import { resolveGuidedAudio } from '../../guidedAudio'
import { localizeBuiltinText } from '../../contentI18n'

export function AudioFolderContent({ node, nodes, wires, onUpdateNodeData, onGenerate, onExtractSource, onRemoveSource }: {
  node:CanvasNode
  nodes: CanvasNode[]
  wires: Wire[]
  onUpdateNodeData:(id:string, patch:Record<string,unknown>)=>void
  onGenerate:(id:string)=>void
  onExtractSource?:(folderId:string, source:WorkSource, clientX:number, clientY:number)=>void
  onRemoveSource?:(folderId:string, sourceId:string)=>void
}) {
  const connectedLyrics = wires
    .filter(w => w.toNodeId === node.id || w.fromNodeId === node.id)
    .map(w => {
      const otherId = w.toNodeId === node.id ? w.fromNodeId : w.toNodeId
      return nodes.find(n => n.id === otherId && n.type === 'lyrics' && n.visible)
    })
    .filter(Boolean) as CanvasNode[]
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const d = node.data
  const sources = (d.sources as WorkSource[] | undefined) ?? []
  const mode = String(d.mode ?? 'remix') as 'cover'|'remix'|'mashup'|'extended'|'finalize'
  const generating = !!d.generating
  const isTwoByTwo = sources.length >= 3
  const hasSingleSource = sources.length === 1
  const selectedModeNeedsMultiple = mode === 'remix' || mode === 'mashup'
  const canGenerate = sources.length > 0 && !(hasSingleSource && selectedModeNeedsMultiple)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef=useRef<HTMLAudioElement>(null)
  const playbackHandle=useRef<number|null>(null)
  const stopLocal=useCallback(()=>{audioRef.current?.pause();setPlayingId(null)},[])
  const set = (patch:Record<string,unknown>) => onUpdateNodeData(node.id,patch)
  const modes = [
    { id:'cover' as const, label:s.coverMode, color:'#FF6A9B' },
    { id:'remix' as const, label:s.remixMode, color:'#8A7CFF' },
    { id:'mashup' as const, label:s.mashupMode, color:'#42D9D0' },
    { id:'extended' as const, label:s.extendedMode, color:'#4F8CFF' },
    { id:'finalize' as const, label:s.finalizeMode, color:'#F5A523' },
  ]

  useEffect(()=>{
    if (hasSingleSource && selectedModeNeedsMultiple) onUpdateNodeData(node.id,{mode:'cover'})
  },[hasSingleSource,selectedModeNeedsMultiple,node.id,onUpdateNodeData])

  useEffect(()=>{
    if(!playingId)return
    const source=sources.find(item=>item.id===playingId)
    if(!source)return
    if(source.audioUrl??resolveGuidedAudio(source.name)?.audioUrl)return
    const total=Math.max(1,durationSeconds(source.duration??'0:30'))
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
  },[playingId,sources])

  useEffect(()=>()=>{
    audioRef.current?.pause()
    if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
  },[])

  const toggleSourcePlayback=(source:WorkSource)=>{
    const sourceAudioUrl=source.audioUrl??resolveGuidedAudio(source.name)?.audioUrl
    if(playingId===source.id){
      if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
      playbackHandle.current=null
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    playbackHandle.current=beginPlayback({id:`folder:${node.id}:${source.id}`,title:localizeBuiltinText(source.name,lang),duration:source.duration??'0:30',color:source.color||'#8A7CFF',accent:source.accent,progress:0},stopLocal)
    setPlayingId(source.id)
    if(sourceAudioUrl&&audioRef.current){
      audioRef.current.src=sourceAudioUrl
      audioRef.current.load()
      void audioRef.current.play().catch(()=>{
        const handle=playbackHandle.current
        playbackHandle.current=null
        if(handle!==null)stopPlayback(handle)
        setPlayingId(null)
      })
    }
  }

  type DragState = { source:WorkSource; startX:number; startY:number; x:number; y:number; offsetX:number; offsetY:number; w:number; h:number; moved:boolean }
  const [dragging, setDragging] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const startDrag = (e: React.PointerEvent<HTMLElement>, source:WorkSource) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const st: DragState = { source, startX:e.clientX, startY:e.clientY, x:e.clientX, y:e.clientY, offsetX:e.clientX-rect.left, offsetY:e.clientY-rect.top, w:rect.width, h:rect.height, moved:false }
    dragRef.current = st
    setDragging(st)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  useEffect(()=>{
    if (!dragging) return
    const onMove = (e: PointerEvent)=>{
      const a = dragRef.current
      if (!a) return
      const moved = a.moved || Math.hypot(e.clientX-a.startX, e.clientY-a.startY) > 8
      const next = { ...a, x:e.clientX, y:e.clientY, moved }
      dragRef.current = next
      setDragging(next)
    }
    const onUp = (e: PointerEvent)=>{
      const a = dragRef.current
      dragRef.current = null
      setDragging(null)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      if (!a || !a.moved || Math.hypot(e.clientX-a.startX, e.clientY-a.startY) <= 42) return
      onExtractSource?.(node.id, a.source, e.clientX - a.offsetX, e.clientY - a.offsetY)
    }
    const onCancel = ()=>{
      dragRef.current = null
      setDragging(null)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', onMove, { passive:true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return ()=>{
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [dragging, node.id, onExtractSource])



  const displaySources = dragging?.moved ? sources.filter(s=>s.id!==dragging.source.id) : sources

  return (
    <div style={{ width:'100%', height:'100%', padding:'13px 14px 14px', boxSizing:'border-box', overflow:'hidden',
      background:'linear-gradient(155deg,#181721 0%,#121216 64%,#111518 100%)',
      display:'flex', flexDirection:'column', gap:11 }}>
      <audio ref={audioRef} preload="metadata" onLoadedMetadata={event=>{
        const audio=event.currentTarget
        if(audio.duration>0&&playbackHandle.current!==null){
          const seconds=Math.max(0,Math.round(audio.duration))
          updatePlayback(playbackHandle.current,{duration:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`})
        }
      }} onTimeUpdate={event=>{
        const audio=event.currentTarget
        if(playbackHandle.current!==null&&audio.duration>0)updatePlayback(playbackHandle.current,{progress:audio.currentTime/audio.duration*100})
      }} onEnded={()=>{
        const handle=playbackHandle.current
        playbackHandle.current=null
        setPlayingId(null)
        if(handle!==null)stopPlayback(handle)
      }}/>
      <div style={{ display:'flex', alignItems:'center', gap:9, margin:'-13px -14px 0', padding:'10px 14px', background:'#131312', borderBottom:'1px solid #26262A' }}>
        <MaterialMiniature colors={sources.map(source=>source.color || '#8A7CFF')} accent="#8A7CFF"/>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:11.5, fontWeight:800, color:'#ECEBF5' }}>{s.audioFolderTitle}</div>
          <div style={{ fontSize:8.5, color:'#69677A', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {sources.map(source=>localizeBuiltinText(source.name,lang)).join(' + ')}
          </div>
        </div>
        <span style={{ fontSize:8.5, color:'#8A7CFF', fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>{sources.length} {s.sourceTracks}</span>
        <div style={{ width:28, height:28, flexShrink:0, display:'grid', placeItems:'center' }}>
          <TileTypeIcon kind="folder" color="#8A7CFF" size={22}/>
        </div>
      </div>
      {connectedLyrics.length > 0 && (
        <div style={{ position:'relative', zIndex:10, height:32, boxSizing:'border-box', flexShrink:0,
          margin:'-11px -14px 0', background:'#1A1218', borderBottom:'1px solid #2E1E26',
          padding:'6px 14px', display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:8, fontWeight:700, color:'#E56B8A', background:'#E56B8A18', border:'1px solid #E56B8A30', borderRadius:10, padding:'2px 6px', flexShrink:0, display:'inline-flex', alignItems:'center', gap:4 }}>
            <TileTypeIcon kind="lyrics" color="#E56B8A" size={10}/> {lang==='zh'?'已连接歌词':'Lyrics connected'}
          </span>
          <span style={{ flex:1, minWidth:0, fontSize:9.5, color:'#D8B0BE', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {connectedLyrics.map(n => localizeBuiltinText((n.data as any).title ?? '未命名歌词',lang)).join(' · ')}
          </span>
          <span style={{ fontSize:8, color:'#8A5A6E', flexShrink:0 }}>{connectedLyrics.length} {lang==='zh'?'首':'tracks'}</span>
        </div>
      )}

      <div style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column', gap:11 }}>
        <div className="thin-scroll" style={{ display:'grid', gridAutoFlow:isTwoByTwo?'row':'column',
        gridTemplateColumns:isTwoByTwo?'repeat(2,minmax(0,1fr))':undefined,
        gridAutoColumns:isTwoByTwo?undefined:'minmax(232px,1fr)',
        gridTemplateRows:isTwoByTwo?'repeat(2,78px)':displaySources.length?'78px':'1fr',
        gap:8, flexShrink:0, overflowX:isTwoByTwo?'hidden':'auto', overflowY:isTwoByTwo?'auto':'hidden',
        paddingBottom:isTwoByTwo?2:0, minHeight:isTwoByTwo?164:displaySources.length?78:104, maxHeight:isTwoByTwo?180:undefined }}>
        {displaySources.map(source=><div key={source.id} onPointerDown={e=>startDrag(e, source)} style={{ touchAction:'none', cursor:'grab' }}><SourcePreviewCard source={source} playing={playingId===source.id} onTogglePlay={()=>toggleSourcePlayback(source)} onRemove={()=>onRemoveSource?.(node.id, source.id)} /></div>) }
        {displaySources.length===0 && !isTwoByTwo && (
          <div style={{ display:'grid', placeItems:'center', border:'1px dashed #2A2A28', borderRadius:9, color:'#3A3A38', fontSize:9 }}>{lang==='zh'?'拖入 Demo / 音频 / 作品':'Drop a demo, audio, or track'}</div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:5, flexShrink:0 }}>
        {modes.map(item=>{
          const disabled=hasSingleSource && (item.id==='remix'||item.id==='mashup')
          return <button key={item.id} data-guide-target={`folder-mode-${item.id}-${node.id}`} disabled={disabled} onPointerDown={e=>e.stopPropagation()}
            onClick={e=>{e.stopPropagation();if(!disabled)set({mode:item.id})}}
            title={disabled?(lang==='zh'?'至少需要两个音频来源':'At least two audio sources are required'):undefined}
            style={{ height:29, borderRadius:7, cursor:disabled?'not-allowed':'pointer', fontSize:9.5, fontWeight:800,
              opacity:disabled ? .34 : 1,
              color:mode===item.id?'#fff':item.color, background:mode===item.id?item.color:item.color+'12',
              border:`1px solid ${mode===item.id?item.color:item.color+'35'}`,
              boxShadow:mode===item.id?`0 7px 18px ${item.color}26`:'none' }}>{item.label}</button>
        }) }
      </div>

      <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, alignItems:'stretch' }}>
        <div style={{ background:'#0D0D12', border:'1px solid #1E1E1E', borderRadius:8, padding:'9px 10px 10px', display:'flex', flexDirection:'column', gap:7, minHeight:0, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0 }}>
            <span style={{ fontSize:10, fontWeight:750, color:'#D1D0D8', flexShrink:0 }}>{lang==='zh'?'取向象限':'Orientation'}</span>
            <span style={{ marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:7, fontSize:8, whiteSpace:'nowrap' }}>
              <span style={{ color:'#A99BFF' }}>{s.weirdness ?? '创意度'} <b style={{ color:'#E8E7F2', fontFamily:"'JetBrains Mono',monospace" }}>{String(Number(d.weirdness ?? 50))}%</b></span>
              <span style={{ color:'#68D6CE' }}>{s.styleInfluence ?? '风格影响'} <b style={{ color:'#E8E7F2', fontFamily:"'JetBrains Mono',monospace" }}>{String(Number(d.styleInfluence ?? 50))}%</b></span>
            </span>
          </div>
          <div
            data-orientation-quadrant="1" data-guide-target={`folder-quadrant-${node.id}`}
            onPointerDown={e=>{
              e.stopPropagation()
              const el = e.currentTarget as HTMLElement
              const rect = el.getBoundingClientRect()
              const update = (cx:number, cy:number)=>{
                const px = ((cx - rect.left) / rect.width) * 100
                const py = ((cy - rect.top) / rect.height) * 100
                const nx = Math.max(0, Math.min(100, Math.round((px - 4) / .92)))
                const ny = Math.max(0, Math.min(100, Math.round(100 - (py - 5) / .9)))
                set({ weirdness: nx, styleInfluence: ny } as any)
              }
              update(e.clientX, e.clientY)
              const onMove = (ev: PointerEvent)=>{ update(ev.clientX, ev.clientY) }
              const onUp = ()=>{
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
              try { (e.currentTarget as HTMLElement).setPointerCapture((e as any).pointerId) } catch {}
            }}
            style={{ flex:1, minHeight:0, borderRadius:9,
              background:'radial-gradient(circle at 76% 20%,rgba(229,107,138,.10),transparent 36%), radial-gradient(circle at 18% 86%,rgba(59,189,175,.09),transparent 42%), linear-gradient(180deg,#151720,#0C0D12)',
              border:'1px solid #252631', boxShadow:'inset 0 1px 0 rgba(255,255,255,.035), inset 0 -18px 34px rgba(0,0,0,.24)',
              position:'relative', overflow:'hidden', cursor:'crosshair', touchAction:'none' }}>
            {(() => {
              const cols = 21, rows = 15
              const wx = Number(d.weirdness ?? 50), wy = Number(d.styleInfluence ?? 50)
              const dots = []
              for (let r=0; r<rows; r++) {
                for (let c=0; c<cols; c++) {
                  const dx = (c / (cols-1)) * 100
                  const dy = (1 - r / (rows-1)) * 100
                  const dist = Math.hypot(dx - wx, dy - wy)
                  const t = (dx/100 + dy/100)/2
                  // 冷色 #3BBDAF(59,189,175) -> 暖色 #FF6A9B(255,106,155)
                  const cold = [59,189,175] as const, warm = [255,106,155] as const
                  const rr = Math.round(cold[0] + (warm[0]-cold[0])*t)
                  const gg = Math.round(cold[1] + (warm[1]-cold[1])*t)
                  const bb = Math.round(cold[2] + (warm[2]-cold[2])*t)
                  const maxDist = 25
                  const proximity = Math.max(0, 1 - dist/maxDist)
                  const axisDistance = Math.min(Math.abs(dx-wx), Math.abs(dy-wy))
                  const axisGlow = Math.max(0, 1-axisDistance/3.7) * Math.max(0.18, 1-dist/68)
                  const scale = 1 + proximity*1.55
                  const opacity = Math.min(1, 0.18 + t*0.12 + proximity*0.6 + axisGlow*0.2)
                  const size = 2.65
                  dots.push(
                    <span key={`${r}-${c}`} style={{
                      position:'absolute', left:`${4 + (c/(cols-1))*92}%`, top:`${5 + (r/(rows-1))*90}%`,
                      width:size, height:size, borderRadius:'50%', background:`rgb(${rr},${gg},${bb})`,
                      transform:`translate(-50%,-50%) scale(${scale})`, opacity, pointerEvents:'none',
                      boxShadow: proximity > .56 ? `0 0 ${3 + proximity*7}px rgba(${rr},${gg},${bb},${.1 + proximity*.27})` : 'none',
                      transition:'transform 160ms cubic-bezier(.22,1,.36,1), opacity 140ms ease, box-shadow 180ms ease',
                      willChange:'transform,opacity'
                    }} />
                  )
                }
              }
              return dots
            })()}
            <div style={{ position:'absolute', left:'50%', top:'5%', bottom:'5%', width:1, background:'linear-gradient(180deg,transparent,#77768A55,transparent)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:'50%', left:'4%', right:'4%', height:1, background:'linear-gradient(90deg,transparent,#77768A55,transparent)', pointerEvents:'none' }} />
            <span style={{ position:'absolute', left:8, top:6, fontSize:7.5, color:'#68D6CE', opacity:.72, pointerEvents:'none' }}>{s.styleInfluence ?? '风格影响'} ↑</span>
            <span style={{ position:'absolute', right:8, bottom:6, fontSize:7.5, color:'#A99BFF', opacity:.76, pointerEvents:'none' }}>{s.weirdness ?? '创意度'} →</span>
            <div style={{
              position:'absolute', left:`${4 + Number(d.weirdness ?? 50)*.92}%`, top:`${5 + (100 - Number(d.styleInfluence ?? 50))*.9}%`,
              width:15, height:15, borderRadius:'50%', background:'#F8F8FA', border:'1.5px solid rgba(255,255,255,.95)',
              boxShadow:'0 0 0 4px rgba(229,107,138,.16), 0 0 16px rgba(229,107,138,.68), 0 4px 10px rgba(0,0,0,.38)',
              transform:'translate(-50%,-50%)', transition:'left 130ms cubic-bezier(.22,1,.36,1), top 130ms cubic-bezier(.22,1,.36,1)', pointerEvents:'none', zIndex:2
            }} />
          </div>
        </div>
        <textarea data-guide-target={`folder-prompt-${node.id}`} value={localizeBuiltinText(d.prompt,lang)} placeholder={s.folderPromptPh}
        onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
        onChange={e=>set({prompt:e.target.value})}
        style={{ width:'100%', height:'100%', minHeight:45, resize:'none', borderRadius:8, padding:'8px 9px',
          background:'#0D0D12', border:'1px solid #29283A', color:'#B6B4C8', fontSize:9.5,
          lineHeight:1.55, outline:'none', fontFamily:"'Inter',sans-serif" }}/>
      </div>
      </div>
      <button data-guide-target={`folder-generate-${node.id}`} disabled={generating || !canGenerate} onPointerDown={e=>e.stopPropagation()}
        onClick={e=>{e.stopPropagation();onGenerate(node.id)}}
        style={{ height:34, flexShrink:0, border:0, borderRadius:8, cursor:generating||!canGenerate?'default':'pointer',
          color:'#fff', fontSize:10.5, fontWeight:850,
          background:generating?'#292835':'linear-gradient(100deg,#7C62FF,#B052E8 50%,#2CCFC3)',
          boxShadow:generating?'none':'0 9px 24px rgba(124,98,255,.22)' }}>
        {generating ? `✦ ${s.generatingWork}` : `✦ ${s.generateWork}`}
      </button>
      {dragging?.moved && createPortal(<div style={{ position:'fixed', left:dragging.x - dragging.offsetX, top:dragging.y - dragging.offsetY, width:dragging.w, height:dragging.h, zIndex:10000, pointerEvents:'none' }}><SourcePreviewCard source={dragging.source} /></div>, document.body)}
    </div>
  )
}

function sourceKindLabel(source:WorkSource, lang:'zh'|'en') {
  if (source.kind === 'demo') return '30s DEMO'
  if (source.kind === 'work') return String((source as any).mode ?? 'WORK').toUpperCase()
  if (source.kind === 'reference') return lang==='zh'?'参考音频':'Reference Audio'
  if (source.kind === 'hum') return lang==='zh'?'小样':'Hum Clip'
  return source.kind.toUpperCase()
}

function SourcePreviewCard({source, playing, onTogglePlay, onRemove}:{source:WorkSource; playing?:boolean; onTogglePlay?:()=>void; onRemove?:()=>void}) {
  const s=useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const isDemo = source.kind === 'demo'
  const isWork = source.kind === 'work'
  const accent = (source as any).accent as string | undefined
  const detailRow = isDemo
    ? [source.style, source.texture, source.rhythm].filter(Boolean).join(' · ') || source.mood || 'Demo'
    : isWork
      ? [source.style, source.texture, source.rhythm].filter(Boolean).join(' · ') || source.mood || (source as any).mode || 'Work'
      : source.fileName || source.style || source.mood || 'Audio source'
  const bg = isWork && accent
    ? `radial-gradient(circle at 92% 6%,${accent}28,transparent 34%),radial-gradient(circle at 4% 100%,${(source.color||'#8A7CFF')}28,transparent 42%),#15151B`
    : '#1A1A1E'
  const borderCol = isWork ? (source.color || '#8A7CFF') : source.color
  const border = `1px solid ${borderCol}${isWork ? '55' : '45'}`
  return <div style={{ minWidth:0, height:78, borderRadius:9, overflow:'hidden',
    border:border, background:bg, display:'flex', flexDirection:'column', position:'relative' }}>
    <div style={{ height:38, flexShrink:0, display:'flex', alignItems:'center', gap:7, padding:'0 10px', borderTop:`2px solid ${source.color}`, borderBottom:'1px solid #ffffff0D', background:'rgba(20,20,19,.72)' }}>
      <span style={{ width:16,height:16,display:'grid',placeItems:'center' }}>
        <TileTypeIcon kind={isDemo?'demo':isWork?'work':source.kind==='reference'?'reference':source.kind==='hum'?'hum':'audio'} color={source.color} size={15}/>
      </span>
      <strong style={{ flex:1,minWidth:0,fontSize:10,color:'#DAD9E2',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{localizeBuiltinText(source.name,lang)}</strong>
      <span style={{ fontSize:8.5, fontWeight:800, color:source.color, background:source.color+'12', border:`1px solid ${source.color}38`, borderRadius:12, padding:'2px 7px', flexShrink:0 }}>{sourceKindLabel(source,lang)}</span>
      {onRemove && <button aria-label={lang==='zh'?'移除':'Remove'} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); onRemove()}} style={{ width:18, height:18, padding:0, border:0, background:'transparent', color:'#65636F', fontSize:14, lineHeight:'18px', cursor:'pointer', flexShrink:0 }}>×</button>}
    </div>
    <div style={{ flex:1, minHeight:0, padding:'6px 8px', display:'flex', alignItems:'center', gap:7 }}>
      <button data-guide-audio-control="1" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); onTogglePlay?.()}}
        style={{ width:22,height:22,borderRadius:6,flexShrink:0,cursor:'pointer',display:'grid',placeItems:'center',
          background:source.color+'12',border:`1px solid ${source.color}28`,color:source.color,fontSize:9,lineHeight:1 }}>{playing?'Ⅱ':'▶'}</button>
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3, overflow:'hidden' }}>
        <div style={{ fontSize:9, color:'#9A9A9E', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{localizeBuiltinText(detailRow,lang)}</div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:6, fontSize:8, color:'#6A6A6E' }}>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{localizeBuiltinText(source.mood ?? source.duration,lang)}</span>
          {source.duration && <span style={{ flexShrink:0, fontFamily:"'JetBrains Mono',monospace", color:'#7A7A7E' }}>{source.duration}</span>}
        </div>
      </div>
    </div>
  </div>
}
