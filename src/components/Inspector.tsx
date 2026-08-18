import { useState } from 'react'
import type { CanvasNode } from '../types'
import { useLang } from '../App'

interface Props {
  node: CanvasNode
  onClose: () => void
}

export default function Inspector({ node, onClose }: Props) {
  const s = useLang()

  const title = (() => {
    switch (node.type) {
      case 'image':     return node.data.label as string
      case 'audio':     return node.data.label as string
      case 'text':      return s.hdrText
      case 'mood':      return s.hdrMood
      case 'explore':   return s.aiExplore
      case 'direction': return `${s.directionLabel} ${node.data.label} — ${node.data.name}`
      case 'fuse':      return s.fuseNodeName
      case 'brief':     return s.hdrBrief
      case 'result':    return s.hdrResult
      default:          return node.id
    }
  })()

  return (
    <div
      style={{
        position:'fixed', inset:0,
        background:'rgba(0,0,0,0.55)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:50,
        backdropFilter:'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="inspector-appear"
        onClick={e => e.stopPropagation()}
        style={{
          background:'#1A1A19',
          border:'1px solid #2C2C2A',
          borderRadius:14,
          width:420,
          maxHeight:'80vh',
          overflow:'hidden',
          boxShadow:'0 32px 80px rgba(0,0,0,0.6)',
          display:'flex',
          flexDirection:'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding:'14px 16px',
          borderBottom:'1px solid #242422',
          display:'flex', alignItems:'center', gap:10,
          flexShrink:0,
        }}>
          <NodeBadge node={node}/>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#F0F0EE', letterSpacing:'-0.02em' }}>
              {title}
            </div>
            <div style={{ fontSize:11, color:'#4A4A48', marginTop:1 }}>
              {node.type} · {s.dblClickInspect}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft:'auto', width:28, height:28,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'transparent', border:'none',
              borderRadius:7, cursor:'pointer', color:'#5A5A56',
              fontFamily:"'Inter',sans-serif",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
          <NodeDetail node={node}/>
        </div>
      </div>
    </div>
  )
}

function NodeBadge({ node }: { node: CanvasNode }) {
  const { color, icon } = getNodeMeta(node)
  return (
    <div style={{
      width:36, height:36, borderRadius:9, flexShrink:0,
      background: color + '18',
      border: `1.5px solid ${color}40`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:16,
    }}>
      {icon}
    </div>
  )
}

function getNodeMeta(node: CanvasNode): { color: string; icon: string } {
  switch (node.type) {
    case 'image':     return { color:'#3BBDAF', icon:'🖼' }
    case 'audio':     return { color:'#F5A523', icon: (node.data.isRef ? '🔗' : '🎤') as string }
    case 'text':      return { color:'#6B6EF5', icon:'T' }
    case 'mood':      return { color:'#9B7EFF', icon:'✦' }
    case 'explore':   return { color:'#6B6EF5', icon:'⬡' }
    case 'direction': return { color: node.data.color as string, icon:'◈' }
    case 'fuse':      return { color:'#F06090', icon:'⊕' }
    case 'brief':     return { color:'#3BBDAF', icon:'↗' }
    case 'result':    return { color:'#3BBDAF', icon:'✦' }
    default:          return { color:'#5A5A56', icon:'·' }
  }
}

function NodeDetail({ node }: { node: CanvasNode }) {
  switch (node.type) {
    case 'direction': return <DirectionDetail node={node}/>
    case 'result':    return <ResultDetail node={node}/>
    case 'explore':   return <ExploreDetail node={node}/>
    case 'fuse':      return <FuseDetail node={node}/>
    case 'audio':     return <AudioDetail node={node}/>
    case 'mood':      return <MoodDetail node={node}/>
    case 'text':      return <TextDetail node={node}/>
    default:          return <GenericDetail node={node}/>
  }
}

// ── Direction detail ──────────────────────────────────────────────────────────

function DirectionDetail({ node }: { node: CanvasNode }) {
  const s = useLang()
  const d = node.data
  const color = d.color as string
  const [energy, setEnergy] = useState(d.energy as number)
  const [locked, setLocked] = useState<Record<string,boolean>>({})

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Section title={s.creativeDNA}>
        {[
          { key:'mood',    label:s.mood,    value:d.mood    as string },
          { key:'style',   label:s.style,   value:d.style   as string },
          { key:'texture', label:s.texture, value:d.texture as string },
          { key:'rhythm',  label:s.rhythm,  value:d.rhythm  as string },
        ].map(({ key, label, value }) => (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
            <LockBtn locked={!!locked[key]} onToggle={()=>setLocked(p=>({...p,[key]:!p[key]}))}/>
            <span style={{ fontSize:11, color:'#5A5A56', flex:1 }}>{label}</span>
            <span style={{ fontSize:11, color:'#C0C0BC', fontWeight:500 }}>{value}</span>
          </div>
        ))}
        <div style={{ padding:'4px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:11, color:'#5A5A56' }}>{s.energy}</span>
            <span style={{ fontSize:11, color:'#C0C0BC', fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>{energy}%</span>
          </div>
          <input type="range" min={0} max={100} value={energy}
            onChange={e=>setEnergy(Number(e.target.value))}
            style={{ width:'100%' }}
          />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
            <span style={{ fontSize:9, color:'#3A3A38' }}>{s.relaxed}</span>
            <span style={{ fontSize:9, color:'#3A3A38' }}>{s.intense}</span>
          </div>
        </div>
      </Section>

      <Section title={s.toneAxes}>
        <ToneAxis label={s.acoustic}  rightLabel={s.electronic}   value={38} color={color}/>
        <ToneAxis label={s.familiar}  rightLabel={s.experimental} value={30} color={color}/>
        <ToneAxis label={s.darkLabel} rightLabel={s.brightLabel}  value={28} color={color}/>
      </Section>

      <Section title={s.instrumentation}>
        <div style={{ fontSize:11, color:'#8A8A86', lineHeight:1.7 }}>
          {d.instrumentation as string}
        </div>
      </Section>

      {d.lyrics && <LyricsSection lyrics={d.lyrics as string} color={color}/>}

      <Section title={s.tags}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {(d.tags as string[]).map(t => (
            <span key={t} style={{
              fontSize:11, fontWeight:600, padding:'3px 9px',
              background: color + '18', border:`1px solid ${color}30`,
              borderRadius:20, color,
            }}>{t}</span>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── Result detail ──────────────────────────────────────────────────────────────

function ResultDetail({ node }: { node: CanvasNode }) {
  const s = useLang()
  const d = node.data

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Section title={s.trackInfo}>
        <InfoRow label="BPM" value={String(d.bpm as number)}/>
        <InfoRow label="Key" value={d.key as string}/>
        <InfoRow label={s.durationLabel} value={d.duration as string}/>
        <InfoRow label={s.formatLabel} value="Lossless WAV"/>
      </Section>

      {d.lyrics && <LyricsSection lyrics={d.lyrics as string} color="#3BBDAF"/>}
    </div>
  )
}

// ── Explore detail ─────────────────────────────────────────────────────────────

function ExploreDetail({ node }: { node: CanvasNode }) {
  const s = useLang()
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Section title={s.connectedInputs}>
        {node.inputs.map(p => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }}/>
            <span style={{ fontSize:11, color:'#8A8A86' }}>{p.label}</span>
            <span style={{ marginLeft:'auto', fontSize:10, color:'#3A3A38' }}>{s.connected}</span>
          </div>
        ))}
      </Section>
      <Section title={s.outputDirections}>
        {node.outputs.map(p => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }}/>
            <span style={{ fontSize:11, color:'#8A8A86' }}>{p.label}</span>
            <span style={{ marginLeft:'auto', fontSize:10, color: node.state === 'done' ? '#5EC96E' : '#3A3A38' }}>
              {node.state === 'done' ? s.generatedState : s.pendingState}
            </span>
          </div>
        ))}
      </Section>
    </div>
  )
}

// ── Fuse detail ────────────────────────────────────────────────────────────────

function FuseDetail({ node }: { node: CanvasNode }) {
  const s = useLang()
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Section title={s.howToUse}>
        <div style={{ fontSize:11, color:'#8A8A86', lineHeight:1.7 }}>{s.fuseConnect}</div>
      </Section>
      <Section title={s.inputSlots}>
        {node.inputs.map(p => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', border:`2px solid ${p.color}` }}/>
            <span style={{ fontSize:11, color:'#8A8A86' }}>{p.label}</span>
            <span style={{ marginLeft:'auto', fontSize:10, color:'#3A3A38' }}>{s.fuseOpen}</span>
          </div>
        ))}
      </Section>
    </div>
  )
}

// ── Audio detail ───────────────────────────────────────────────────────────────

function AudioDetail({ node }: { node: CanvasNode }) {
  const s = useLang()
  const typeVal = node.data.isRef ? s.refTrack : node.data.isHum ? s.humRec : s.nodeAudioDesc
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <InfoRow label={s.nameLabel} value={node.data.label as string}/>
      <InfoRow label={s.durationLabel} value={node.data.duration as string}/>
      <InfoRow label={s.typeLabel} value={typeVal}/>
    </div>
  )
}

// ── Mood detail ────────────────────────────────────────────────────────────────

function MoodDetail({ node }: { node: CanvasNode }) {
  const tags = node.data.tags as string[]
  const colors = ['#F5A523','#E14D7B','#3BBDAF','#9B7EFF']
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
      {tags.map((t,i) => (
        <span key={t} style={{
          fontSize:12, fontWeight:600, padding:'4px 12px',
          background: colors[i%colors.length] + '18',
          border:`1px solid ${colors[i%colors.length]}30`,
          borderRadius:20, color: colors[i%colors.length],
        }}>{t}</span>
      ))}
    </div>
  )
}

// ── Text detail ────────────────────────────────────────────────────────────────

function TextDetail({ node }: { node: CanvasNode }) {
  return (
    <div style={{ fontSize:13, color:'#C0C0BC', fontStyle:'italic', lineHeight:1.7 }}>
      "{node.data.content as string}"
    </div>
  )
}

// ── Generic detail ─────────────────────────────────────────────────────────────

function GenericDetail({ node }: { node: CanvasNode }) {
  return (
    <div style={{ fontSize:11, color:'#5A5A56' }}>
      Node type: {node.type}<br/>
      ID: {node.id}
    </div>
  )
}

// ── Lyrics section ─────────────────────────────────────────────────────────────

function LyricsSection({ lyrics, color }: { lyrics: string; color: string }) {
  const s = useLang()
  return (
    <Section title={s.lyricsSection}>
      <pre style={{
        margin:0, fontSize:12, color:'#B8B8B4', lineHeight:2,
        whiteSpace:'pre-wrap', wordBreak:'break-word',
        background:'#141413', border:'1px solid #222220',
        borderRadius:7, padding:'12px 14px',
        borderLeft:`3px solid ${color}60`,
        fontFamily:"'Inter',sans-serif",
      }}>{lyrics}</pre>
    </Section>
  )
}

// ── Shared components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:9, fontWeight:700, color:'#3A3A38', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>
        {title}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between' }}>
      <span style={{ fontSize:11, color:'#5A5A56' }}>{label}</span>
      <span style={{ fontSize:11, color:'#C0C0BC', fontWeight:500 }}>{value}</span>
    </div>
  )
}

function LockBtn({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button onClick={(e)=>{ e.stopPropagation(); onToggle() }} style={{
      width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center',
      background: locked ? '#6B6EF520' : '#1E1E1C',
      border:`1px solid ${locked ? '#6B6EF540' : '#2C2C2A'}`,
      borderRadius:4, cursor:'pointer', color: locked ? '#6B6EF5' : '#3A3A38',
      flexShrink:0, fontFamily:"'Inter',sans-serif",
    }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill={locked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d={locked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1'}/>
      </svg>
    </button>
  )
}

function ToneAxis({ label, rightLabel, value, color }: { label: string; rightLabel: string; value: number; color: string }) {
  const [val, setVal] = useState(value)
  return (
    <div style={{ padding:'4px 0' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:10, color:'#4A4A48' }}>{label}</span>
        <span style={{ fontSize:10, color:'#4A4A48' }}>{rightLabel}</span>
      </div>
      <input type="range" min={0} max={100} value={val}
        onChange={e=>setVal(Number(e.target.value))}
        style={{ width:'100%', accentColor: color }}
      />
    </div>
  )
}
