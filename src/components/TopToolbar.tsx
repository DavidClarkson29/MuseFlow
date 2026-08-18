import { useState, useRef, useEffect } from 'react'
import type { Lang } from '../i18n'
import { strings } from '../i18n'

interface Props {
  lang: Lang
  onToggleLang: () => void
  onExport: () => void
  projectName: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const RECENT_PROJECTS = [
  { id: 'p1', name: '夜晚驾驶灵感', active: true, updated: '刚刚' },
  { id: 'p2', name: '城市流行 Demo', active: false, updated: '2天前' },
  { id: 'p3', name: '实验性电子', active: false, updated: '5天前' },
]

const FILES_SOURCES = [
  { id:'f1', name:'夜晚城市.jpg', type:'image', size:'2.4 MB', icon:'🖼', color:'#3BBDAF', date:'今天' },
  { id:'f2', name:'哼唱片段.wav', type:'audio', size:'0.3 MB', icon:'🎤', color:'#F5A523', date:'今天' },
  { id:'f3', name:'Reference Track.mp3', type:'audio', size:'8.1 MB', icon:'🔗', color:'#4BA35A', date:'今天' },
  { id:'f4', name:'文字意向', type:'text', size:'—', icon:'T', color:'#6B6EF5', date:'今天' },
  { id:'f5', name:'情绪标签', type:'mood', size:'—', icon:'✦', color:'#9B7EFF', date:'今天' },
]

const FILES_GENERATED = [
  { id:'g1', name:'方向 A · 暖调都市流行', type:'direction', size:'—', icon:'◈', color:'#F5A523', date:'今天' },
  { id:'g2', name:'方向 B · 暗色电影', type:'direction', size:'—', icon:'◈', color:'#7A7A78', date:'今天' },
  { id:'g3', name:'方向 C · 梦幻电子', type:'direction', size:'—', icon:'◈', color:'#9B7EFF', date:'今天' },
  { id:'g4', name:'融合 A+B 成果', type:'direction', size:'—', icon:'⊕', color:'#F06090', date:'今天' },
  { id:'g5', name:'创意摘要.pdf', type:'brief', size:'0.1 MB', icon:'↗', color:'#3BBDAF', date:'今天' },
  { id:'g6', name:'夜晚驾驶 Remix.wav', type:'audio', size:'24.6 MB', icon:'🎵', color:'#3BBDAF', date:'刚刚' },
]

const FILES_ALL = [...FILES_SOURCES, ...FILES_GENERATED]

// ─────────────────────────────────────────────────────────────────────────────

export default function TopToolbar({ lang, onToggleLang, onExport, projectName }: Props) {
  const s = strings[lang]
  const [showFileMenu, setShowFileMenu]   = useState(false)
  const [showFilesPanel, setShowFilesPanel] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)

  // Close file menu on outside click
  useEffect(() => {
    if (!showFileMenu) return
    const handler = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setShowFileMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFileMenu])

  return (
    <>
      <div style={{
        height: 44,
        background: '#141413',
        borderBottom: '1px solid #272725',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        flexShrink: 0,
        userSelect: 'none',
        gap: 0,
      }}>
        {/* Left cluster: Museflow wordmark + file buttons */}
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
          {/* Museflow wordmark — no icon */}
          <span style={{ fontSize:14, fontWeight:800, color:'#F0F0EE', letterSpacing:'-0.04em', fontStyle:'italic', marginRight:6 }}>
            Museflow
          </span>

          <Sep/>

          {/* File manager button */}
          <div ref={fileMenuRef} style={{ position:'relative' }}>
            <TBtn title={lang === 'zh' ? '项目管理' : 'Projects'} active={showFileMenu}
              onClick={() => { setShowFileMenu(v => !v); setShowFilesPanel(false) }}>
              <FolderIcon/>
            </TBtn>
            {showFileMenu && (
              <FileMenuDropdown lang={lang} onClose={() => setShowFileMenu(false)}/>
            )}
          </div>

          {/* All files button */}
          <TBtn title={lang === 'zh' ? '项目文件' : 'Files'}
            onClick={() => { setShowFilesPanel(true); setShowFileMenu(false) }}>
            <FilesIcon/>
          </TBtn>
        </div>

        {/* Project name — center */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#5EC96E', boxShadow:'0 0 5px #5EC96E80' }}/>
            <span style={{ fontSize:12, fontWeight:600, color:'#C0C0BC', letterSpacing:'-0.01em' }}>
              {projectName}
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <TBtn title={s.undo}><UndoIcon/></TBtn>
          <TBtn title={s.redo}><RedoIcon/></TBtn>
          <Sep/>
          <TBtn title={s.search}><SearchIcon/></TBtn>
          <TBtn title={s.share}><ShareIcon/></TBtn>
          <Sep/>
          <button
            onClick={onToggleLang}
            style={{
              height:28, padding:'0 10px',
              background:'#1C1C1B', border:'1px solid #2C2C2A', borderRadius:6,
              color:'#9B9B96', fontSize:11, fontWeight:700, cursor:'pointer',
              letterSpacing:'0.02em', fontFamily:"'Inter',sans-serif", transition:'all 0.12s',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#262624'; e.currentTarget.style.color='#F0F0EE' }}
            onMouseLeave={e=>{ e.currentTarget.style.background='#1C1C1B'; e.currentTarget.style.color='#9B9B96' }}
          >
            {s.langToggle}
          </button>
          <Sep/>
          <button
            onClick={onExport}
            style={{
              height:28, padding:'0 12px',
              background:'#6B6EF5', color:'#fff', border:'none', borderRadius:6,
              fontSize:12, fontWeight:700, cursor:'pointer',
              display:'flex', alignItems:'center', gap:5, letterSpacing:'-0.01em',
              fontFamily:"'Inter',sans-serif", transition:'background 0.12s',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#5A5CE6' }}
            onMouseLeave={e=>{ e.currentTarget.style.background='#6B6EF5' }}
          >
            <ExportIcon/> {s.export}
          </button>
        </div>
      </div>

      {/* Files Panel overlay */}
      {showFilesPanel && (
        <FilesPanel lang={lang} onClose={() => setShowFilesPanel(false)}/>
      )}
    </>
  )
}

// ── File Manager dropdown ─────────────────────────────────────────────────────

function FileMenuDropdown({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const zh = lang === 'zh'
  return (
    <div style={{
      position:'absolute', top:'calc(100% + 6px)', left:0,
      width:220, zIndex:100,
      background:'#1A1A19', border:'1px solid #2C2C2A', borderRadius:10,
      boxShadow:'0 12px 40px rgba(0,0,0,0.6)',
      overflow:'hidden',
    }}>
      {/* New project */}
      <button
        onClick={onClose}
        style={{
          width:'100%', padding:'10px 14px', background:'transparent', border:'none',
          borderBottom:'1px solid #222220',
          display:'flex', alignItems:'center', gap:8, cursor:'pointer',
          fontFamily:"'Inter',sans-serif", transition:'background 0.1s',
        }}
        onMouseEnter={e=>{ e.currentTarget.style.background='#222220' }}
        onMouseLeave={e=>{ e.currentTarget.style.background='transparent' }}
      >
        <div style={{ width:22, height:22, borderRadius:5, background:'#6B6EF520', border:'1px solid #6B6EF530',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B6EF5" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
        <span style={{ fontSize:12, fontWeight:600, color:'#C0C0BC' }}>{zh ? '新建项目' : 'New Project'}</span>
      </button>

      {/* Recent projects */}
      <div style={{ padding:'8px 14px 4px' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#3A3A38', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
          {zh ? '最近项目' : 'Recent'}
        </div>
        {RECENT_PROJECTS.map(p => (
          <button key={p.id} onClick={onClose}
            style={{
              width:'100%', padding:'7px 0', background:'transparent', border:'none',
              display:'flex', alignItems:'center', gap:8, cursor:'pointer',
              fontFamily:"'Inter',sans-serif", transition:'background 0.1s',
              borderRadius:6, marginBottom:2,
            }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#222220' }}
            onMouseLeave={e=>{ e.currentTarget.style.background='transparent' }}
          >
            <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
              background: p.active ? '#5EC96E' : '#2C2C2A',
              boxShadow: p.active ? '0 0 4px #5EC96E80' : 'none' }}/>
            <span style={{ fontSize:11, color: p.active ? '#F0F0EE' : '#8A8A86', fontWeight: p.active ? 600 : 400, flex:1, textAlign:'left' }}>
              {p.name}
            </span>
            <span style={{ fontSize:9, color:'#3A3A38' }}>{p.updated}</span>
          </button>
        ))}
      </div>
      <div style={{ padding:'8px 14px 10px', borderTop:'1px solid #1E1E1C' }}>
        <button onClick={onClose}
          style={{ width:'100%', padding:'6px 0', background:'transparent', border:'none',
            color:'#5A5A56', fontSize:11, cursor:'pointer', fontFamily:"'Inter',sans-serif",
            display:'flex', alignItems:'center', gap:6 }}
          onMouseEnter={e=>{ e.currentTarget.style.color='#9A9A96' }}
          onMouseLeave={e=>{ e.currentTarget.style.color='#5A5A56' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          {zh ? '导入项目…' : 'Import Project…'}
        </button>
      </div>
    </div>
  )
}

// ── Files Panel ───────────────────────────────────────────────────────────────

type FileTab = 'all' | 'source' | 'generated'

function FilesPanel({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const zh = lang === 'zh'
  const [tab, setTab] = useState<FileTab>('all')

  const files = tab === 'all' ? FILES_ALL : tab === 'source' ? FILES_SOURCES : FILES_GENERATED
  const tabs: { id: FileTab; label: string }[] = [
    { id:'all',       label: zh ? '全部'   : 'All'       },
    { id:'source',    label: zh ? '素材'   : 'Sources'   },
    { id:'generated', label: zh ? '已生成' : 'Generated' },
  ]

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex',
        alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="inspector-appear"
        onClick={e => e.stopPropagation()}
        style={{
          background:'#1A1A19', border:'1px solid #2C2C2A', borderRadius:14,
          width:560, maxHeight:'78vh', overflow:'hidden',
          boxShadow:'0 32px 80px rgba(0,0,0,0.7)',
          display:'flex', flexDirection:'column',
        }}
      >
        {/* Header */}
        <div style={{ padding:'16px 18px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#F0F0EE', letterSpacing:'-0.02em' }}>
                {zh ? '项目文件' : 'Project Files'}
              </div>
              <div style={{ fontSize:11, color:'#4A4A48', marginTop:2 }}>
                {zh ? '夜晚驾驶灵感' : 'Night Drive Idea'} · {FILES_ALL.length} {zh ? '个文件' : 'files'}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <button style={{
                height:28, padding:'0 10px', background:'#6B6EF520', border:'1px solid #6B6EF540',
                borderRadius:6, color:'#8A8AFF', fontSize:11, fontWeight:600, cursor:'pointer',
                display:'flex', alignItems:'center', gap:5, fontFamily:"'Inter',sans-serif",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                {zh ? '上传' : 'Upload'}
              </button>
              <button onClick={onClose} style={{
                width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
                background:'#222220', border:'none', borderRadius:7, cursor:'pointer', color:'#5A5A56',
                fontFamily:"'Inter',sans-serif",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:2, background:'#141413', border:'1px solid #222220', borderRadius:8, padding:3 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  flex:1, padding:'5px 0', borderRadius:5, border:'none',
                  background: tab===t.id ? '#2A2A28' : 'transparent',
                  color: tab===t.id ? '#F0F0EE' : '#5A5A56',
                  fontSize:12, fontWeight:600, cursor:'pointer',
                  fontFamily:"'Inter',sans-serif", transition:'all 0.12s',
                }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* File grid */}
        <div style={{
          flex:1, overflowY:'auto', padding:'14px 18px 18px',
          scrollbarWidth:'thin', scrollbarColor:'#2C2C2A transparent',
        }}>
          {/* Section label */}
          {tab === 'all' && (
            <>
              <SectionLbl>{zh ? '素材' : 'Sources'}</SectionLbl>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                {FILES_SOURCES.map(f => <FileCard key={f.id} file={f}/>)}
              </div>
              <SectionLbl>{zh ? '已生成' : 'Generated'}</SectionLbl>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {FILES_GENERATED.map(f => <FileCard key={f.id} file={f}/>)}
              </div>
            </>
          )}
          {tab !== 'all' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {files.map(f => <FileCard key={f.id} file={f}/>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLbl({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize:9, fontWeight:700, color:'#3A3A38', letterSpacing:'0.08em',
      textTransform:'uppercase', marginBottom:8 }}>{children}</div>
  )
}

type FileMeta = { id:string; name:string; type:string; size:string; icon:string; color:string; date:string }

function FileCard({ file: f }: { file: FileMeta }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        padding:'10px 12px', borderRadius:8,
        background: hov ? '#222220' : '#1E1E1C',
        border:'1px solid #2A2A28',
        display:'flex', alignItems:'center', gap:10, cursor:'pointer',
        transition:'all 0.1s',
      }}
    >
      <div style={{
        width:34, height:34, borderRadius:7, flexShrink:0,
        background: f.color+'18', border:`1px solid ${f.color}30`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:15, color: f.color,
      }}>{f.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#C0C0BC',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>
          {f.name}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:9, color:'#3A3A38', fontFamily:"'JetBrains Mono',monospace" }}>{f.size}</span>
          <div style={{ width:1, height:8, background:'#2A2A28' }}/>
          <span style={{ fontSize:9, color:'#3A3A38' }}>{f.date}</span>
        </div>
      </div>
      {hov && (
        <button style={{ width:22, height:22, borderRadius:4, background:'#2A2A28', border:'none',
          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#6A6A66',
          flexShrink:0, fontFamily:"'Inter',sans-serif" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </button>
      )}
    </div>
  )
}

// ── Shared toolbar components ─────────────────────────────────────────────────

function TBtn({ children, title, active, onClick }: {
  children: React.ReactNode; title: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button title={title} onClick={onClick} style={{
      width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
      background: active ? '#222220' : 'transparent',
      border:'none', borderRadius:6, cursor:'pointer',
      color: active ? '#C0C0BC' : '#5A5A56',
      transition:'all 0.1s', fontFamily:"'Inter',sans-serif",
    }}
    onMouseEnter={e=>{ e.currentTarget.style.background='#1C1C1B'; e.currentTarget.style.color='#C0C0BC' }}
    onMouseLeave={e=>{ e.currentTarget.style.background=active?'#222220':'transparent'; e.currentTarget.style.color=active?'#C0C0BC':'#5A5A56' }}
    >{children}</button>
  )
}

function Sep() {
  return <div style={{ width:1, height:16, background:'#2C2C2A', margin:'0 2px' }}/>
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function FilesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function UndoIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1"/></svg> }
function RedoIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5M19 9H8a5 5 0 0 0 0 10h1"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function ShareIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> }
function ExportIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> }
