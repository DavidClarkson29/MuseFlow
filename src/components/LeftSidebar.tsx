import { useRef } from 'react'
import type { Lang } from '../i18n'
import { strings } from '../i18n'
import type { ImportKind } from '../storage/projectStore'
import { emitGuideEvent } from '../guideEvents'
import { TileTypeIcon, type TileIconKind } from './TileTypeIcon'

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
    if(type==='image'||type==='audio-hum'||type==='audio-ref')emitGuideEvent({type:'upload-open',kind:type})
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
    { type: 'image' as const, icon: 'image' as TileIconKind, label: s.nodeImage, color: '#3BBDAF' },
    { type: 'audio-hum' as const, icon: 'hum' as TileIconKind, label: s.addHumClip, color: '#F5A523' },
    { type: 'text' as const, icon: 'text' as TileIconKind, label: s.nodeText, color: '#6B6EF5' },
  ]

  return (
    <div style={{
      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
      zIndex: 10, width: lang === 'en' ? 160 : 138,
      background: 'rgba(16,16,15,0.88)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(48,48,46,0.75)', borderRadius: 16,
      boxShadow: '0 2px 6px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', userSelect: 'none', overflow:'hidden',
      transition: 'width .18s cubic-bezier(.22,1,.36,1)',
    }}>
      <div style={{ padding: '11px 7px 7px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(70,70,66,0.9)',
          letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 6px 6px' }}>
          {s.sideCapture}
        </div>
        {CAPTURE.map(it => (
          <button key={it.type} data-guide-target={`capture-${it.type}`} onClick={() => choose(it.type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              width: '100%', padding: '5px 6px', background: 'transparent',
              border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <span style={{ width: 22, height: 22, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TileTypeIcon kind={it.icon} color={it.color} size={18}/>
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)',
              minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {it.label}
            </span>
          </button>
        ))}
        <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={receive('image')}/>
        <input ref={humInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" hidden onChange={receive('audio-hum')}/>
      </div>

      <div style={{ height:1, background:'rgba(48,48,46,0.7)', margin:'0 10px' }}/>

      <div style={{ padding: '7px 7px 11px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(70,70,66,0.9)',
          letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 6px 6px' }}>
          {s.sideCreation}
        </div>
        <button data-guide-target="create-audio-ref" onClick={() => choose('audio-ref')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '5px 6px', background: 'transparent',
            border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <span style={{ width:22, height:22, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <TileTypeIcon kind="reference" color="#4BA35A" size={18}/>
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)',
            minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {s.addRefAudio}
          </span>
        </button>
        <button data-guide-target="create-lyrics" onClick={() => onAddNode('lyrics')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '5px 6px', background: 'transparent',
            border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(40,40,38,0.8)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <span style={{ width:22, height:22, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <TileTypeIcon kind="lyrics" color="#E56B8A" size={18}/>
          </span>
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
          <span style={{ width:22, height:22, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <TileTypeIcon kind="frame" color="#8A8AFF" size={18}/>
          </span>
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
          <span style={{ width:22, height:22, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <TileTypeIcon kind="folder" color="#8A7CFF" size={18}/>
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(172,172,166,0.9)',
            minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {s.audioFolderTitle}
          </span>
        </button>
        <input ref={refInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" multiple hidden onChange={receive('audio-ref')}/>
        <div style={{ padding:'6px 6px 0', fontSize:8.5, color:'#4A4A48', lineHeight:1.5 }}>
          {testMode
            ? (lang==='zh' ? '测试模式已开启：点击素材直接生成卡片' : 'Test mode: click a material to create a card')
            : (lang==='zh' ? '点击导入真实素材，也可直接拖到画布' : 'Choose real files or drop them onto the canvas')}
        </div>
      </div>

      <div style={{ height:1, background:'rgba(48,48,46,0.7)', margin:'0 10px' }}/>

      <div style={{ padding:'7px 7px 10px' }}>
        <div style={{ fontSize:8, fontWeight:700, color:'rgba(70,70,66,0.9)',
          letterSpacing:'0.1em', textTransform:'uppercase', padding:'0 6px 6px' }}>
          {lang==='zh' ? '批注 · Annotate' : 'Annotate'}
        </div>
        <button onClick={()=>onAddNode('note')}
          style={{ display:'flex', alignItems:'center', gap:7, width:'100%', padding:'5px 6px',
            background:'transparent', border:'none', borderRadius:7, cursor:'pointer', textAlign:'left', transition:'background .1s' }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(40,40,38,0.8)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
          <span style={{ width:22, height:22, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <TileTypeIcon kind="note" color="#D8C46A" size={18}/>
          </span>
          <span style={{ fontSize:10.5, fontWeight:500, color:'rgba(172,172,166,0.9)' }}>
            {lang==='zh' ? '便签批注' : 'Sticky Note'}
          </span>
        </button>
      </div>
    </div>
  )
}
