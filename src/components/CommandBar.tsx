import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { strings } from '../i18n'
import type { CanvasNode } from '../types'
import { localizeBuiltinText } from '../contentI18n'
import { nodeThemeColor } from '../theme'

interface Props {
  lang: Lang
  nodes: CanvasNode[]
  onSelect: (nodeId:string) => void
  onClose: () => void
}

function typeLabel(node:CanvasNode,lang:Lang) {
  const s=strings[lang]
  if(node.type==='image')return s.hdrImage
  if(node.type==='audio')return node.data.isRef?s.addRefAudio:s.addHumClip
  if(node.type==='text')return s.hdrText
  if(node.type==='lyrics')return s.nodeLyrics
  if(node.type==='frame')return s.frameTitle
  if(node.type==='audioFolder')return s.audioFolderTitle
  if(node.type==='direction')return s.demo30
  if(node.type==='work'||node.type==='result')return s.fullTrack
  if(node.type==='note')return s.noteLabel
  return localizeBuiltinText(node.type,lang)
}

function searchableText(node:CanvasNode,lang:Lang) {
  const d=node.data as Record<string,unknown>
  const sections=Array.isArray(d.sections)?d.sections as Array<{label?:string;content?:string}>:[]
  const values=[d.name,d.title,d.label,d.fileName,d.content,d.text,d.mood,d.style,d.texture,d.rhythm,d.negative,d.prompt,
    ...sections.flatMap(section=>[section.label,section.content]),node.type,typeLabel(node,lang)]
  return values.flatMap(value=>[String(value??''),localizeBuiltinText(value,lang)]).join(' ').toLocaleLowerCase()
}

function nodeTitle(node:CanvasNode,lang:Lang) {
  const d=node.data
  const raw=node.type==='audioFolder' ? strings[lang].audioFolderTitle
    : d.name ?? d.title ?? d.label ?? d.fileName ?? typeLabel(node,lang)
  return localizeBuiltinText(raw,lang).replace(/__/g,'') || typeLabel(node,lang)
}

function nodeDetail(node:CanvasNode,lang:Lang) {
  const d=node.data
  const raw=d.fileName ?? d.content ?? d.text ?? d.mood ?? d.style ?? ''
  const text=localizeBuiltinText(raw,lang).replace(/\s+/g,' ').trim()
  return text && text!==nodeTitle(node,lang) ? text : (lang==='zh'?'点击定位到画布':'Open on canvas')
}

export default function CommandBar({lang,nodes,onSelect,onClose}:Props) {
  const [query,setQuery]=useState('')
  const [active,setActive]=useState(0)
  const inputRef=useRef<HTMLInputElement>(null)
  const visible=useMemo(()=>nodes.filter(node=>node.visible&&node.type!=='field'),[nodes])
  const results=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase()
    const candidates=q?visible.filter(node=>searchableText(node,lang).includes(q)):visible
    return candidates.slice(0,8)
  },[lang,query,visible])

  useEffect(()=>inputRef.current?.focus(),[])
  useEffect(()=>setActive(0),[query])

  const choose=(node:CanvasNode|undefined)=>{
    if(!node)return
    onSelect(node.id)
    onClose()
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={lang==='zh'?'搜索画板':'Search board'}
      onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}
      style={{position:'fixed',inset:0,zIndex:110,display:'grid',placeItems:'center',background:'rgba(0,0,0,.34)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)'}}>
      <div className="palette-appear" onPointerDown={event=>event.stopPropagation()} style={{
        position:'relative',width:'min(520px,calc(100vw - 32px))',
        background:'rgba(22,22,21,.97)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
        border:'1px solid #33333F',borderRadius:13,boxShadow:'0 24px 70px rgba(0,0,0,.72),0 0 0 1px rgba(107,110,245,.14)',overflow:'hidden',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid #292929'}}>
          <span aria-hidden="true" style={{color:'#8A8AFF',fontSize:16}}>⌕</span>
          <input ref={inputRef} value={query} onChange={event=>setQuery(event.target.value)}
            onKeyDown={event=>{
              if(event.key==='Escape')onClose()
              if(event.key==='ArrowDown'){event.preventDefault();setActive(value=>results.length?Math.min(results.length-1,value+1):0)}
              if(event.key==='ArrowUp'){event.preventDefault();setActive(value=>Math.max(0,value-1))}
              if(event.key==='Enter'){event.preventDefault();choose(results[active])}
            }}
            placeholder={lang==='zh'?'搜索卡片、歌词、音频或内容…':'Search cards, lyrics, audio, or content…'}
            aria-label={lang==='zh'?'搜索画板内容':'Search board content'}
            style={{flex:1,minWidth:0,background:'transparent',border:0,outline:0,color:'#EEEEEA',fontSize:14,fontFamily:"'Inter',sans-serif"}}/>
          <kbd style={{padding:'2px 6px',border:'1px solid #343432',borderRadius:5,color:'#656560',fontSize:9}}>ESC</kbd>
        </div>

        <div style={{padding:'7px',maxHeight:390,overflowY:'auto'}} className="thin-scroll">
          <div style={{padding:'4px 8px 7px',fontSize:8.5,fontWeight:800,color:'#5A5A56',letterSpacing:'.08em',textTransform:'uppercase'}}>
            {query.trim()?(lang==='zh'?`${results.length} 个搜索结果`:`${results.length} results`):(lang==='zh'?'画板内容':'Board contents')}
          </div>
          {results.length===0 ? (
            <div style={{padding:'30px 16px 34px',textAlign:'center',color:'#62625E'}}>
              <div style={{fontSize:20,marginBottom:8,opacity:.65}}>⌕</div>
              <div style={{fontSize:11.5,fontWeight:650}}>{lang==='zh'?'没有找到匹配内容':'No matching content found'}</div>
              <div style={{fontSize:9.5,color:'#454542',marginTop:5}}>{lang==='zh'?'尝试名称、类型或歌词中的关键词':'Try a name, type, or lyric keyword'}</div>
            </div>
          ) : results.map((node,index)=>{
            const color=nodeThemeColor(node)
            return <button key={node.id} onMouseEnter={()=>setActive(index)} onClick={()=>choose(node)}
              style={{width:'100%',height:54,padding:'0 10px',display:'flex',alignItems:'center',gap:10,borderRadius:8,
                border:active===index?'1px solid #6B6EF542':'1px solid transparent',background:active===index?'#292932':'transparent',
                color:'#D8D8D4',cursor:'pointer',textAlign:'left',fontFamily:"'Inter',sans-serif"}}>
              <span style={{width:28,height:28,display:'grid',placeItems:'center',borderRadius:7,background:`${color}14`,border:`1px solid ${color}32`,color,fontSize:11,fontWeight:850}}>
                {node.type==='lyrics'?'♪':node.type==='audio'||node.type==='direction'||node.type==='work'?'♫':node.type==='image'?'▧':node.type==='frame'?'▢':'•'}
              </span>
              <span style={{flex:1,minWidth:0}}>
                <strong style={{display:'block',fontSize:11.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nodeTitle(node,lang)}</strong>
                <span style={{display:'block',marginTop:3,fontSize:9.5,color:'#777772',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nodeDetail(node,lang)}</span>
              </span>
              <span style={{fontSize:8.5,fontWeight:750,color,background:`${color}10`,border:`1px solid ${color}28`,borderRadius:10,padding:'2px 7px',whiteSpace:'nowrap'}}>{typeLabel(node,lang)}</span>
              {active===index&&<span style={{fontSize:9,color:'#6B6EF5'}}>↵</span>}
            </button>
          })}
        </div>
        <div style={{display:'flex',gap:12,padding:'8px 14px',borderTop:'1px solid #292929',fontSize:8.5,color:'#4F4F4A'}}>
          <span>↑↓ {lang==='zh'?'选择':'Select'}</span><span>↵ {lang==='zh'?'打开':'Open'}</span><span>ESC {lang==='zh'?'关闭':'Close'}</span>
        </div>
      </div>
    </div>
  )
}
