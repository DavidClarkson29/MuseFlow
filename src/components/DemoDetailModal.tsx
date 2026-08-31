import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { strings } from '../i18n'
import type { CanvasNode } from '../types'
import { TileTypeIcon, type TileIconKind } from './TileTypeIcon'
import { localizeBuiltinText } from '../contentI18n'

interface Props {
  lang: Lang
  node: CanvasNode
  onClose: () => void
}

export function DemoDetailModal({ lang, node, onClose }: Props) {
  const s = strings[lang]
  const d = node.data
  const recipe = d.recipe as {
    mats: { name: string; weight: number; kind: string; isRef: boolean; fileName?: string }[]
    mode: string; vocal: string; timeSig: string; negative: string; prompt?: string
  } | undefined
  const isWork = node.type === 'work' || !!d.fullTrack
  const workSources = (d.sources as Array<{id:string;name:string;kind:string;color:string;duration?:string;fileName?:string}> | undefined) ?? []
  const modeBadge = isWork ? String(d.mode ?? 'remix').toUpperCase() : s.demo30

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const kindIcon = (k: string, isRef: boolean):TileIconKind => k === 'image' ? 'image' : k === 'text' ? 'text' : isRef ? 'reference' : 'hum'
  const kindColor = (k:string, isRef:boolean) => k === 'image' ? '#3BBDAF' : k === 'text' ? '#6B6EF5' : isRef ? '#4BA35A' : '#F5A523'
  const sourceKind = (k:string) => k==='demo' ? '30s DEMO' : k==='reference' ? (lang==='zh'?'参考音频':'Reference Audio') : k==='hum' ? (lang==='zh'?'小样':'Hum Clip') : k.toUpperCase()

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.62)', display:'flex',
        alignItems:'center', justifyContent:'center', zIndex:95, backdropFilter:'blur(5px)' }}>
      <div className="inspector-appear" onClick={e=>e.stopPropagation()}
        style={{ width:520, maxHeight:'84vh', background:'#161615', border:'1px solid #2C2C2A',
          borderRadius:16, boxShadow:'0 32px 90px rgba(0,0,0,0.7)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid #242422',
          display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ width:10, height:10, borderRadius:'50%',
            background:String(d.color ?? '#3BBDAF'), boxShadow:`0 0 10px ${String(d.color ?? '#3BBDAF')}80` }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#F0F0EE', letterSpacing:'-0.02em' }}>
              {localizeBuiltinText(d.name,lang)} <span style={{ fontSize:10, fontWeight:700, color:String(d.color),
                border:`1px solid ${String(d.color)}45`, borderRadius:8, padding:'1px 7px', marginLeft:6 }}>{modeBadge}</span>
            </div>
            <div style={{ fontSize:10.5, color:'#4A4A48', marginTop:2 }}>{isWork ? `${modeBadge} · ${s.usedPromptL}` : `${s.recipeL} · ${s.usedPromptL}`}</div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'#222220', border:'none', borderRadius:7, cursor:'pointer', color:'#5A5A56' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:16 }} className="thin-scroll">

          {/* 控制台参数（生成时快照）— 位于 Prompt 上方 */}
          {recipe ? (
            <>
              <Section title={`▢ ${s.panelTitle} · ${s.recipeL}`}>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {recipe.mats.map(m => (
                    <div key={m.name}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                        <span style={{ width:17, height:17, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <TileTypeIcon kind={kindIcon(m.kind, m.isRef)} color={kindColor(m.kind,m.isRef)} size={15}/>
                        </span>
                        <span style={{ flex:1, minWidth:0, fontSize:11, color:'#C0C0BC',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{localizeBuiltinText(m.name,lang)}</span>
                        <span style={{ fontSize:11, fontWeight:800, color:'#8A8AFF',
                          fontFamily:"'JetBrains Mono',monospace" }}>{m.weight}%</span>
                      </div>

                      <div style={{ height:4, background:'#222220', borderRadius:2, marginLeft:24 }}>
                        <div style={{ width:`${m.weight}%`, height:'100%', borderRadius:2,
                          background:'linear-gradient(90deg,#6B6EF5,#9B7EFF)', opacity:0.85 }}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:10 }}>
                  <KV k={s.modeL} v={recipe.mode==='inst' ? s.modeInst : s.modeSong} c="#3BBDAF"/>
                  {recipe.mode!=='inst' && <KV k={s.vocalL} v={recipe.vocal==='male' ? s.male : s.female} c="#F5A523"/>}
                  <KV k={s.timeSignature} v={recipe.timeSig} c="#9B7EFF"/>
                </div>
                {recipe.negative && (
                  <div style={{ marginTop:10, padding:'7px 10px', background:'#161010',
                    border:'1px solid #2E1E20', borderRadius:7 }}>
                    <span style={{ fontSize:9, fontWeight:800, color:'#E06A5A90', marginRight:6 }}>🚫 {s.negativeL}</span>
                    <span style={{ fontSize:10.5, color:'#D8A8A0' }}>{localizeBuiltinText(recipe.negative,lang)}</span>
                  </div>
                )}
                {recipe.prompt && (
                  <div style={{ marginTop:10, padding:'8px 10px', background:'#0F0F14',
                    border:'1px solid #23233A', borderRadius:7 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#7A7A86', marginBottom:4, letterSpacing:'0.04em' }}>{s.promptL}</div>
                    <div style={{ fontSize:10.5, color:'#9A9AC0', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{localizeBuiltinText(recipe.prompt,lang)}</div>
                  </div>
                )}
              </Section>

              <div style={{ height:1, background:'#222220' }}/>
            </>
          ) : isWork ? (
            <Section title={`▢ ${s.sourceTracks}`}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
                {workSources.map(source=><div key={source.id} style={{minWidth:0,borderRadius:9,overflow:'hidden',border:`1px solid ${source.color}35`,background:`linear-gradient(145deg,${source.color}13,#121216)`}}>
                  <div style={{height:32,display:'flex',alignItems:'center',gap:7,padding:'0 9px',borderTop:`2px solid ${source.color}`,borderBottom:'1px solid #ffffff0C'}}>
                    <TileTypeIcon kind={source.kind==='demo'?'demo':source.kind==='reference'?'reference':source.kind==='hum'?'hum':'work'} color={source.color} size={13}/>
                    <strong style={{flex:1,minWidth:0,fontSize:10.5,color:'#D6D5DE',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{localizeBuiltinText(source.name,lang)}</strong>
                    <span style={{fontSize:7.5,fontWeight:800,color:source.color}}>{sourceKind(source.kind)}</span>
                  </div>
                  <div style={{padding:'9px',display:'flex',alignItems:'center',gap:3,height:42}}>
                    {Array.from({length:28},(_,i)=><span key={i} style={{width:2,height:4+((i*13)%20),borderRadius:2,background:source.color,opacity:.4+(i%4)*.12}}/>) }
                    {source.duration&&<span style={{marginLeft:'auto',fontSize:8.5,color:'#686674',fontFamily:"'JetBrains Mono',monospace"}}>{source.duration}</span>}
                  </div>
                </div>)}
              </div>
            </Section>
          ) : (
            <Section title={`▢ ${s.panelTitle} · ${s.recipeL}`}>
              <div style={{ padding:'10px 12px', background:'#141413', border:'1px dashed #2A2A28', borderRadius:8, fontSize:10.5, color:'#5A5A56', lineHeight:1.6 }}>
                {lang==='zh'?<>暂无控制台快照。请在黑板控制台调整比重/形态/人声/拍号后重新「{s.divergeBtn}」，新生成的 Demo 将在此处回显当时的控制台参数。</>:<>No console snapshot yet. Adjust weights, format, vocals, or time signature in the board console and run “{s.divergeBtn}” again. New demos will show the parameters used at generation time.</>}
              </div>
            </Section>
          )}

          {/* 完整 Prompt */}
          <Section title={`✦ ${s.usedPromptL}`}>
            <pre style={{ margin:0, padding:'12px 14px', background:'#0F0F14',
              border:'1px solid #23233A', borderRadius:9, fontSize:11, lineHeight:1.9,
              color:'#B8BAE0', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{localizeBuiltinText(d.usedPrompt,lang)}</pre>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:9.5, fontWeight:800, color:'#7A7A86', textTransform:'uppercase',
        letterSpacing:'0.07em', marginBottom:9 }}>{title}</div>
      {children}
    </div>
  )
}

function KV({ k, v, c }: { k:string; v:string; c:string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px',
      borderRadius:6, background:c+'10', border:`1px solid ${c}28` }}>
      <span style={{ fontSize:9, color:'#5A5A56' }}>{k}</span>
      <span style={{ fontSize:10, fontWeight:700, color:c }}>{v}</span>
    </span>
  )
}
