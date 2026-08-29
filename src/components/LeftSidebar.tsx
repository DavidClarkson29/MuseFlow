import { useRef } from 'react'
import type { Lang } from '../i18n'
import { strings } from '../i18n'
import type { ImportKind } from '../storage/projectStore'

interface Props {
  lang: Lang
  onAddNode: (type: string) => void
  onAddFrame: () => void
  onImportFiles: (files:File[],kind:ImportKind) => void
  testMode: boolean
}

export default function LeftSidebar({ lang, onAddNode, onAddFrame, onImportFiles, testMode }: Props) {
  const s = strings[lang]
  const imageInputRef = useRef<HTMLInputElement>(null)
  const humInputRef = useRef<HTMLInputElement>(null)
  const refInputRef = useRef<HTMLInputElement>(null)

  const choose = (type:string) => {
    if (testMode && (type === 'image' || type === 'audio-hum' || type === 'audio-ref')) onAddNode(type)
    else if (type === 'image') imageInputRef.current?.click()
    else if (type === 'audio-hum') humInputRef.current?.click()
    else if (type === 'audio-ref') refInputRef.current?.click()
    else onAddNode(type)
  }

  const receive = (kind:ImportKind) => (e:React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) void onImportFiles(files,kind)
    e.target.value = ''
  }

  const CAPTURE = [
    { type: 'image' as const, icon: '🖼', label: s.nodeImage, color: '#3BBDAF' },
    { type: 'audio-hum' as const, icon: '🎤', label: s.addHumClip, color: '#F5A523' },
    { type: 'audio-ref' as const, icon: '🔗', label: s.addRefAudio, color: '#4BA35A' },
    { type: 'text' as const, icon: 'T', label: s.nodeText, color: '#6B6EF5' },
  ]

  return (
    <div style={{
      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
      zIndex: 10, width: 138,
      background: 'rgba(16,16,15,0.88)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(48,48,46,0.75)', borderRadius: 16,
      boxShadow: '0 2px 6px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', userSelect: 'none', overflow:'hidden',
    }}>
      <div style={{ padding: '11px 7px 7px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(70,70,66,0.9)',
          letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 6px 6px' }}>
          {s.sideCapture}
        </div>
        {CAPTURE.map(it => (
          <button key={it.type} onClick={() => choose(it.type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              width: '100%', padding: '5px 6px', background: 'transparent',
              border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <span style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              background: it.color + '18', border: `1px solid ${it.color}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: it.color }}>{it.icon}</span>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)',
              minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {it.label}
            </span>
          </button>
        ))}
        <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={receive('image')}/>
        <input ref={humInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" hidden onChange={receive('audio-hum')}/>
        <input ref={refInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" multiple hidden onChange={receive('audio-ref')}/>
      </div>

      <div style={{ height:1, background:'rgba(48,48,46,0.7)', margin:'0 10px' }}/>

      <div style={{ padding: '7px 7px 11px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(70,70,66,0.9)',
          letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 6px 6px' }}>
          {s.sideCreation}
        </div>
        <button onClick={() => onAddNode('lyrics')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '5px 6px', background: 'transparent',
            border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <span style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            background: '#E56B8A18', border: '1px solid #E56B8A28',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#E56B8A' }}>♪</span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)',
            minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {s.nodeLyrics}
          </span>
        </button>
        <button onClick={onAddFrame}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '5px 6px', background: 'transparent',
            border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <span style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            background: '#6B6EF520', border: '1px solid #6B6EF540',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#8A8AFF' }}>▢</span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)',
            minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {s.addFrame}
          </span>
        </button>
        <button onClick={() => onAddNode('audioFolder')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '5px 6px', background: 'transparent',
            border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <span style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            background: '#8A7CFF18', border: '1px solid #8A7CFF28',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#8A7CFF' }}>▦</span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)',
            minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {s.audioFolderTitle}
          </span>
        </button>
        <div style={{ padding:'6px 6px 0', fontSize:8.5, color:'#4A4A48', lineHeight:1.5 }}>
          {testMode
            ? (lang==='zh' ? '测试模式已开启：点击素材直接生成卡片' : 'Test mode: click a material to create a card')
            : (lang==='zh' ? '点击导入真实素材，也可直接拖到画布' : 'Choose real files or drop them onto the canvas')}
        </div>
      </div>
    </div>
  )
}
