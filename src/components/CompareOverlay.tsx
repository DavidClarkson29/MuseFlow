import type { Lang } from '../i18n'
import { strings } from '../i18n'
import type { CanvasNode } from '../types'

interface Props {
  lang: Lang
  dirs: CanvasNode[]
  onClose: () => void
  onKeep: (id: string) => void
  onArchive: (id: string) => void
  onFuse: (a: string, b: string) => void
}

export default function CompareOverlay({ lang, dirs, onClose, onKeep, onArchive, onFuse }: Props) {
  const s = strings[lang]
  const [a, b] = dirs

  const rows = [
    { label: s.mood,        get: (d: CanvasNode) => String(d.data.mood ?? '—') },
    { label: s.energy,      get: (d: CanvasNode) => `${d.data.energy as number}%` },
    { label: s.rhythm,      get: (d: CanvasNode) => String(d.data.rhythm ?? '—') },
    { label: s.texture,     get: (d: CanvasNode) => String(d.data.texture ?? '—') },
    { label: s.style,       get: (d: CanvasNode) => String(d.data.style ?? '—') },
  ]
  const isDiff = (va: string, vb: string) => va.trim() !== vb.trim()

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.62)', display:'flex',
        alignItems:'center', justifyContent:'center', zIndex:80, backdropFilter:'blur(4px)' }}>
      <div className="inspector-appear" onClick={e=>e.stopPropagation()}
        style={{ background:'#1A1A19', border:'1px solid #2C2C2A', borderRadius:14,
          width:640, maxHeight:'84vh',
          boxShadow:'0 32px 80px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid #242422',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#F0F0EE', letterSpacing:'-0.02em' }}>
              {s.compareTitle} · {s.convergeHint}
            </div>
            <div style={{ fontSize:11, color:'#4A4A48', marginTop:2 }}>
              {s.whatChanged}? <span style={{ color:'#3A3A38' }}>— {s.convergeHint === s.convergeHint ? '' : ''}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
            background:'#222220', border:'none', borderRadius:7, cursor:'pointer', color:'#5A5A56' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:14 }} className="thin-scroll">
          {/* §19 差异聚焦：相同弱化 / 不同放大 */}
          <div style={{ border:'1px solid #222220', borderRadius:10, overflow:'hidden' }}>
            {rows.map((r, ri) => {
              const va = r.get(a), vb = r.get(b)
              const diff = isDiff(va, vb)
              return (
                <div key={ri} style={{ display:'flex', alignItems:'center',
                  padding:'8px 12px', borderTop: ri ? '1px solid #1E1E1C' : 'none',
                  background: diff ? 'rgba(107,110,245,0.05)' : 'transparent' }}>
                  <span style={{ fontSize:10, width:90, flexShrink:0, color:'#5A5A56' }}>{r.label}</span>
                  <span style={{ flex:1, fontSize: diff ? 12 : 11, fontWeight: diff ? 700 : 400,
                    color: diff ? '#E8E8F4' : '#4A4A48',
                    background: diff ? 'rgba(107,110,245,0.10)' : 'transparent',
                    borderRadius:5, padding: diff ? '3px 8px' : '3px 0', marginRight:6 }}>
                    {a.data.label as string} · {va}
                  </span>
                  <span style={{ flex:1, fontSize: diff ? 12 : 11, fontWeight: diff ? 700 : 400,
                    color: diff ? '#E8E8F4' : '#4A4A48',
                    background: diff ? 'rgba(240,96,144,0.10)' : 'transparent',
                    borderRadius:5, padding: diff ? '3px 8px' : '3px 0' }}>
                    {b.data.label as string} · {vb}
                  </span>
                  {diff && <span style={{ fontSize:8, fontWeight:800, color:'#6B6EF5',
                    padding:'1px 6px', borderRadius:8, background:'#6B6EF518', marginLeft:8, flexShrink:0 }}>
                    {s.whatChanged}
                  </span>}
                </div>
              )
            })}
          </div>

          {/* §20 Trade-off View */}
          <div style={{ padding:'12px 14px', background:'#141413', border:'1px solid #222220', borderRadius:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:10, fontWeight:800, color:'#8A8AFF', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                {s.tradeoffTitle}
              </span>
              <span style={{ fontSize:8.5, fontWeight:700, color:'#5A5A56', padding:'2px 8px',
                borderRadius:10, border:'1px dashed #3A3A44' }}>{s.tradeoffDisclaim}</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1, padding:'8px 10px', borderRadius:8, background:'rgba(245,165,35,0.05)',
                border:'1px solid rgba(245,165,35,0.18)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#F5C87A', marginBottom:4 }}>
                  {s.choosingA} ({String(a.data.label)})
                </div>
                <div style={{ fontSize:10.5, color:'#C0B8A8', lineHeight:1.6 }}>{s.toA1}</div>
              </div>
              <div style={{ flex:1, padding:'8px 10px', borderRadius:8, background:'rgba(240,96,144,0.05)',
                border:'1px solid rgba(240,96,144,0.18)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#F58FB2', marginBottom:4 }}>
                  {s.choosingB} ({String(b.data.label)})
                </div>
                <div style={{ fontSize:10.5, color:'#D8B8C2', lineHeight:1.6 }}>{s.toB1}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid #1E1E1C', display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={()=>onKeep(a.id)} style={miniBtn('#5EC96E')}>✓ {s.keepBtn} {String(a.data.label)}</button>
          <button onClick={()=>onKeep(b.id)} style={miniBtn('#5EC96E')}>✓ {s.keepBtn} {String(b.data.label)}</button>
          <button onClick={()=>onArchive(a.id)} style={miniBtn('#5A5A56')}>{s.archiveBtn} {String(a.data.label)}</button>
          <button onClick={()=>onArchive(b.id)} style={miniBtn('#5A5A56')}>{s.archiveBtn} {String(b.data.label)}</button>
          <button onClick={()=>onFuse(a.id, b.id)}
            style={{ flex:1.2, padding:'9px', background:'linear-gradient(135deg,#F06090,#E14D7B)',
              border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer',
              fontFamily:"'Inter',sans-serif" }}>
            ⊕ {s.actFuse} · {String(a.data.label)} + {String(b.data.label)}
          </button>
        </div>
      </div>
    </div>
  )
}

function miniBtn(color: string): React.CSSProperties {
  return { flex:1, padding:'9px 4px', background:color+'15', border:`1px solid ${color}35`,
    borderRadius:8, color, fontSize:10.5, fontWeight:700, cursor:'pointer',
    whiteSpace:'nowrap', fontFamily:"'Inter',sans-serif" }
}
