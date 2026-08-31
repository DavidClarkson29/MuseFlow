import { useEffect, useRef, useState } from 'react'
import type { CanvasNode } from '../../types'
import { useLang } from '../../App'
import { NodeHdr } from './NodeHeader'
import { TileTypeIcon } from '../TileTypeIcon'
import { localizeBuiltinText } from '../../contentI18n'

export function LyricsContent({ node, onUpdateNodeData, previewOpen: controlledPreviewOpen, onTogglePreview }: { node: CanvasNode; onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void; previewOpen?: boolean; onTogglePreview?: () => void }) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const sections = (node.data.sections as Array<{id:string, type:string, label:string, content:string}> | undefined) ?? []
  const title = localizeBuiltinText(node.data.title ?? '未命名歌词',lang)
  const set = (patch: Record<string, unknown>) => onUpdateNodeData(node.id, patch)
  const presets: Array<{type:string, label:string, color:string}> = [
    { type:'intro', label:s.lyricIntro, color:'#8A8AFF' },
    { type:'verse', label:s.lyricVerse, color:'#3BBDAF' },
    { type:'preChorus', label:s.lyricPreChorus, color:'#9B7EFF' },
    { type:'chorus', label:s.lyricChorus, color:'#E56B8A' },
    { type:'bridge', label:s.lyricBridge, color:'#F5A523' },
    { type:'outro', label:s.lyricOutro, color:'#7A7A78' },
  ]
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null)
  const [localPreviewOpen, setLocalPreviewOpen] = useState(false)
  const previewOpen = controlledPreviewOpen ?? localPreviewOpen
  const togglePreview = onTogglePreview ?? (() => setLocalPreviewOpen(v => !v))
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id:string; position:'before'|'after' } | null>(null)
  const sectionListRef = useRef<HTMLDivElement>(null)
  const reorderPointerRef = useRef<{ pointerId:number; sourceId:string; startX:number; startY:number; active:boolean; target:{ id:string; position:'before'|'after' } | null } | null>(null)
  useEffect(() => {
    if (sections.length === 0) setSelectedId(null)
    else if (!selectedId || !sections.some(sec=>sec.id===selectedId)) setSelectedId(sections[0].id)
  }, [sections, selectedId])
  const selected = sections.find(sec=>sec.id===selectedId) ?? null
  const addSection = (type:string, label:string) => {
    const id = `${node.id}-sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`
    const next = [...sections, { id, type, label, content: '' }]
    set({ sections: next })
    setSelectedId(id)
  }
  const updateSection = (id:string, patch: Partial<{label:string, content:string}>) => {
    const next = sections.map(sec => sec.id === id ? { ...sec, ...patch } : sec)
    set({ sections: next })
  }
  const removeSection = (id:string) => set({ sections: sections.filter(sec => sec.id !== id) })
  const moveSection = (id:string, dir: -1 | 1) => {
    const idx = sections.findIndex(sec => sec.id === id)
    if (idx < 0) return
    const nidx = idx + dir
    if (nidx < 0 || nidx >= sections.length) return
    const next = [...sections]
    const [moved] = next.splice(idx, 1)
    next.splice(nidx, 0, moved)
    set({ sections: next })
  }
  const reorderSection = (sourceId:string, targetId:string, position:'before'|'after') => {
    if (sourceId === targetId) return
    const sourceIndex = sections.findIndex(sec => sec.id === sourceId)
    const targetIndex = sections.findIndex(sec => sec.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const next = [...sections]
    const [moved] = next.splice(sourceIndex, 1)
    let insertIndex = next.findIndex(sec => sec.id === targetId)
    if (position === 'after') insertIndex += 1
    next.splice(insertIndex, 0, moved)
    set({ sections: next })
    setSelectedId(sourceId)
  }
  const sectionDropAt = (clientX:number, clientY:number, sourceId:string) => {
    const targetRow = document.elementFromPoint(clientX, clientY)?.closest('[data-lyrics-section-id]') as HTMLElement | null
    const targetId = targetRow?.dataset.lyricsSectionId
    if (!targetId || targetId === sourceId) return null
    const targetButton = targetRow.querySelector(':scope > button') as HTMLElement | null
    const rect = (targetButton ?? targetRow).getBoundingClientRect()
    return { id:targetId, position:(clientY < rect.top + rect.height/2 ? 'before' : 'after') as 'before'|'after' }
  }
  return (
    <>
      <NodeHdr label={title} icon={<TileTypeIcon kind="lyrics" color="#E56B8A" size={17}/>} accent="#E56B8A" editable onRename={v => set({ title: v })}/>
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'7px 8px 6px', borderBottom:'1px solid #1E1E1E', background:'#141418' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:8, fontWeight:800, color:'#8A8AFF', letterSpacing:'0.07em', textTransform:'uppercase' }}>{s.lyricStructure}</span>
            <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); togglePreview()}}
              title={s.lyricBrowse}
              aria-label={s.lyricBrowse}
              style={{ width:22, height:22, display:'grid', placeItems:'center', background: previewOpen ? '#E56B8A18' : 'transparent', border: `1px solid ${previewOpen ? '#E56B8A40' : '#2A2A28'}`, borderRadius:6, cursor:'pointer', color: previewOpen ? '#E56B8A' : '#8A8A86' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="2" cy="3" r="0.9" fill="currentColor"/>
                <circle cx="2" cy="6" r="0.9" fill="currentColor"/>
                <circle cx="2" cy="9" r="0.9" fill="currentColor"/>
                <path d="M4.2 3H10M4.2 6H8.8M4.2 9H9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
            {presets.map(p => (
              <button key={p.type} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); addSection(p.type, p.label)}}
                style={{ padding:'3px 7px', borderRadius:12, fontSize:8.5, fontWeight:600, cursor:'pointer',
                  background:p.color+'14', border:`1px solid ${p.color}30`, color:p.color }}>{p.label}</button>
            ))}
            <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); addSection('custom',lang==='zh'?'自定义':'Custom')}}
              style={{ padding:'3px 7px', borderRadius:12, fontSize:8.5, cursor:'pointer', background:'#1E1E1C', border:'1px dashed #2A2A28', color:'#8A8A86' }}>+ {s.lyricAddSection}</button>
          </div>
        </div>
        <div style={{ flex:1, minHeight:0, display:'flex', overflow:'hidden' }}>
          <div ref={sectionListRef} className="thin-scroll explore-scroll" data-lyrics-section-list="1"
            onPointerDown={e=>e.stopPropagation()}
            style={{ width:110, flexShrink:0, borderRight:'1px solid #1E1E1E', background:'#141418', padding:'6px 6px 8px', display:'flex', flexDirection:'column', gap:0, overflowY:'auto', overscrollBehavior:'contain' }}>
            {sections.length === 0 ? (
              <div style={{ padding:'12px 6px', textAlign:'center', fontSize:9, color:'#5A5A56' }}>{s.lyricEmptyHint}</div>
            ) : sections.map((sec, idx) => {
              const preset = presets.find(p=>p.type===sec.type)
              const color = preset?.color ?? '#E56B8A'
              const active = sec.id === selectedId
              return (
                <div key={sec.id} data-lyrics-section-id={sec.id} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <button
                    onPointerDown={e=>{
                      e.stopPropagation()
                      reorderPointerRef.current = { pointerId:e.pointerId, sourceId:sec.id, startX:e.clientX, startY:e.clientY, active:false, target:null }
                      e.currentTarget.setPointerCapture(e.pointerId)
                    }}
                    onPointerMove={e=>{
                      const drag = reorderPointerRef.current
                      if (!drag || drag.pointerId !== e.pointerId) return
                      const distance = Math.hypot(e.clientX-drag.startX, e.clientY-drag.startY)
                      if (!drag.active && distance < 5) return
                      if (!drag.active) {
                        drag.active = true
                        setDraggedId(drag.sourceId)
                      }
                      e.preventDefault()
                      e.stopPropagation()
                      const list = sectionListRef.current
                      if (list) {
                        const listRect = list.getBoundingClientRect()
                        if (e.clientY < listRect.top + 24) list.scrollBy({ top:-10 })
                        else if (e.clientY > listRect.bottom - 24) list.scrollBy({ top:10 })
                      }
                      const target = sectionDropAt(e.clientX, e.clientY, drag.sourceId)
                      if (!target) {
                        drag.target = null
                        setDropTarget(null)
                        return
                      }
                      drag.target = target
                      setDropTarget(target)
                    }}
                    onPointerUp={e=>{
                      const drag = reorderPointerRef.current
                      if (!drag || drag.pointerId !== e.pointerId) return
                      e.stopPropagation()
                      const moved = drag.active || Math.hypot(e.clientX-drag.startX, e.clientY-drag.startY) >= 5
                      if (moved) {
                        e.preventDefault()
                        const target = drag.target ?? sectionDropAt(e.clientX, e.clientY, drag.sourceId)
                        if (target) reorderSection(drag.sourceId, target.id, target.position)
                      } else {
                        setSelectedId(sec.id)
                      }
                      reorderPointerRef.current = null
                      setDraggedId(null)
                      setDropTarget(null)
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
                    }}
                    onPointerCancel={()=>{
                      reorderPointerRef.current = null
                      setDraggedId(null)
                      setDropTarget(null)
                    }}
                    onClick={e=>{e.stopPropagation(); setSelectedId(sec.id)}}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:5, padding:'5px 7px', borderRadius:8, textAlign:'left',
                      background: active ? color : '#1E1E1C',
                      border:`1px solid ${active ? color : '#2A2A28'}`,
                      borderTopColor:dropTarget?.id===sec.id&&dropTarget.position==='before'?'#E56B8A':(active?color:'#2A2A28'),
                      borderBottomColor:dropTarget?.id===sec.id&&dropTarget.position==='after'?'#E56B8A':(active?color:'#2A2A28'),
                      boxShadow:dropTarget?.id===sec.id ? `0 ${dropTarget.position==='before'?-2:2}px 0 #E56B8A` : undefined,
                      color: active ? '#fff' : '#C0C0BC', fontSize:9, fontWeight: active?700:500,
                      opacity:draggedId===sec.id?0.52:1, cursor:draggedId===sec.id?'grabbing':'grab' }}>
                    <span aria-hidden="true" style={{ color:active?'rgba(255,255,255,.72)':'#656560', fontSize:8, letterSpacing:-2, flexShrink:0 }}>⠿</span>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0, boxShadow: active ? `0 0 6px ${color}` : 'none' }}/>
                    <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{localizeBuiltinText(sec.label,lang)}</span>
                    <span draggable={false} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); removeSection(sec.id)}}
                      style={{ display:'grid', placeItems:'center', width:14, height:14, borderRadius:4, background: active ? 'rgba(0,0,0,0.18)' : '#2A2A28', color: active ? '#fff' : '#8A8A86', fontSize:10, lineHeight:1, flexShrink:0 }}>×</span>
                  </button>
                  {idx < sections.length - 1 && <span style={{ fontSize:10, color:'#3A3A38', lineHeight:1, padding:'3px 0' }}>↓</span>}
                </div>
              )
            })}
          </div>
          <div style={{ flex:1, minWidth:0, padding:'8px', display:'flex', flexDirection:'column', background:'#0F0F14' }}>
            {!selected ? (
              <div style={{ flex:1, display:'grid', placeItems:'center', border:'1px dashed #2A2A28', borderRadius:8, color:'#5A5A56', fontSize:10, textAlign:'center', padding:12 }}>{s.lyricEmptyHint}</div>
            ) : (
              <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', border:`1px solid ${(presets.find(p=>p.type===selected.type)?.color ?? '#E56B8A')}28`, borderRadius:8, overflow:'hidden', background:'#19191E' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 6px', background:(presets.find(p=>p.type===selected.type)?.color ?? '#E56B8A')+'0F', borderBottom:`1px solid ${(presets.find(p=>p.type===selected.type)?.color ?? '#E56B8A')}18` }}>
                  <span style={{ fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:10, background:(presets.find(p=>p.type===selected.type)?.color ?? '#E56B8A')+'18', border:`1px solid ${(presets.find(p=>p.type===selected.type)?.color ?? '#E56B8A')+'30'}`, color:presets.find(p=>p.type===selected.type)?.color ?? '#E56B8A' }}>{localizeBuiltinText(selected.label,lang)}</span>
                  <input value={localizeBuiltinText(selected.label,lang)} onChange={e=>updateSection(selected.id, { label: e.target.value })}
                    onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
                    style={{ flex:1, minWidth:0, background:'transparent', border:'none', outline:'none', color:'#C0C0BC', fontSize:9.5, fontWeight:600 }}/>
                  <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); const idx=sections.findIndex(s=>s.id===selected.id); moveSection(selected.id, -1); if(idx>0) setSelectedId(sections[idx-1].id)}} disabled={sections.findIndex(s=>s.id===selected.id)===0}
                    style={{ width:18,height:18,display:'grid',placeItems:'center',background:'transparent',border:'1px solid #2A2A28',borderRadius:4,cursor:'pointer',color:'#8A8A86',fontSize:10,opacity:sections.findIndex(s=>s.id===selected.id)===0?0.4:1 }}>↑</button>
                  <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); const idx=sections.findIndex(s=>s.id===selected.id); moveSection(selected.id, 1); if(idx<sections.length-1) setSelectedId(sections[idx+1].id)}} disabled={sections.findIndex(s=>s.id===selected.id)===sections.length-1}
                    style={{ width:18,height:18,display:'grid',placeItems:'center',background:'transparent',border:'1px solid #2A2A28',borderRadius:4,cursor:'pointer',color:'#8A8A86',fontSize:10,opacity:sections.findIndex(s=>s.id===selected.id)===sections.length-1?0.4:1 }}>↓</button>
                </div>
                <textarea value={localizeBuiltinText(selected.content,lang)} onChange={e=>updateSection(selected.id, { content: e.target.value })}
                  onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
                  placeholder={s.lyricContentPh}
                  style={{ flex:1, minHeight:0, resize:'none', background:'#0F0F14', border:'none', outline:'none', color:'#C8C8E4', fontSize:11, lineHeight:1.7, padding:'8px 10px', fontFamily:"'Inter',sans-serif" }}/>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
