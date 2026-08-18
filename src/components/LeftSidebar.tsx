import { useState } from 'react'
import type { CanvasNode } from '../types'
import { useLang } from '../App'

interface Props {
  onAddNode: (type: string) => void
}

export default function LeftSidebar({ onAddNode }: Props) {
  const s = useLang()
  const [audioOpen, setAudioOpen] = useState(false)

  const SOURCE_ITEMS = [
    { type: 'image' as const, icon: '🖼', label: s.nodeImage, color: '#3BBDAF' },
    { type: 'mood'  as const, icon: '✦',  label: s.nodeMood,  color: '#9B7EFF' },
    { type: 'text'  as const, icon: 'T',  label: s.nodeText,  color: '#6B6EF5' },
  ]
  const PROCESS_ITEMS = [
    { type: 'explore' as const, icon: '⬡', label: s.nodeExplore, color: '#6B6EF5' },
    { type: 'fuse'    as const, icon: '⊕', label: s.nodeFuse,    color: '#F06090' },
    { type: 'brief'   as const, icon: '↗', label: s.nodeBrief,   color: '#3BBDAF' },
    { type: 'result'  as const, icon: '✦', label: s.nodeResult,  color: '#3BBDAF' },
  ]

  return (
    <div style={{
      position: 'absolute',
      left: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      width: 124,
      background: 'rgba(16,16,15,0.88)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(48,48,46,0.75)',
      borderRadius: 16,
      boxShadow: [
        '0 2px 6px rgba(0,0,0,0.3)',
        '0 12px 40px rgba(0,0,0,0.55)',
        '0 32px 80px rgba(0,0,0,0.3)',
        'inset 0 1px 0 rgba(255,255,255,0.05)',
      ].join(', '),
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Sources section */}
      <div style={{ padding: '11px 7px 7px' }}>
        <SectionLabel>{s.sources}</SectionLabel>

        {SOURCE_ITEMS.map(item => (
          <AddRow key={item.type} icon={item.icon} label={item.label} color={item.color}
            onClick={() => onAddNode(item.type)}/>
        ))}

        {/* Audio — accordion submenu */}
        <AddRow
          icon="🎵" label={s.nodeAudio} color="#F5A523"
          hasChevron active={audioOpen}
          onClick={() => setAudioOpen(o => !o)}
        />
        {audioOpen && (
          <div style={{ paddingLeft: 6, paddingBottom: 2 }}>
            <SubRow
              icon="🎤" label={s.addHumClip} color="#F5A523"
              onClick={() => { onAddNode('audio-hum'); setAudioOpen(false) }}
            />
            <SubRow
              icon="🔗" label={s.addRefAudio} color="#4BA35A"
              onClick={() => { onAddNode('audio-ref'); setAudioOpen(false) }}
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height:1, background:'rgba(48,48,46,0.7)', margin:'0 10px' }}/>

      {/* Process section */}
      <div style={{ padding: '7px 7px 11px' }}>
        <SectionLabel>{s.process}</SectionLabel>
        {PROCESS_ITEMS.map(item => (
          <AddRow key={item.type} icon={item.icon} label={item.label} color={item.color}
            onClick={() => onAddNode(item.type)}/>
        ))}
      </div>

      {/* Bottom hint */}
      <div style={{
        padding: '8px 10px 10px',
        borderTop: '1px solid rgba(48,48,46,0.6)',
        fontSize: 9, color: 'rgba(80,80,76,0.9)', lineHeight: 1.5, textAlign:'center',
      }}>
        {s.hint}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8, fontWeight: 700, color: 'rgba(70,70,66,0.9)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '0 6px 6px',
    }}>
      {children}
    </div>
  )
}

function AddRow({ icon, label, color, onClick, hasChevron, active }: {
  icon: string; label: string; color: string; onClick: () => void
  hasChevron?: boolean; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        width: '100%', padding: '4px 6px',
        background: active ? 'rgba(40,40,38,0.6)' : 'transparent',
        border: 'none', borderRadius: 7,
        cursor: 'pointer', textAlign: 'left',
        fontFamily: "'Inter',sans-serif",
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
        background: color + '18',
        border: `1px solid ${color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: color, fontWeight: 700,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)', lineHeight: 1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
        {label}
      </span>
      {hasChevron && (
        <span style={{ fontSize: 10, color: active ? color : '#5A5A56', flexShrink:0, transition:'color 0.15s, transform 0.15s', display:'inline-block', transform: active ? 'rotate(90deg)' : 'none' }}>›</span>
      )}
    </button>
  )
}

function SubRow({ icon, label, color, onClick }: {
  icon: string; label: string; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '3px 6px',
        background: 'transparent', border: 'none', borderRadius: 6,
        cursor: 'pointer', textAlign: 'left',
        fontFamily: "'Inter',sans-serif",
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        background: color + '15',
        border: `1px solid ${color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: color,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(140,140,134,0.85)', lineHeight: 1, whiteSpace:'nowrap' }}>
        {label}
      </span>
    </button>
  )
}
