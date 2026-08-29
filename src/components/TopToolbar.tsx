import { useState, useRef, useEffect } from 'react'
import type { Lang } from '../i18n'
import { strings } from '../i18n'
import type { ProjectExportCounts, ProjectExportKind } from '../projectExporters'

interface Props {
  lang: Lang
  onToggleLang: () => void
  onOpenGallery: () => void
  projectName: string
  ambiguityLabel?: string
  ambiguityColor?: string
  onSaveProject: () => void
  onRestoreProject: () => void
  canRestoreProject: boolean
  lastSavedAt: number | null
  projectSaveState: 'idle'|'saving'|'saved'|'restored'|'error'
  testMode: boolean
  onTestModeChange: (enabled:boolean) => void
  exportCounts: ProjectExportCounts
  onProjectExport: (kind:ProjectExportKind) => string
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
  name: 'Alex Chen',
  email: 'alex@museflow.studio',
  avatar: 'https://i.pravatar.cc/200?img=15',
  plan: 'Pro' as const,
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TopToolbar({ lang, onToggleLang, onOpenGallery, projectName, ambiguityLabel, ambiguityColor,
  onSaveProject, onRestoreProject, canRestoreProject, lastSavedAt, projectSaveState, testMode, onTestModeChange,
  exportCounts, onProjectExport }: Props) {
  const s = strings[lang]
  const [showFileMenu, setShowFileMenu]   = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [shareAccess, setShareAccess] = useState<'view'|'comment'|'edit'>('view')
  const [exportToast, setExportToast] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const shareMenuRef = useRef<HTMLDivElement>(null)
  const exportToastTimerRef = useRef<number | null>(null)

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

  // Close avatar menu on outside click
  useEffect(() => {
    if (!showAvatarMenu) return
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAvatarMenu])

  useEffect(() => {
    if (!showExportMenu) return
    const handler = (e:MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown',handler)
    return () => document.removeEventListener('mousedown',handler)
  }, [showExportMenu])

  useEffect(() => {
    if (!showShareMenu) return
    const handler = (e:MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) setShowShareMenu(false)
    }
    document.addEventListener('mousedown',handler)
    return () => document.removeEventListener('mousedown',handler)
  }, [showShareMenu])

  useEffect(() => () => {
    if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current)
  }, [])

  const handleProjectExport = (kind:ProjectExportKind) => {
    try {
      const message = onProjectExport(kind)
      setShowExportMenu(false)
      setExportToast(message)
      if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current)
      exportToastTimerRef.current = window.setTimeout(() => setExportToast(null),2400)
    } catch {
      setExportToast(lang==='zh'?'导出失败，请重试':'Export failed. Please try again.')
    }
  }

  const showActionToast = (message:string) => {
    setExportToast(message)
    if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current)
    exportToastTimerRef.current = window.setTimeout(() => setExportToast(null),2400)
  }

  const handleShareAction = async (action:'link'|'summary'|'system') => {
    const url = new URL(window.location.href)
    url.searchParams.set('share','preview')
    url.searchParams.set('access',shareAccess)
    const accessLabel = shareAccess==='view' ? (lang==='zh'?'仅查看':'View only')
      : shareAccess==='comment' ? (lang==='zh'?'可评论':'Can comment') : (lang==='zh'?'可编辑':'Can edit')
    const summary = lang==='zh'
      ? `${projectName}\nMuseFlow 创作项目 · ${accessLabel}\n${exportCounts.audio} 个音频 · ${exportCounts.lyrics} 张歌词卡片`
      : `${projectName}\nMuseFlow creative project · ${accessLabel}\n${exportCounts.audio} audio items · ${exportCounts.lyrics} lyric cards`
    try {
      if (action==='summary') {
        await navigator.clipboard.writeText(summary)
        showActionToast(lang==='zh'?'创作摘要已复制':'Creative summary copied')
      } else if (action==='system' && navigator.share) {
        await navigator.share({ title:projectName, text:summary, url:url.toString() })
        showActionToast(lang==='zh'?'已打开系统分享':'System share opened')
      } else {
        await navigator.clipboard.writeText(url.toString())
        showActionToast(lang==='zh'?'分享链接已复制':'Share link copied')
      }
      setShowShareMenu(false)
    } catch {
      showActionToast(lang==='zh'?'分享未完成':'Share was not completed')
    }
  }

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

          {/* Board gallery — returns to the Procreate-style project overview */}
          <TBtn title={lang==='zh'?'画板总览':'Board gallery'} onClick={() => {
            setShowFileMenu(false); setShowExportMenu(false); setShowShareMenu(false); setShowAvatarMenu(false); onOpenGallery()
          }}>
            <GalleryIcon/>
          </TBtn>

          {/* File manager button */}
          <div ref={fileMenuRef} style={{ position:'relative' }}>
            <TBtn title={lang === 'zh' ? '项目管理' : 'Projects'} active={showFileMenu}
              onClick={() => { setShowFileMenu(v => !v); setShowExportMenu(false); setShowShareMenu(false); setShowAvatarMenu(false) }}>
              <FolderIcon/>
            </TBtn>
            {showFileMenu && (
              <FileMenuDropdown lang={lang} onClose={() => setShowFileMenu(false)}
                onSave={onSaveProject} onRestore={onRestoreProject} canRestore={canRestoreProject}
                lastSavedAt={lastSavedAt} saveState={projectSaveState}/>
            )}
          </div>


        </div>

        {/* Project name + Ambiguity — center */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#5EC96E', boxShadow:'0 0 5px #5EC96E80' }}/>
            <span style={{ fontSize:12, fontWeight:600, color:'#C0C0BC', letterSpacing:'-0.01em' }}>
              {projectName}
            </span>
            {projectSaveState !== 'idle' && (
              <span role="status" style={{ fontSize:9, color:projectSaveState==='error'?'#E06A5A':'#5EC96E', fontWeight:700 }}>
                {projectSaveState==='saving' ? (lang==='zh'?'保存中…':'Saving…')
                  : projectSaveState==='restored' ? (lang==='zh'?'已恢复':'Restored')
                  : projectSaveState==='error' ? (lang==='zh'?'保存失败':'Save failed')
                  : (lang==='zh'?'已保存':'Saved')}
              </span>
            )}
          </div>
          {ambiguityLabel && (
            <span style={{ display:'flex', alignItems:'center', gap:5, padding:'2.5px 9px',
              borderRadius:20, border:'1px solid #2A2A28', background:'#1A1A19' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:ambiguityColor }}/>
              <span style={{ fontSize:9.5, fontWeight:700, color:ambiguityColor, letterSpacing:'0.03em' }}>
                {ambiguityLabel}
              </span>
            </span>
          )}
        </div>

        {/* Right actions */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <TBtn title={s.undo}><UndoIcon/></TBtn>
          <TBtn title={s.redo}><RedoIcon/></TBtn>
          <Sep/>
          <TBtn title={s.search}><SearchIcon/></TBtn>
          <div ref={shareMenuRef} style={{ position:'relative' }}>
            <TBtn title={s.share} active={showShareMenu}
              onClick={() => { setShowShareMenu(v=>!v); setShowExportMenu(false); setShowAvatarMenu(false); setShowFileMenu(false) }}>
              <ShareIcon/>
            </TBtn>
            {showShareMenu && (
              <ShareDropdown lang={lang} projectName={projectName} counts={exportCounts} access={shareAccess}
                onAccessChange={setShareAccess} onAction={handleShareAction}/>
            )}
          </div>
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
          <div ref={exportMenuRef} style={{ position:'relative' }}>
            <button
              type="button"
              aria-expanded={showExportMenu}
              aria-haspopup="menu"
              onClick={() => { setShowExportMenu(v=>!v); setShowShareMenu(false); setShowAvatarMenu(false); setShowFileMenu(false) }}
              style={{
                height:28, padding:'0 12px',
                background:showExportMenu?'#5A5CE6':'#6B6EF5', color:'#fff', border:'none', borderRadius:6,
                fontSize:12, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', gap:5, letterSpacing:'-0.01em',
                fontFamily:"'Inter',sans-serif", transition:'background 0.12s, box-shadow .12s',
                boxShadow:showExportMenu?'0 0 0 3px #6B6EF520':'none',
              }}
            >
              <ExportIcon/> {s.export}
            </button>
            {showExportMenu && <ExportDropdown lang={lang} counts={exportCounts} onExport={handleProjectExport}/>} 
          </div>
          <Sep/>
          {/* ── Avatar — single entry for login / profile ── */}
          <div ref={avatarRef} style={{ position:'relative', marginLeft:2 }}>
            <button
              onClick={() => { setShowAvatarMenu(v => !v); setShowExportMenu(false); setShowShareMenu(false); setShowFileMenu(false) }}
              title={s.userMenu}
              style={{
                width:30, height:30, borderRadius:'50%',
                padding:0, border: showAvatarMenu ? '2px solid #6B6EF5' : '1px solid #2C2C2A',
                background: isLoggedIn ? '#1C1C1B' : '#1E1E1C',
                cursor:'pointer', overflow:'hidden', position:'relative',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'border-color 0.15s, transform 0.12s',
                boxShadow: showAvatarMenu ? '0 0 0 3px #6B6EF520' : 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = showAvatarMenu ? '#6B6EF5' : '#3A3A38' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = showAvatarMenu ? '#6B6EF5' : '#2C2C2A' }}
            >
              {isLoggedIn ? (
                <img src={MOCK_USER.avatar} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} draggable={false}/>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6A6A66" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              )}
              {/* online dot when logged in */}
              {isLoggedIn && (
                <span style={{
                  position:'absolute', bottom:-1, right:-1, width:9, height:9, borderRadius:'50%',
                  background:'#5EC96E', border:'2px solid #141413', boxShadow:'0 0 4px #5EC96E80',
                }}/>
              )}
            </button>
            {showAvatarMenu && (
              <AvatarDropdown
                lang={lang}
                isLoggedIn={isLoggedIn}
                onClose={() => setShowAvatarMenu(false)}
                onLogin={() => { setShowAvatarMenu(false); setShowLoginModal(true) }}
                onLogout={() => { setIsLoggedIn(false); setShowAvatarMenu(false) }}
                onLoggedIn={() => setIsLoggedIn(true)}
                testMode={testMode}
                onTestModeChange={onTestModeChange}
              />
            )}
          </div>
        </div>
      </div>

      {/* Login modal */}
      {showLoginModal && (
        <LoginModal
          lang={lang}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => { setIsLoggedIn(true); setShowLoginModal(false) }}
        />
      )}
      {exportToast && (
        <div role="status" className="inspector-appear" style={{ position:'fixed', top:52, right:18, zIndex:120,
          padding:'8px 12px', borderRadius:8, background:'#19191B', border:'1px solid #34343A',
          color:'#C9C9D2', fontSize:10.5, fontWeight:650, boxShadow:'0 12px 34px rgba(0,0,0,.52)' }}>{exportToast}</div>
      )}
    </>
  )
}

// ── Project share dropdown ───────────────────────────────────────────────────

function ShareDropdown({ lang, projectName, counts, access, onAccessChange, onAction }: {
  lang:Lang; projectName:string; counts:ProjectExportCounts; access:'view'|'comment'|'edit'
  onAccessChange:(access:'view'|'comment'|'edit')=>void
  onAction:(action:'link'|'summary'|'system')=>void
}) {
  const zh=lang==='zh'
  const accessItems = [
    {id:'view' as const,label:zh?'仅查看':'View'},
    {id:'comment' as const,label:zh?'可评论':'Comment'},
    {id:'edit' as const,label:zh?'可编辑':'Edit'},
  ]
  return (
    <div className="inspector-appear" style={{ position:'absolute', top:'calc(100% + 10px)', right:0,
      width:288, zIndex:100, padding:7, borderRadius:12, overflow:'hidden',
      background:'rgba(26,26,25,.96)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
      border:'1px solid #30302E', boxShadow:'0 18px 52px rgba(0,0,0,.64), inset 0 1px rgba(255,255,255,.025)' }}>
      <div style={{ padding:'7px 8px 9px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:27, height:27, display:'grid', placeItems:'center', borderRadius:7,
            background:'#6B6EF516', border:'1px solid #6B6EF532', color:'#8A8AFF' }}><ShareIcon/></span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:'block', fontSize:11.5, lineHeight:1.2, color:'#D7D7D3', fontWeight:700,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{projectName}</span>
            <span style={{ display:'block', marginTop:2, fontSize:9.5, color:'#555551' }}>
              {zh?`${counts.audio} 个音频 · ${counts.lyrics} 张歌词卡片`:`${counts.audio} audio · ${counts.lyrics} lyric cards`}
            </span>
          </span>
        </div>
      </div>

      <div style={{ padding:'8px', borderTop:'1px solid #242422', borderBottom:'1px solid #242422' }}>
        <div style={{ marginBottom:6, fontSize:8.5, color:'#5D5D58', fontWeight:750, letterSpacing:'.06em' }}>{zh?'访问权限':'ACCESS'}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, padding:3, borderRadius:8,
          background:'#141413', border:'1px solid #262624' }}>
          {accessItems.map(item=><button key={item.id} onClick={()=>onAccessChange(item.id)}
            style={{ height:25, borderRadius:6, border:access===item.id?'1px solid #6B6EF54A':'1px solid transparent',
              background:access===item.id?'#6B6EF520':'transparent', color:access===item.id?'#A7A8FF':'#62625E',
              fontSize:9.5, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>{item.label}</button>)}
        </div>
      </div>

      <div style={{ padding:'6px 0 2px', display:'flex', flexDirection:'column', gap:2 }}>
        <ShareAction icon="↗" color="#8A8AFF" title={zh?'复制分享链接':'Copy Share Link'}
          desc={zh?'使用当前访问权限':'Uses the selected access level'} onClick={()=>onAction('link')}/>
        <ShareAction icon="≡" color="#F5A523" title={zh?'复制创作摘要':'Copy Creative Summary'}
          desc={zh?'项目名称、内容数量与权限':'Project name, content and access'} onClick={()=>onAction('summary')}/>
        <ShareAction icon="⌁" color="#42D9D0" title={zh?'打开系统分享':'Open System Share'}
          desc={zh?'发送到其他应用或联系人':'Send to another app or contact'} onClick={()=>onAction('system')}/>
      </div>

      <div style={{ marginTop:4, padding:'8px 8px 4px', borderTop:'1px solid #242422', color:'#4D4D49', fontSize:9.5 }}>
        {zh?'分享不会改变当前画布内容':'Sharing does not change the current canvas'}
      </div>
    </div>
  )
}

function ShareAction({icon,color,title,desc,onClick}:{icon:string;color:string;title:string;desc:string;onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{ width:'100%', minHeight:46, padding:'7px 8px', display:'flex', alignItems:'center', gap:9,
      border:0, borderRadius:8, background:'transparent', cursor:'pointer', textAlign:'left', fontFamily:"'Inter',sans-serif" }}
      onMouseEnter={event=>{event.currentTarget.style.background='#232322'}}
      onMouseLeave={event=>{event.currentTarget.style.background='transparent'}}>
      <span style={{ width:27, height:27, flexShrink:0, display:'grid', placeItems:'center', borderRadius:7,
        background:`${color}13`, border:`1px solid ${color}2D`, color, fontSize:13, fontWeight:800 }}>{icon}</span>
      <span style={{ flex:1, minWidth:0 }}>
        <span style={{ display:'block', fontSize:11.5, lineHeight:1.2, fontWeight:650, color:'#D2D2CE' }}>{title}</span>
        <span style={{ display:'block', marginTop:3, fontSize:9.5, lineHeight:1.2, color:'#5F5F5B' }}>{desc}</span>
      </span>
    </button>
  )
}

// ── Project export dropdown ──────────────────────────────────────────────────

function ExportDropdown({ lang, counts, onExport }: {
  lang:Lang; counts:ProjectExportCounts; onExport:(kind:ProjectExportKind)=>void
}) {
  const zh=lang==='zh'
  const items:Array<{kind:ProjectExportKind; icon:string; color:string; title:string; desc:string; format:string; disabled?:boolean}> = [
    { kind:'path', icon:'↗', color:'#8A8AFF', title:zh?'导出创作路径':'Export Creative Path', desc:zh?'完整画布、卡片关系与生成路径':'Canvas, cards and generation paths', format:'SVG' },
    { kind:'audio', icon:'♫', color:'#42D9D0', title:zh?'导出所有音频':'Export All Audio', desc:zh?`${counts.audio} 个 Demo 与作品音频`:`${counts.audio} demos and tracks`, format:'WAV', disabled:counts.audio===0 },
    { kind:'lyrics', icon:'♪', color:'#E56B8A', title:zh?'导出全部歌词':'Export All Lyrics', desc:zh?`${counts.lyrics} 张歌词卡片及段落结构`:`${counts.lyrics} lyric cards with sections`, format:'MD', disabled:counts.lyrics===0 },
    { kind:'archive', icon:'≡', color:'#F5A523', title:zh?'导出创作档案':'Export Creative Archive', desc:zh?'素材、参数与实际生成指令':'Sources, parameters and instructions', format:'MD' },
    { kind:'project', icon:'▣', color:'#6B6EF5', title:zh?'导出项目包':'Export Project Package', desc:zh?'可继续恢复的完整画布数据':'Restorable canvas project data', format:'.MUSEFLOW' },
  ]
  return (
    <div role="menu" className="inspector-appear" style={{ position:'absolute', top:'calc(100% + 10px)', right:0,
      width:300, zIndex:100, padding:'7px', borderRadius:12, overflow:'hidden',
      background:'rgba(26,26,25,.96)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
      border:'1px solid #30302E', boxShadow:'0 18px 52px rgba(0,0,0,.64), inset 0 1px rgba(255,255,255,.025)' }}>
      <div style={{ padding:'6px 8px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:9, fontWeight:800, color:'#777772', letterSpacing:'.08em' }}>{zh?'项目导出':'PROJECT EXPORT'}</span>
        <span style={{ fontSize:8.5, color:'#41413E' }}>MuseFlow</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {items.map(item=><button key={item.kind} role="menuitem" disabled={item.disabled}
          onClick={()=>onExport(item.kind)}
          style={{ width:'100%', minHeight:48, padding:'7px 8px', display:'flex', alignItems:'center', gap:9,
            border:0, borderRadius:8, background:'transparent', cursor:item.disabled?'default':'pointer',
            opacity:item.disabled ? .42 : 1, textAlign:'left', fontFamily:"'Inter',sans-serif", transition:'background .1s' }}
          onMouseEnter={event=>{if(!item.disabled)event.currentTarget.style.background='#232322'}}
          onMouseLeave={event=>{event.currentTarget.style.background='transparent'}}>
          <span style={{ width:28, height:28, flexShrink:0, display:'grid', placeItems:'center', borderRadius:7,
            color:item.color, background:`${item.color}13`, border:`1px solid ${item.color}2D`, fontSize:13, fontWeight:800 }}>{item.icon}</span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:'block', fontSize:11.5, lineHeight:1.2, fontWeight:650, color:'#D2D2CE' }}>{item.title}</span>
            <span style={{ display:'block', marginTop:3, fontSize:9.5, lineHeight:1.25, color:'#5F5F5B', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.desc}</span>
          </span>
          <span style={{ flexShrink:0, padding:'2px 5px', borderRadius:4, background:'#141413', border:'1px solid #282826',
            color:'#555550', fontSize:7.5, fontWeight:750, fontFamily:"'JetBrains Mono',monospace" }}>{item.format}</span>
        </button>)}
      </div>
      <div style={{ marginTop:6, padding:'8px 8px 4px', borderTop:'1px solid #242422', color:'#4D4D49', fontSize:9.5 }}>
        {zh?'单张卡片可通过右键单独导出':'Right-click a card to export it individually'}
      </div>
    </div>
  )
}

// ── Avatar dropdown ─────────────────────────────────────────────────────────

function AvatarDropdown({ lang, isLoggedIn, onClose, onLogin, onLogout, testMode, onTestModeChange }: {
  lang: Lang; isLoggedIn: boolean; onClose: () => void; onLogin: () => void; onLogout: () => void; onLoggedIn?: () => void
  testMode:boolean; onTestModeChange:(enabled:boolean)=>void
}) {
  const s = strings[lang]
  const zh = lang === 'zh'
  return (
    <div
      className="inspector-appear"
      style={{
        position:'absolute', top:'calc(100% + 10px)', right:0,
        width:280, zIndex:80,
        background:'#1A1A19',
        border:'1px solid #2C2C2A',
        borderRadius:12,
        boxShadow:'0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)',
        overflow:'hidden',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ padding:'14px 14px 12px', borderBottom:'1px solid #1E1E1C', background:'linear-gradient(180deg, #1E1E1C 0%, #1A1A19 100%)' }}>
        {isLoggedIn ? (
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <img src={MOCK_USER.avatar} alt="avatar" style={{ width:40, height:40, borderRadius:10, objectFit:'cover', display:'block', border:'1px solid #2C2C2A' }}/>
              <span style={{ position:'absolute', bottom:-2, right:-2, width:10, height:10, borderRadius:'50%', background:'#5EC96E', border:'2px solid #1A1A19' }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:12.5, fontWeight:700, color:'#F0F0EE', letterSpacing:'-0.01em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{MOCK_USER.name}</span>
                <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:20, background:'#6B6EF520', border:'1px solid #6B6EF530', color:'#8A8AFF', flexShrink:0 }}>{zh ? 'Pro' : 'Pro'}</span>
              </div>
              <div style={{ fontSize:11, color:'#6A6A66', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>{MOCK_USER.email}</div>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'#1E1E1C', border:'1px solid #2C2C2A', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3A3A38" strokeWidth="1.6" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'#F0F0EE' }}>{zh ? '未登录' : 'Not signed in'}</div>
              <div style={{ fontSize:11, color:'#5A5A56', marginTop:1 }}>{s.signInDesc}</div>
            </div>
          </div>
        )}

        {/* Storage bar — only when logged in */}
        {isLoggedIn && (
          <div style={{ marginTop:12, padding:'8px 10px', background:'#141413', border:'1px solid #222220', borderRadius:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:10, color:'#5A5A56', fontWeight:500 }}>{s.storageUsed}</span>
              <span style={{ fontSize:10, color:'#8A8A86', fontFamily:"'JetBrains Mono',monospace" }}>6.8 GB / 100 GB</span>
            </div>
            <div style={{ height:4, background:'#222220', borderRadius:2, overflow:'hidden' }}>
              <div style={{ width:'68%', height:'100%', background:'linear-gradient(90deg,#6B6EF5,#3BBDAF)', borderRadius:2 }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
              <span style={{ fontSize:10, color:'#6B6EF5', fontWeight:600, cursor:'pointer' }}>{s.managePlan} →</span>
              <span style={{ fontSize:10, color:'#3A3A38' }}>68%</span>
            </div>
          </div>
        )}
      </div>

      {/* Menu body */}
      {isLoggedIn ? (
        <>
          <div style={{ padding:'6px' }}>
            <MenuItem icon={<UserIcon/>} label={s.profile} desc={zh ? '查看与编辑个人资料' : 'View and edit profile'} onClick={onClose}/>
            <MenuItem icon={<GearIcon/>} label={s.accountSettings} desc={zh ? '账号、安全与订阅' : 'Account, security & billing'} onClick={onClose}/>
          </div>
          <div style={{ height:1, background:'#1E1E1C', margin:'0 6px' }}/>
          <div style={{ padding:'6px' }}>
            <MenuItem icon={<SlidersIcon/>} label={s.preferences} desc={zh ? '外观、语言与通知' : 'Appearance, language & notifications'} onClick={onClose}/>
            <MenuItem icon={<KeyboardIcon/>} label={s.keyboardShortcuts} kbd="⌘ K" onClick={onClose}/>
            <MenuItem icon={<HelpIcon/>} label={s.helpFeedback} onClick={onClose}/>
            <MenuItem icon={<SwitchIcon/>} label={s.switchAccount} onClick={onClose}/>
          </div>
          <div style={{ height:1, background:'#1E1E1C', margin:'0 6px' }}/>
          <div style={{ padding:'6px 6px 8px' }}>
            <button
              onClick={onLogout}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:8,
                padding:'8px 10px', borderRadius:7, border:'1px solid #2A1A1E', background:'#1E1416',
                cursor:'pointer', fontFamily:"'Inter',sans-serif", transition:'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#2A1618' }}
              onMouseLeave={e => { e.currentTarget.style.background='#1E1416' }}
            >
              <span style={{ width:22, height:22, borderRadius:6, background:'#E06A5A18', border:'1px solid #E06A5A25', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E06A5A" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </span>
              <span style={{ fontSize:12, fontWeight:600, color:'#E06A5A', flex:1, textAlign:'left' }}>{s.signOut}</span>
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding:'10px 14px 14px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <button
              onClick={onLogin}
              style={{
                width:'100%', padding:'10px 12px', borderRadius:8, border:'none',
                background:'#6B6EF5', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                fontFamily:"'Inter',sans-serif", transition:'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#5A5CE6' }}
              onMouseLeave={e => { e.currentTarget.style.background='#6B6EF5' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              {s.signIn}
            </button>
            <button
              onClick={onLogin}
              style={{
                width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #2C2C2A', background:'#1E1E1C',
                color:'#C0C0BC', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif",
                transition:'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#222220' }}
              onMouseLeave={e => { e.currentTarget.style.background='#1E1E1C' }}
            >
              {s.signUpFree}
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0' }}>
              <div style={{ flex:1, height:1, background:'#1E1E1C' }}/>
              <span style={{ fontSize:10, color:'#3A3A38' }}>{zh ? '或' : 'or'}</span>
              <div style={{ flex:1, height:1, background:'#1E1E1C' }}/>
            </div>
            <MenuItem icon={<HelpIcon/>} label={s.helpFeedback} onClick={onClose}/>
            <MenuItem icon={<KeyboardIcon/>} label={s.keyboardShortcuts} kbd="⌘ K" onClick={onClose}/>
          </div>
        </div>
      )}

      <div style={{ height:1, background:'#1E1E1C', margin:'0 6px' }}/>
      <div style={{ padding:'6px' }}>
        <button
          type="button"
          role="switch"
          aria-checked={testMode}
          aria-label={zh ? '测试模式' : 'Test mode'}
          onClick={() => onTestModeChange(!testMode)}
          style={{
            width:'100%', padding:'8px', borderRadius:7, border:'none', cursor:'pointer',
            background:testMode?'#6B6EF512':'transparent', display:'flex', alignItems:'center', gap:9,
            fontFamily:"'Inter',sans-serif", textAlign:'left', transition:'background .12s',
          }}
          onMouseEnter={e=>{if(!testMode)e.currentTarget.style.background='#222220'}}
          onMouseLeave={e=>{e.currentTarget.style.background=testMode?'#6B6EF512':'transparent'}}
        >
          <span style={{ width:22, height:22, borderRadius:6, flexShrink:0, background:'#6B6EF518', border:'1px solid #6B6EF530', display:'grid', placeItems:'center', color:'#8A8AFF', fontSize:11 }}>
            ⚗
          </span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:'block', fontSize:12, lineHeight:1.2, fontWeight:600, color:testMode?'#A6A7FF':'#C0C0BC' }}>
              {zh ? '测试模式' : 'Test mode'}
            </span>
            <span style={{ display:'block', fontSize:10, lineHeight:1.2, color:'#5A5A56', marginTop:1 }}>
              {zh ? '点击素材直接生成测试卡片' : 'Create test cards without choosing files'}
            </span>
          </span>
          <span aria-hidden="true" style={{ width:28, height:16, padding:2, boxSizing:'border-box', borderRadius:9, flexShrink:0, background:testMode?'#6B6EF5':'#30302E', transition:'background .15s' }}>
            <span style={{ display:'block', width:12, height:12, borderRadius:'50%', background:'#F4F4F1', transform:`translateX(${testMode?12:0}px)`, transition:'transform .15s', boxShadow:'0 1px 2px rgba(0,0,0,.4)' }}/>
          </span>
        </button>
      </div>

      <div style={{ padding:'8px 14px', borderTop:'1px solid #1E1E1C', background:'#141413', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#3A3A38', fontFamily:"'JetBrains Mono',monospace" }}>Museflow 1.0 · 2026</span>
        <span style={{ fontSize:10, color:'#5A5A56' }}>{zh ? '已备份 ✓' : 'Backed up ✓'}</span>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, desc, kbd, onClick }: { icon: React.ReactNode; label: string; desc?: string; kbd?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:9,
        padding: desc ? '8px 8px' : '7px 8px',
        borderRadius:7, border:'none', background:'transparent',
        cursor:'pointer', fontFamily:"'Inter',sans-serif", textAlign:'left',
        transition:'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background='#222220' }}
      onMouseLeave={e => { e.currentTarget.style.background='transparent' }}
    >
      <span style={{ width:22, height:22, borderRadius:6, background:'#1E1E1C', border:'1px solid #2A2A28', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#7A7A76' }}>
        {icon}
      </span>
      <span style={{ flex:1, minWidth:0 }}>
        <span style={{ fontSize:12, fontWeight:500, color:'#C0C0BC', display:'block', lineHeight:1.2 }}>{label}</span>
        {desc && <span style={{ fontSize:10, color:'#5A5A56', display:'block', marginTop:1, lineHeight:1.2 }}>{desc}</span>}
      </span>
      {kbd && <span style={{ fontSize:10, color:'#3A3A38', fontFamily:"'JetBrains Mono',monospace", border:'1px solid #2A2A28', background:'#1A1A19', padding:'1px 5px', borderRadius:4, flexShrink:0 }}>{kbd}</span>}
    </button>
  )
}

// ── Login modal ─────────────────────────────────────────────────────────────

function LoginModal({ lang, onClose, onSuccess }: { lang: Lang; onClose: () => void; onSuccess: () => void }) {
  const zh = lang === 'zh'
  const [email, setEmail] = useState('alex@museflow.studio')
  const [pwd, setPwd] = useState('••••••••')
  const [loading, setLoading] = useState(false)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.62)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:90, backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div className="inspector-appear" onClick={e => e.stopPropagation()} style={{ width:360, background:'#1A1A19', border:'1px solid #2C2C2A', borderRadius:14, boxShadow:'0 24px 64px rgba(0,0,0,0.6)', overflow:'hidden' }}>
        <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid #1E1E1C', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#F0F0EE', letterSpacing:'-0.02em' }}>{zh ? '登录 Museflow' : 'Sign in to Museflow'}</div>
            <div style={{ fontSize:11, color:'#5A5A56', marginTop:2 }}>{zh ? '继续你的夜晚驾驶灵感' : 'Continue your night drive idea'}</div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'#222220', border:'none', borderRadius:7, cursor:'pointer', color:'#5A5A56' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <div style={{ fontSize:11, color:'#8A8A86', marginBottom:6, fontWeight:500 }}>{zh ? '邮箱' : 'Email'}</div>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@studio.com" style={{ width:'100%', boxSizing:'border-box', background:'#141413', border:'1px solid #2A2A28', borderRadius:8, color:'#C0C0BC', fontSize:12, padding:'9px 11px', outline:'none', fontFamily:"'Inter',sans-serif" }}/>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#8A8A86', marginBottom:6, fontWeight:500 }}>{zh ? '密码' : 'Password'}</div>
            <input value={pwd} onChange={e=>setPwd(e.target.value)} type="password" placeholder="••••••••" style={{ width:'100%', boxSizing:'border-box', background:'#141413', border:'1px solid #2A2A28', borderRadius:8, color:'#C0C0BC', fontSize:12, padding:'9px 11px', outline:'none', fontFamily:"'Inter',sans-serif" }}/>
          </div>
          <button
            disabled={loading}
            onClick={() => { setLoading(true); setTimeout(onSuccess, 700) }}
            style={{ marginTop:6, width:'100%', padding:'10px 12px', borderRadius:8, border:'none', background: loading ? '#4A4CE0' : '#6B6EF5', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", opacity: loading ? 0.75 : 1, transition:'background 0.12s' }}
          >
            {loading ? (zh ? '登录中…' : 'Signing in…') : (zh ? '登录' : 'Sign In')}
          </button>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
            <span style={{ fontSize:11, color:'#6B6EF5', cursor:'pointer' }}>{zh ? '忘记密码？' : 'Forgot password?'}</span>
            <span style={{ fontSize:11, color:'#5A5A56' }}>{zh ? '没有账号？' : 'No account?'} <span style={{ color:'#6B6EF5', cursor:'pointer' }}>{zh ? '注册' : 'Sign up'}</span></span>
          </div>
        </div>
        <div style={{ padding:'10px 18px', background:'#141413', borderTop:'1px solid #1E1E1C', display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
          <span style={{ fontSize:10, color:'#3A3A38' }}>{zh ? '登录即表示同意服务条款' : 'By signing in you agree to Terms'}</span>
        </div>
      </div>
    </div>
  )
}

// ── File Manager dropdown ─────────────────────────────────────────────────────

function FileMenuDropdown({ lang, onClose, onSave, onRestore, canRestore, lastSavedAt, saveState }: {
  lang:Lang; onClose:()=>void; onSave:()=>void; onRestore:()=>void; canRestore:boolean; lastSavedAt:number|null
  saveState:'idle'|'saving'|'saved'|'restored'|'error'
}) {
  const zh = lang === 'zh'
  return (
    <div style={{
      position:'absolute', top:'calc(100% + 6px)', left:0,
      width:220, zIndex:100,
      background:'#1A1A19', border:'1px solid #2C2C2A', borderRadius:10,
      boxShadow:'0 12px 40px rgba(0,0,0,0.6)',
      overflow:'hidden',
    }}>
      {/* Save current project */}
      <button
        onClick={()=>{onSave();onClose()}}
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
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B6EF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
        </div>
        <span style={{ fontSize:12, fontWeight:600, color:'#C0C0BC', flex:1, textAlign:'left' }}>{zh ? '保存当前版本' : 'Save Current Version'}</span>
        <span style={{fontSize:9,color:'#4A4A48',fontFamily:"'JetBrains Mono',monospace"}}>⌘S</span>
      </button>

      <button disabled={!canRestore || saveState==='saving'}
        onClick={()=>{onRestore();onClose()}}
        style={{width:'100%',padding:'10px 14px',background:'transparent',border:'none',borderBottom:'1px solid #222220',
          display:'flex',alignItems:'center',gap:8,cursor:canRestore?'pointer':'default',fontFamily:"'Inter',sans-serif",opacity:canRestore?1:.42}}
        onMouseEnter={e=>{if(canRestore)e.currentTarget.style.background='#222220'}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
        <div style={{width:22,height:22,borderRadius:5,background:'#3BBDAF16',border:'1px solid #3BBDAF30',display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#55CDBF" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        </div>
        <span style={{fontSize:12,fontWeight:600,color:'#C0C0BC',flex:1,textAlign:'left'}}>{zh?'恢复已保存版本':'Restore Saved Version'}</span>
      </button>

      {/* Recent projects */}
      <div style={{ padding:'8px 14px 4px' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#3A3A38', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
          {zh ? '本地项目' : 'Local Project'}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0'}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'#5EC96E',boxShadow:'0 0 4px #5EC96E80'}}/>
          <span style={{fontSize:11,color:'#D0D0CC',fontWeight:600,flex:1}}>{zh?'夜晚驾驶灵感':'Night Drive Inspiration'}</span>
          <span style={{fontSize:9,color:'#4A4A48'}}>{lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString(zh?'zh-CN':'en-US',{hour:'2-digit',minute:'2-digit'}) : (zh?'自动保存中':'Autosaving')}</span>
        </div>
      </div>
      <div style={{ padding:'8px 14px 10px', borderTop:'1px solid #1E1E1C' }}>
        <div style={{padding:'4px 0',color:'#5A5A56',fontSize:10.5,display:'flex',alignItems:'center',gap:6}}>
          <span style={{color:'#5EC96E'}}>●</span>{zh?'自动保存已开启 · 素材保存在本机':'Autosave on · Assets stored locally'}
        </div>
      </div>
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
function GalleryIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></svg> }


function UserIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function GearIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> }
function SlidersIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> }
function KeyboardIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/></svg> }
function HelpIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function SwitchIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> }

function UndoIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1"/></svg> }
function RedoIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5M19 9H8a5 5 0 0 0 0 10h1"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function ShareIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> }
function ExportIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> }
