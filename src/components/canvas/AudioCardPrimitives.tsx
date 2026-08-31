import type { WorkSource } from './model'
import { useLang } from '../../App'
import { localizeBuiltinText } from '../../contentI18n'

export function WorkSourceRows({sources}:{sources:WorkSource[]}) {
  const s=useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const isTwoByTwo = sources.length >= 4
  return (
    <div style={{display:'grid',gridTemplateColumns:isTwoByTwo?'repeat(2,minmax(0,1fr))':'1fr',gap:4}}>
      {sources.slice(0,4).map(source => (
        <div key={source.id} style={{display:'flex',alignItems:'center',justifyContent:'flex-start',gap:5,minWidth:0,fontSize:isTwoByTwo?8.5:9.5,color:source.color}}>
          <i style={{width:5,height:5,borderRadius:'50%',background:source.color,boxShadow:`0 0 7px ${source.color}`,flexShrink:0}}/>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:source.color}}>{localizeBuiltinText(source.name,lang)}</span>
        </div>
      ))}
    </div>
  )
}

export function durationSeconds(raw:string) {
  const parts = raw.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
  return parts.length === 2 ? parts[0]*60+parts[1] : parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2] : parts[0]
}

function clockLabel(seconds:number) {
  const value = Math.max(0,Math.floor(seconds))
  const mins = Math.floor(value/60), secs = value%60
  return `${mins}:${String(secs).padStart(2,'0')}`
}

function playbackTimeLabel(progress:number,duration:string) {
  const total = durationSeconds(duration)
  return `${clockLabel(total*progress/100)} / ${clockLabel(total)}`
}

export function AudioCardHeader({title,badge,primary,badgeColor,onOpen,onRemove,removeLabel,hasLyrics}:{
  title:string; badge:string; primary:string; badgeColor:string
  onOpen?:()=>void; onRemove?:()=>void; removeLabel:string; hasLyrics?:boolean
}) {
  const s=useLang()
  return <div data-card-part="header" style={{height:38,flexShrink:0,display:'flex',alignItems:'center',gap:7,
    padding:'0 10px',borderTop:`2px solid ${primary}`,borderBottom:'1px solid #ffffff0D',background:'rgba(20,20,19,.72)'}}>
    <strong onClick={e=>{e.stopPropagation();onOpen?.()}}
      style={{flex:1,minWidth:0,fontSize:11.5,fontWeight:700,color:'#F1F0EE',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}>{title}</strong>
    {hasLyrics && (
      <span title={s.langToggle==='EN'?'含歌词':'Includes lyrics'} style={{
        fontSize:9, fontWeight:600, flexShrink:0,
        color:'#E56B8A', background:'#E56B8A12', border:'1px solid #E56B8A28',
        borderRadius:12, padding:'2px 7px',
      }}>{s.langToggle==='EN'?'词':'LYR'}</span>
    )}
    <span style={{fontSize:8.5,fontWeight:800,color:badgeColor,background:badgeColor+'12',border:`1px solid ${badgeColor}38`,
      borderRadius:12,padding:'2px 7px',flexShrink:0}}>{badge}</span>
    {onRemove && <button aria-label={removeLabel} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onRemove()}}
      style={{width:18,height:18,padding:0,border:0,background:'transparent',color:'#65636F',fontSize:14,lineHeight:'18px',cursor:'pointer',flexShrink:0}}>×</button>
    }
  </div>
}

export function AudioCardMood({label,color}:{label:string;color:string}) {
  return <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
    <span style={{fontSize:9,fontWeight:600,color,background:color+'12',border:`1px solid ${color}28`,borderRadius:12,padding:'2px 7px'}}>{label}</span>
  </div>
}

export function AudioCardPlayback({playing,progress,duration,primary,secondary,onToggle,onSeek}:{
  playing:boolean;progress:number;duration:string;primary:string;secondary?:string;onToggle:()=>void;onSeek?:(progress:number)=>void
}) {
  const s=useLang()
  const fill = secondary ? `linear-gradient(90deg,${primary},${secondary})` : primary
  const seekFromPointer=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(!onSeek)return
    const rect=event.currentTarget.getBoundingClientRect()
    onSeek((event.clientX-rect.left)/rect.width*100)
  }
  return <div data-card-part="playback" data-guide-audio-control="1" style={{display:'flex',alignItems:'center',gap:7,marginTop:'auto'}}>
    <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onToggle()}}
      style={{width:30,height:30,borderRadius:8,flexShrink:0,cursor:'pointer',background:primary+'14',border:`1px solid ${primary}40`,
        color:primary,display:'flex',alignItems:'center',justifyContent:'center'}}>
      {playing
        ? <svg width="10" height="10" viewBox="0 0 24 24" fill={primary}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        : <svg width="10" height="10" viewBox="0 0 24 24" fill={primary}><path d="M5 3l14 9-14 9V3z"/></svg>}
    </button>
    <span style={{flexShrink:0,fontSize:9.5,color:'#66716F',fontFamily:"'JetBrains Mono',monospace"}}>{playbackTimeLabel(progress,duration)}</span>
    <div role={onSeek?'slider':undefined} tabIndex={onSeek?0:undefined} aria-label={onSeek?(s.langToggle==='EN'?'音频进度':'Audio progress'):undefined} aria-valuemin={onSeek?0:undefined} aria-valuemax={onSeek?100:undefined} aria-valuenow={onSeek?Math.round(progress):undefined}
      onPointerDown={onSeek?event=>{event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);seekFromPointer(event)}:undefined}
      onPointerMove={onSeek?event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))seekFromPointer(event)}:undefined}
      onPointerUp={onSeek?event=>{event.stopPropagation();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}:undefined}
      onKeyDown={onSeek?event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();onSeek(progress+(event.key==='ArrowRight'?5:-5))}}:undefined}
      style={{flex:1,minWidth:24,height:7,padding:'2px 0',borderRadius:3,cursor:onSeek?'pointer':'default'}}>
      <div style={{height:3,borderRadius:3,background:'rgba(255,255,255,.085)',boxShadow:'inset 0 1px 2px rgba(0,0,0,.5)',overflow:'hidden'}}>
      <div style={{width:`${progress}%`,height:'100%',borderRadius:3,background:fill,boxShadow:`0 0 7px ${(secondary??primary)}80`,transition:'width .1s linear'}}/>
      </div>
    </div>
  </div>
}
