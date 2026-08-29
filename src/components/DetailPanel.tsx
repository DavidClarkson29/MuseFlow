import type { Lang } from '../i18n'
import { strings } from '../i18n'
import type { CanvasNode } from '../types'
import { nodeThemeColor } from '../theme'

interface Props {
  lang: Lang
  node: CanvasNode | null
  nodes?: CanvasNode[]
  onClose?: () => void
  onSelectNode?: (id: string | null) => void
}

const FRAME_CANVAS_W = 520

// 统一磁贴标题解析，与画布卡片保持一致，避免 __HUM__/__REF__/text 等原始值泄露
function getRackTitle(node: CanvasNode, s: any): string {
  const d: any = node.data
  if (node.type === 'image') {
    return String(d.label ?? d.name ?? s.nodeImage ?? '图片素材')
  }
  if (node.type === 'audio') {
    const raw = String(d.label ?? d.name ?? '')
    if (raw === '__HUM__' || d.isHum) return s.addHumClip ?? s.qRecordMelody ?? '哼唱片段'
    if (raw === '__REF__' || d.isRef) return s.addRefAudio ?? s.qAddReference ?? '参考音频'
    if (d.fileName) {
      // 对于已命名的参考音频，标题仍显示为“参考音频”，文件名在副标题或详情中展示
      const lbl = String(d.label ?? '').trim()
      if (lbl && lbl !== '__REF__' && lbl !== '__HUM__') return lbl
      return s.addRefAudio ?? '参考音频'
    }
    return String(d.label ?? d.name ?? s.nodeAudio ?? '音频')
  }
  if (node.type === 'text') {
    const t = String(d.title ?? '').trim()
    if (t) return t
    return s.hdrText ?? s.nodeText ?? '文字意向'
  }
  if (node.type === 'lyrics') {
    return String(d.title ?? s.nodeLyrics ?? '歌词')
  }
  if (node.type === 'direction') {
    return String(d.name ?? d.label ?? 'Demo')
  }
  if (node.type === 'work') {
    return String(d.name ?? d.label ?? '作品')
  }
  if (node.type === 'frame') {
    return String(d.name || s.frameTitle || '融合板')
  }
  if (node.type === 'audioFolder') {
    return String(d.name ?? s.audioFolderTitle ?? '音频创作夹')
  }
  return String(d.label ?? d.name ?? d.title ?? d.fileName ?? node.type)
}


export default function DetailPanel({ lang, node, nodes, onClose, onSelectNode }: Props) {
  const s = strings[lang]

  if (!node) {
    const visible = (nodes ?? []).filter(n => n.visible)
    const frames = visible.filter(n => n.type === 'frame')
    const folders = visible.filter(n => n.type === 'audioFolder')
    const demos = visible.filter(n => n.type === 'direction' && !!(n.data as any).demo)
    const works = visible.filter(n => n.type === 'work')
    // All other cards (including image, audio, text, lyrics, and also demos/works) for small rack
    // Big rack = frames + folders (1 per row), Small rack = everything else (2 per row)
    const smallNodes = visible.filter(n => n.type !== 'frame' && n.type !== 'audioFolder')
    const total = visible.length

    const getFrameMats = (frame: CanvasNode) => visible.filter(m =>
      ['image','audio','text'].includes(m.type) &&
      m.x + m.w/2 > frame.x && m.x + m.w/2 < frame.x + FRAME_CANVAS_W &&
      m.y + m.h/2 > frame.y && m.y + m.h/2 < frame.y + frame.h
    )

    return (
      <div style={{
        width: 300, flexShrink: 0,
        background: '#141414',
        borderLeft: '1px solid #26262A',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          height: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center', padding: '0 14px',
          borderBottom: '1px solid #26262A',
          background: '#131312',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#7A7A76', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {lang === 'zh' ? '机架总览' : 'Rack Overview'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight:700, color:'#8A8AFF', background:'#6B6EF518', border:'1px solid #6B6EF530', borderRadius:10, padding:'2px 7px' }}>
            {total} {lang === 'zh' ? '块磁贴' : 'tiles'}
          </span>
        </div>

        <div style={{ flex: 1, overflowY:'auto', padding:'12px', display:'flex', flexDirection:'column', gap:16 }} className="thin-scroll">


          {/* 大横条：黑板 + 创作夹 */}
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:'#7A7A86', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:8 }}>
              {lang==='zh' ? '黑板与创作夹' : 'Boards & Folders'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {frames.length===0 && folders.length===0 ? (
                <div style={{ padding:'14px', textAlign:'center', fontSize:10.5, color:'#3A3A38', background:'#1A1A19', border:'1px dashed #2C2C2A', borderRadius:8 }}>
                  {lang==='zh' ? '暂无黑板或创作夹' : 'No boards or folders'}
                </div>
              ) : (
                <>
                  {frames.map(frame => {
                    const mats = getFrameMats(frame)
                    const demosInFrame = (frame.data.demos as any[] | undefined)?.length ?? 0
                    const name = String(frame.data.name || (lang==='zh' ? '融合板' : 'Fusion Board'))
                    return (
                      <button key={frame.id} onClick={()=>onSelectNode?.(frame.id)}
                        style={{
                          width:'100%', textAlign:'left', cursor:'pointer',
                          display:'flex', flexDirection:'column', gap:6,
                          padding:'10px 11px', borderRadius:9,
                          background:'linear-gradient(135deg,#1A1A22,#141418)', border:'1px solid #2A2A34',
                          borderLeft:'3px solid #6B6EF5', boxShadow:'0 4px 16px rgba(0,0,0,0.22)', position:'relative', overflow:'hidden',
                        }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ width:7, height:7, borderRadius:'50%', background:'#6B6EF5', boxShadow:'0 0 6px #6B6EF590', flexShrink:0 }} />
                          <span style={{ flex:1, fontSize:11, fontWeight:700, color:'#D6D5E6', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
                          <span style={{ fontSize:8.5, fontWeight:700, color:'#6B6EF5', background:'#6B6EF514', border:'1px solid #6B6EF528', borderRadius:10, padding:'1px 6px' }}>{mats.length} {lang==='zh' ? '素材' : 'mats'} · {demosInFrame} Demo</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, minHeight:12, flexWrap:'wrap' }}>
                          {mats.length===0 ? (
                            <span style={{ fontSize:9, color:'#3A3A38' }}>{lang==='zh' ? '空' : 'empty'}</span>
                          ) : mats.slice(0,12).map(m => {
                            const col = nodeThemeColor(m)
                            return <span key={m.id} title={getRackTitle(m, s)} style={{ width:22, height:8, borderRadius:3, background:col, opacity:0.85, border:`1px solid ${col}60` }} />
                          })}
                          {mats.length>12 && <span style={{ fontSize:8, color:'#5A5A56' }}>+{mats.length-12}</span>}
                        </div>
                      </button>
                    )
                  })}
                  {folders.map(folder => {
                    const sources = (folder.data.sources as any[] | undefined) ?? []
                    const worksInFolder = (folder.data.works as any[] | undefined)?.length ?? 0
                    return (
                      <button key={folder.id} onClick={()=>onSelectNode?.(folder.id)}
                        style={{
                          width:'100%', textAlign:'left', cursor:'pointer',
                          display:'flex', flexDirection:'column', gap:6,
                          padding:'10px 11px', borderRadius:9,
                          background:'linear-gradient(135deg,#1C1828,#14141E)', border:'1px solid #2A253A',
                          borderLeft:'3px solid #8A7CFF', boxShadow:'0 4px 16px rgba(0,0,0,0.22)',
                        }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ width:14, height:10, borderRadius:3, background:'#8A7CFF', opacity:0.9, flexShrink:0, display:'grid', placeItems:'center', fontSize:6, color:'#fff' }}>▦</span>
                          <span style={{ flex:1, fontSize:11, fontWeight:700, color:'#D6D5E6', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(folder.data.name ?? (lang==='zh' ? '音频创作夹' : 'Audio Folder'))}</span>
                          <span style={{ fontSize:8.5, fontWeight:700, color:'#8A7CFF', background:'#8A7CFF14', border:'1px solid #8A7CFF28', borderRadius:10, padding:'1px 6px' }}>{sources.length} {lang==='zh' ? '来源' : 'src'} · {worksInFolder} {lang==='zh' ? '作品' : 'works'}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                          {sources.length===0 ? (
                            <span style={{ fontSize:9, color:'#3A3A38' }}>{lang==='zh' ? '空' : 'empty'}</span>
                          ) : sources.slice(0,8).map((s:any) => (
                            <span key={s.id} title={s.name} style={{ width:22, height:8, borderRadius:3, background:String(s.color ?? '#8A7CFF'), opacity:0.9, border:`1px solid ${String(s.color ?? '#8A7CFF')}60` }} />
                          ))}
                          {sources.length>8 && <span style={{ fontSize:8, color:'#5A5A56' }}>+{sources.length-8}</span>}
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* 小横条：全部磁贴（2块/条，精简为表头） */}
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:'#7A7A86', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:8 }}>
              {lang==='zh' ? '全部磁贴' : 'All Tiles'}
            </div>
            {smallNodes.length===0 ? (
              <div style={{ padding:'14px', textAlign:'center', fontSize:10.5, color:'#3A3A38', background:'#1A1A19', border:'1px dashed #2C2C2A', borderRadius:8 }}>
                {lang==='zh' ? '暂无磁贴' : 'No tiles'}
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:6 }}>
                {smallNodes.map(n => {
                  const isDemo = n.type==='direction' && !!(n.data as any).demo
                  const isWork = n.type==='work'
                  const col = nodeThemeColor(n)
                  const accent = isWork ? String((n.data as any).accent ?? '#42D9D0') : col
                  const name = getRackTitle(n, s)
                  const hasLyrics = !!(n.data as any).lyrics || !!((n.data as any).recipe as any)?.lyrics
                  let bg: string
                  let border: string
                  let badge: string
                  let badgeColor: string
                  if (isDemo) {
                    bg = '#191918'
                    border = `1px solid ${col}35`
                    badge = 'Demo'
                    badgeColor = col
                  } else if (isWork) {
                    bg = `radial-gradient(circle at 92% 6%,${accent}28,transparent 34%),radial-gradient(circle at 4% 100%,${col}28,transparent 42%),#15151B`
                    border = `1px solid ${col}55`
                    badge = String((n.data as any).mode ?? 'remix').toUpperCase()
                    badgeColor = accent
                  } else if (n.type==='image') {
                    bg = '#191918'
                    border = `1px solid ${col}35`
                    badge = 'IMG'
                    badgeColor = col
                  } else if (n.type==='audio') {
                    const isRef = !!(n.data as any).isRef
                    bg = '#191918'
                    border = `1px solid ${col}35`
                    badge = isRef ? 'REF' : 'HUM'
                    badgeColor = col
                  } else if (n.type==='lyrics') {
                    bg = '#191918'
                    border = `1px solid ${col}35`
                    badge = 'LYRICS'
                    badgeColor = col
                  } else if (n.type==='text') {
                    bg = '#191918'
                    border = `1px solid ${col}35`
                    badge = 'TEXT'
                    badgeColor = col
                  } else {
                    bg = '#191918'
                    border = `1px solid ${col}30`
                    badge = n.type.toUpperCase()
                    badgeColor = col
                  }
                  return (
                    <button key={n.id} onClick={()=>onSelectNode?.(n.id)}
                      title={hasLyrics ? (lang==='zh' ? '含歌词 · 点击选中' : 'Has lyrics · click to select') : (lang==='zh' ? '点击选中' : 'Click to select')}
                      style={{
                        height:30, display:'flex', alignItems:'center', gap:5, padding:'0 7px',
                        background: bg, border: border, borderTop: `2px solid ${col}`, borderRadius:8,
                        textAlign:'left', cursor:'pointer', overflow:'hidden',
                      }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:col, boxShadow:`0 0 5px ${col}80`, flexShrink:0 }} />
                      <span style={{ flex:1, minWidth:0, fontSize:9.5, fontWeight:600, color:'#E8E8E6', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name.slice(0,14) || n.type}</span>
                      {hasLyrics && <span style={{ fontSize:7.5, fontWeight:700, color:'#E56B8A', background:'#E56B8A12', border:'1px solid #E56B8A28', borderRadius:10, padding:'1px 5px', flexShrink:0 }}>词</span>}
                      <span style={{ fontSize:7, fontWeight:800, color:badgeColor, background:`${badgeColor}12`, border:`1px solid ${badgeColor}38`, borderRadius:10, padding:'1px 5px', flexShrink:0 }}>{badge}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ fontSize:9, color:'#3A3A38', textAlign:'center', lineHeight:1.5, paddingTop:4 }}>
            {lang==='zh' ? '点击任意机架块可在画布上选中对应磁贴' : 'Click any rack block to select its tile on canvas'}
          </div>
        </div>
      </div>
    )
  }
  const d: any = node.data
  const recipe = d.recipe as {
    mats: { name: string; weight: number; kind: string; isRef: boolean; fileName?: string }[]
    mode: string; vocal: string; timeSig: string; negative: string; prompt?: string; lyrics?: string
  } | undefined
  const isWork = node.type === 'work' || !!d.fullTrack
  const workSources = (d.sources as Array<{ id: string; name: string; kind: string; color: string; duration?: string; fileName?: string }> | undefined) ?? []
  const modeBadge = isWork ? String(d.mode ?? 'remix').toUpperCase() : s.demo30
  const rawLyrics = (d.lyrics as string | undefined) || (recipe?.lyrics as string | undefined) || undefined
  const fallbackLyrics = !rawLyrics && typeof d.usedPrompt === 'string' && String(d.usedPrompt).includes('歌词：')
    ? String(d.usedPrompt).split('歌词：').slice(1).join('歌词：').trim().split('\nVariation')[0].trim() || undefined
    : undefined
  const lyricsText = rawLyrics || fallbackLyrics

  const kindIcon = (k: string, isRef: boolean) => k === 'image' ? '🖼' : k === 'text' ? 'T' : isRef ? '🔗' : '🎤'
  const sourceKind = (k: string) => k === 'demo' ? '30s DEMO' : k === 'reference' ? '参考音频' : k === 'hum' ? '哼唱片段' : k.toUpperCase()

  return (
    <div style={{
      width: 300, flexShrink: 0,
      background: '#161615',
      borderLeft: '1px solid #2C2C2A',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 14px 12px', flexShrink: 0,
        borderBottom: '1px solid #242422',
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#131312',
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: String(d.color ?? '#3BBDAF'), boxShadow: `0 0 10px ${String(d.color ?? '#3BBDAF')}80`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#F0F0EE', letterSpacing: '-0.02em', display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
            <span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(d.name)}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, color: String(d.color),
              border: `1px solid ${String(d.color)}45`, borderRadius: 8, padding: '1px 6px', verticalAlign: 'middle', flexShrink:0,
            }}>{modeBadge}</span>
            {lyricsText && (
              <span title="含歌词" style={{
                fontSize:9, fontWeight:600, flexShrink:0,
                color:'#E56B8A', background:'#E56B8A12', border:'1px solid #E56B8A28',
                borderRadius:12, padding:'2px 7px',
              }}>词</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#4A4A48', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isWork ? `${modeBadge} · ${s.usedPromptL}` : `${s.recipeL} · ${s.usedPromptL}`}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose}
            title={lang === 'zh' ? '取消选中' : 'Deselect'}
            style={{
              width: 26, height: 26, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#222220', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#5A5A56',
            }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }} className="thin-scroll">
        {(d.mood || d.style || d.texture || d.rhythm) ? (
          <Section title={`${s.creativeDNA}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.mood ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#5A5A56' }}>{s.mood}</span>
                  <span style={{ color: '#C0C0BC', fontWeight: 500 }}>{String(d.mood)}</span>
                </div>
              ) : null}
              {d.style ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#5A5A56' }}>{s.style}</span>
                  <span style={{ color: '#C0C0BC', fontWeight: 500 }}>{String(d.style)}</span>
                </div>
              ) : null}
              {d.texture ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#5A5A56' }}>{s.texture}</span>
                  <span style={{ color: '#C0C0BC', fontWeight: 500 }}>{String(d.texture)}</span>
                </div>
              ) : null}
              {d.rhythm ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#5A5A56' }}>{s.rhythm}</span>
                  <span style={{ color: '#C0C0BC', fontWeight: 500 }}>{String(d.rhythm)}</span>
                </div>
              ) : null}
              {d.energy != null ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#5A5A56' }}>{s.energy}</span>
                  <span style={{ color: '#C0C0BC', fontFamily: "'JetBrains Mono',monospace" }}>{String(d.energy)}%</span>
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {recipe ? (
          <>
            <Section title={`${s.panelTitle} · ${s.recipeL}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {recipe.mats.map(m => (
                  <div key={m.name}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <span style={{
                        width: 17, height: 17, borderRadius: 4, fontSize: 9, flexShrink: 0,
                        background: '#1E1E1C', border: '1px solid #2C2C2A',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {kindIcon(m.kind, m.isRef)}
                      </span>
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 11, color: '#C0C0BC',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#8A8AFF', fontFamily: "'JetBrains Mono',monospace" }}>{m.weight}%</span>
                    </div>
                    <div style={{ height: 4, background: '#222220', borderRadius: 2, marginLeft: 24 }}>
                      <div style={{ width: `${m.weight}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#6B6EF5,#9B7EFF)', opacity: 0.85 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                <KV k={s.modeL} v={recipe.mode === 'inst' ? s.modeInst : s.modeSong} c="#3BBDAF" />
                {recipe.mode !== 'inst' && <KV k={s.vocalL} v={recipe.vocal === 'male' ? s.male : s.female} c="#F5A523" />}
                <KV k={s.timeSignature} v={recipe.timeSig} c="#9B7EFF" />
              </div>
              {recipe.negative && (
                <div style={{ marginTop: 10, padding: '7px 10px', background: '#161010', border: '1px solid #2E1E20', borderRadius: 7 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#E06A5A90', marginRight: 6 }}>🚫 {s.negativeL}</span>
                  <span style={{ fontSize: 10.5, color: '#D8A8A0' }}>{recipe.negative}</span>
                </div>
              )}
              {recipe.prompt && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#0F0F14', border: '1px solid #23233A', borderRadius: 7 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#7A7A86', marginBottom: 4, letterSpacing: '0.04em' }}>{s.promptL}</div>
                  <div style={{ fontSize: 10.5, color: '#9A9AC0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{recipe.prompt}</div>
                </div>
              )}
            </Section>
            <div style={{ height: 1, background: '#222220' }} />
          </>
        ) : isWork ? (
          <Section title={`${s.sourceTracks}`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
              {workSources.map(source => (
                <div key={source.id} style={{ minWidth: 0, borderRadius: 9, overflow: 'hidden', border: `1px solid ${source.color}35`, background: `linear-gradient(145deg,${source.color}13,#121216)` }}>
                  <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 7, padding: '0 9px', borderTop: `2px solid ${source.color}`, borderBottom: '1px solid #ffffff0C' }}>
                    <span style={{ color: source.color, fontSize: 10 }}>♫</span>
                    <strong style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: '#D6D5DE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.name}</strong>
                    <span style={{ fontSize: 7.5, fontWeight: 800, color: source.color }}>{sourceKind(source.kind)}</span>
                  </div>
                  <div style={{ padding: '9px', display: 'flex', alignItems: 'center', gap: 3, height: 42 }}>
                    {Array.from({ length: 16 }, (_, i) => <span key={i} style={{ width: 2, height: 4 + ((i * 13) % 20), borderRadius: 2, background: source.color, opacity: .4 + (i % 4) * .12 }} />)}
                    {source.duration && <span style={{ marginLeft: 'auto', fontSize: 8.5, color: '#686674', fontFamily: "'JetBrains Mono',monospace" }}>{source.duration}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section title={`${s.panelTitle} · ${s.recipeL}`}>
            <div style={{ padding: '10px 12px', background: '#141413', border: '1px dashed #2A2A28', borderRadius: 8, fontSize: 10.5, color: '#5A5A56', lineHeight: 1.6 }}>
              暂无控制台快照。请在黑板控制台调整比重/形态/人声/拍号后重新「{s.divergeBtn}」，新生成的 Demo 将在此处回显当时的控制台参数。
            </div>
          </Section>
        )}

        {lyricsText && (
          <Section title={`${s.lyricsSection}`}>
            <pre style={{
              margin: 0, padding: '12px 14px', background: '#141413',
              border: '1px solid #2A1E20', borderLeft: '3px solid #E53935',
              borderRadius: 7, fontSize: 11, lineHeight: 1.85,
              color: '#E8C4C0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: "'Inter',sans-serif",
            }}>{lyricsText}</pre>
          </Section>
        )}

        <Section title={`${s.usedPromptL}`}>
          <pre style={{
            margin: 0, padding: '12px 14px', background: '#0F0F14',
            border: '1px solid #23233A', borderRadius: 9, fontSize: 11, lineHeight: 1.9,
            color: '#B8BAE0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{String(d.usedPrompt ?? '')}</pre>
        </Section>
            </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 9.5, fontWeight: 800, color: '#7A7A86', textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 9,
      }}>{title}</div>
      {children}
    </div>
  )
}

function KV({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
      borderRadius: 6, background: c + '10', border: `1px solid ${c}28`,
    }}>
      <span style={{ fontSize: 9, color: '#5A5A56' }}>{k}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{v}</span>
    </span>
  )
}
