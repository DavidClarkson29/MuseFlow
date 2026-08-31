import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import type { CanvasNode, Wire } from '../types'
import { localizeBuiltinText } from '../contentI18n'

export interface GalleryBoard {
  id: string
  name: string
  nodes: CanvasNode[]
  wires: Wire[]
  updatedAt: number
  thumbnail?: string
  thumbnailAspect?: number
  kind?: 'user'|'example'
  description?: string
  durationLabel?: string
  templateVersion?: number
}

interface Props {
  lang: Lang
  boards: GalleryBoard[]
  activeBoardId: string
  closing: boolean
  testMode: boolean
  onClose: () => void
  onToggleLang: () => void
  onTestModeChange: (enabled:boolean) => void
  onOpenBoard: (id:string) => void
  onCreateBoard: () => void
  onDeleteBoard: (id:string) => void
}

export default function ProjectGallery({ lang, boards, activeBoardId, closing, testMode, onClose, onToggleLang, onTestModeChange, onOpenBoard, onCreateBoard, onDeleteBoard }:Props) {
  const zh = lang === 'zh'
  const [query,setQuery] = useState('')
  const [showProfile,setShowProfile] = useState(false)
  const [pendingDeleteId,setPendingDeleteId] = useState<string | null>(null)
  const profileRef=useRef<HTMLDivElement>(null)
  const shown = useMemo(() => boards.filter(board => localizeBuiltinText(board.name,lang).toLowerCase().includes(query.trim().toLowerCase())),[boards,query,lang])

  useEffect(() => {
    const onKeyDown = (event:KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (pendingDeleteId) setPendingDeleteId(null)
      else onClose()
    }
    window.addEventListener('keydown',onKeyDown)
    return () => window.removeEventListener('keydown',onKeyDown)
  },[onClose,pendingDeleteId])

  useEffect(()=>{
    if(!showProfile) return
    const close=(event:MouseEvent)=>{if(profileRef.current&&!profileRef.current.contains(event.target as Node))setShowProfile(false)}
    document.addEventListener('mousedown',close)
    return()=>document.removeEventListener('mousedown',close)
  },[showProfile])

  return (
    <div className={`project-gallery ${closing ? 'project-gallery--closing' : ''}`} role="dialog" aria-label={zh?'画板总览':'Board gallery'}>
      <header className="project-gallery__header">
        <div className="project-gallery__brand">
          <span className="project-gallery__wordmark">Museflow</span>
          <span className="project-gallery__divider"/>
          <span className="project-gallery__title">{zh?'所有画板':'All Boards'}</span>
        </div>
        <div className="project-gallery__actions">
          <label className="project-gallery__search">
            <SearchIcon/>
            <input value={query} onChange={event=>setQuery(event.target.value)} placeholder={zh?'搜索画板':'Search boards'} />
          </label>
          <button className="project-gallery__close" onClick={onClose} aria-label={zh?'返回当前画板':'Return to current board'}>
            <CloseIcon/>
          </button>
          <button className="project-gallery__lang" onClick={onToggleLang}>{zh?'EN':'中'}</button>
          <div className="project-gallery__profile" ref={profileRef}>
            <button className={`project-gallery__avatar ${showProfile?'project-gallery__avatar--active':''}`} onClick={()=>setShowProfile(value=>!value)} aria-label={zh?'用户菜单':'User menu'}>
              <img src="https://i.pravatar.cc/200?img=15" alt="avatar"/>
              <i/>
            </button>
            {showProfile && <GalleryProfileMenu lang={lang} testMode={testMode} onTestModeChange={onTestModeChange}/>} 
          </div>
        </div>
      </header>

      <main className="project-gallery__main thin-scroll">
        <div className="project-gallery__intro">
          <div>
            <h1>{zh?'你的创作空间':'Your creative spaces'}</h1>
            <p>{zh?'选择一个画板继续创作，或从一张空白画布开始。':'Choose a board to continue, or begin with a blank canvas.'}</p>
          </div>
          <div className="project-gallery__create-area">
            <p className="project-gallery__archive-disclaimer">{zh?'该作品仅作为UI/UX演示原型，不具备存档功能':'This work is a UI/UX demonstration prototype only and does not provide archive functionality.'}</p>
            <button className="project-gallery__new-button" onClick={onCreateBoard}><PlusIcon/>{zh?'新建画板':'New board'}</button>
          </div>
        </div>

        <section className="project-gallery__grid" aria-label={zh?'画板列表':'Board list'}>
          {shown.map((board,index) => (
            <div key={board.id} className="project-board-shell">
              <button className={`project-board ${board.id===activeBoardId?'project-board--active':''} ${board.kind==='example'?'project-board--example':''}`}
                style={{ animationDelay:`${Math.min(index,5)*35}ms` }} onClick={()=>onOpenBoard(board.id)}>
                <div className="project-board__preview" style={board.thumbnailAspect?{aspectRatio:String(board.thumbnailAspect)}:undefined}>
                  <BoardThumbnail board={board} lang={lang}/>
                  <span className="project-board__open">{zh?'打开画板':'Open board'} <span>↗</span></span>
                </div>
                <div className="project-board__meta">
                  <span className="project-board__name">{board.kind==='example' && <i className="project-board__example-badge">{zh?'实例':'Example'}</i>}{localizeBuiltinText(board.name,lang)}</span>
                  <span className="project-board__time">{formatUpdated(board.updatedAt,lang)}</span>
                </div>
                <div className="project-board__submeta">
                  <span>{board.kind==='example' ? localizeBuiltinText(board.description,lang) : (zh?`${board.nodes.filter(node=>node.visible).length} 张卡片`:`${board.nodes.filter(node=>node.visible).length} cards`)}</span>
                  {board.kind==='example' && <span className="project-board__duration">◷ {localizeBuiltinText(board.durationLabel,lang)}</span>}
                  {board.id===activeBoardId && <span className="project-board__current">{zh?'当前画板':'Current'}</span>}
                </div>
              </button>
              {board.kind!=='example' && (
                <button className="project-board__delete" aria-label={zh?`删除画板 ${board.name}`:`Delete board ${localizeBuiltinText(board.name,lang)}`}
                  onClick={event=>{event.stopPropagation();setPendingDeleteId(board.id)}}><TrashIcon/></button>
              )}
              {pendingDeleteId===board.id && board.kind!=='example' && (
                <div className="project-board__delete-confirm" onClick={event=>event.stopPropagation()}>
                  <strong>{zh?'删除这个存档？':'Delete this board?'}</strong>
                  <span>{zh?'删除后无法恢复':'This cannot be undone'}</span>
                  <div><button onClick={()=>setPendingDeleteId(null)}>{zh?'取消':'Cancel'}</button><button className="is-danger" onClick={()=>{setPendingDeleteId(null);onDeleteBoard(board.id)}}>{zh?'删除':'Delete'}</button></div>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>
}

function BoardThumbnail({board,lang}:{board:GalleryBoard;lang:Lang}) {
  if (board.thumbnail) return <img className="board-shot-image" src={board.thumbnail} alt="" draggable={false}/>
  const visible = board.nodes.filter(node=>node.visible)
  const bounds = visible.reduce((acc,node) => ({
    minX:Math.min(acc.minX,node.x), minY:Math.min(acc.minY,node.y),
    maxX:Math.max(acc.maxX,node.x+node.w), maxY:Math.max(acc.maxY,node.y+node.h),
  }),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity})
  const empty = !visible.length
  const sceneW = empty ? 900 : Math.max(720,bounds.maxX-bounds.minX+160)
  const sceneH = empty ? 520 : Math.max(440,bounds.maxY-bounds.minY+140)
  const originX = empty ? 0 : bounds.minX-80
  const originY = empty ? 0 : bounds.minY-70
  const nodeMap = new Map(visible.map(node=>[node.id,node]))

  return (
    <div className="board-shot">
      <div className="board-shot__toolbar">
        <i/><b>Museflow</b><span/><span/><em>{localizeBuiltinText(board.name,lang)}</em><i/><i/>
      </div>
      <div className="board-shot__workspace">
        <div className="board-shot__rail"><span/><span/><span/><span/><span/></div>
        <div className="board-shot__canvas">
          {empty ? <div className="board-shot__empty"><span>＋</span></div> : (
            <svg viewBox={`0 0 ${sceneW} ${sceneH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs><pattern id={`dots-${board.id}`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#292927"/></pattern></defs>
              <rect width={sceneW} height={sceneH} fill="#10100f"/>
              <rect width={sceneW} height={sceneH} fill={`url(#dots-${board.id})`}/>
              {board.wires.map(wire => {
                const from=nodeMap.get(wire.fromNodeId), to=nodeMap.get(wire.toNodeId)
                if (!from || !to) return null
                const x1=from.x-originX+from.w, y1=from.y-originY+from.h/2, x2=to.x-originX, y2=to.y-originY+to.h/2
                return <path key={wire.id} d={`M${x1} ${y1} C${(x1+x2)/2} ${y1},${(x1+x2)/2} ${y2},${x2} ${y2}`} fill="none" stroke={wire.color || '#6B6EF5'} strokeWidth="3" opacity=".46"/>
              })}
              {visible.map(node => <MiniNode key={node.id} node={node} x={node.x-originX} y={node.y-originY} lang={lang}/>)}
            </svg>
          )}
        </div>
        <div className="board-shot__inspector"><b/><span/><span/><span/><span/><i/></div>
      </div>
    </div>
  )
}

function GalleryProfileMenu({lang,testMode,onTestModeChange}:{lang:Lang;testMode:boolean;onTestModeChange:(enabled:boolean)=>void}) {
  const zh=lang==='zh'
  return <div className="gallery-profile-menu inspector-appear">
    <div className="gallery-profile-menu__user">
      <img src="https://i.pravatar.cc/200?img=15" alt="avatar"/>
      <span><b>Alex Chen</b><em>alex@museflow.studio</em></span>
      <i>Pro</i>
    </div>
    <div className="gallery-profile-menu__items">
      <button><span>◎</span><b>{zh?'个人资料与账户':'Profile & account'}</b></button>
      <button><span>⌘</span><b>{zh?'偏好设置':'Preferences'}</b></button>
      <button onClick={()=>onTestModeChange(!testMode)}><span>⚗</span><b>{zh?'测试模式':'Test mode'}</b><i className={testMode?'is-on':''}><em/></i></button>
    </div>
    <div className="gallery-profile-menu__footer"><span>Museflow 1.0 · 2026</span><b>{zh?'已备份 ✓':'Backed up ✓'}</b></div>
  </div>
}

function MiniNode({node,x,y,lang}:{node:CanvasNode;x:number;y:number;lang:Lang}) {
  const color = nodeColor(node.type)
  const label = String(node.data.name ?? node.data.label ?? node.data.content ?? node.type)
  const imageUrl = typeof node.data.imageUrl === 'string' ? node.data.imageUrl : ''
  return <g transform={`translate(${x} ${y})`}>
    <rect width={node.w} height={node.h} rx="12" fill="#191918" stroke={color} strokeWidth="2.2"/>
    <rect width={node.w} height="35" rx="12" fill="#141413"/>
    <path d={`M0 35H${node.w}`} stroke="#30302e"/>
    <circle cx="17" cy="17.5" r="6" fill={color} opacity=".8"/>
    <text x="30" y="22" fill="#c8c8c4" fontSize="13" fontWeight="700" fontFamily="Inter,Arial">{localizeBuiltinText(label,lang).slice(0,18)}</text>
    {imageUrl ? <image href={imageUrl} x="0" y="35" width={node.w} height={Math.max(0,node.h-35)} preserveAspectRatio="xMidYMid slice" opacity=".78"/> : <>
      <rect x="16" y="53" width={Math.max(20,node.w-32)} height="7" rx="3.5" fill={color} opacity=".22"/>
      <rect x="16" y="69" width={Math.max(18,(node.w-32)*.68)} height="5" rx="2.5" fill="#555550" opacity=".4"/>
      {node.h>110 && <rect x="16" y={node.h-27} width={Math.max(18,(node.w-32)*.82)} height="5" rx="2.5" fill="#31312f"/>}
    </>}
  </g>
}

function nodeColor(type:CanvasNode['type']) {
  if (type==='image') return '#42D9D0'
  if (type==='audio') return '#55C46A'
  if (type==='lyrics') return '#E56B8A'
  if (type==='audioFolder' || type==='work') return '#8A72FF'
  if (type==='direction') return '#F5A523'
  if (type==='frame') return '#6B6EF5'
  return '#7777E8'
}

function formatUpdated(value:number,lang:Lang) {
  const delta=Math.max(0,Date.now()-value)
  if (delta<60_000) return lang==='zh'?'刚刚':'Just now'
  if (delta<3_600_000) return lang==='zh'?`${Math.floor(delta/60_000)} 分钟前`:`${Math.floor(delta/60_000)}m ago`
  if (delta<86_400_000) return lang==='zh'?`${Math.floor(delta/3_600_000)} 小时前`:`${Math.floor(delta/3_600_000)}h ago`
  return new Date(value).toLocaleDateString(lang==='zh'?'zh-CN':'en-US',{month:'short',day:'numeric'})
}

function SearchIcon(){return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>}
function CloseIcon(){return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 18-6-6 6-6"/></svg>}
function PlusIcon(){return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}
