import type { CanvasNode } from '../../types'
import { useLang } from '../../App'
import type { DemoItem } from './model'
import { AudioCardHeader, AudioCardMood, AudioCardPlayback } from './AudioCardPrimitives'
import { emitGuideEvent } from '../../guideEvents'
import { useAudioPlayback } from '../../hooks/useAudioPlayback'
import { resolveGuidedAudio } from '../../guidedAudio'
import { localizeBuiltinText } from '../../contentI18n'

// ── Direction（Demo 卡 · 精简动作）──

function DirActionBtn({ label, color, active, onClick }: { label:string; color:string; active?:boolean; onClick?:()=>void }) {
  return (
    <button
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick?.() }}
      style={{ flex:1, padding:'5px 0', fontSize:9.5, fontWeight:700,
        color: active ? '#fff' : color,
        background: active ? color : color+'14',
        border:`1px solid ${active ? color : color+'28'}`, borderRadius:6, cursor:'pointer',
        fontFamily:"'Inter',sans-serif", transition:'all 0.12s', whiteSpace:'nowrap',
        overflow:'hidden', textOverflow:'ellipsis' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = color+'2A' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? color : color+'14' }}
    >{label}</button>
  )
}

export function DirectionContent({ node, onOpenDetail }: {
  node: CanvasNode
  onOpenDetail: (id: string) => void
}) {
  return <DemoCard demo={node.data as unknown as DemoItem} cardId={node.id} onOpenDetail={onOpenDetail}/>
}

export function DemoCard({ demo:d, cardId, onOpenDetail, onRemove }: {
  demo: DemoItem
  cardId: string
  onOpenDetail?: (id: string) => void
  onRemove?: () => void
}) {
  const s = useLang()
  const lang=s.langToggle==='EN'?'zh':'en'
  const color = d.color
  const audioUrl=d.audioUrl??resolveGuidedAudio(d.name)?.audioUrl
  const hasLyrics = !!(d as any).lyrics || !!((d as any).recipe as any)?.lyrics || (typeof (d as any).usedPrompt === 'string' && String((d as any).usedPrompt).includes('歌词'))
  const {playing,progress,durationLabel,toggle,seek,audioProps}=useAudioPlayback({
    id:`demo:${cardId}`,title:localizeBuiltinText(d.name,lang),duration:d.duration||'0:30',color,audioUrl,
    onPlay:()=>emitGuideEvent({type:'demo-play',cardId}),
  })

  return (
    <div data-card-kind="demo" style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column',
      background:'#191918', border:`1px solid ${color}55`, borderRadius:11, overflow:'hidden',
      boxShadow:`0 8px 20px rgba(0,0,0,.3), 0 0 24px ${color}0D` }}>
      <AudioCardHeader title={localizeBuiltinText(d.name,lang)} badge={s.demo30} primary={color} badgeColor={color}
        hasLyrics={hasLyrics} onOpen={()=>onOpenDetail?.(cardId)} onRemove={onRemove} removeLabel={lang==='zh'?'移除 Demo':'Remove demo'}/>
      <div data-card-part="body" style={{ flex:1, minHeight:0, padding:'9px 10px 10px', display:'flex', flexDirection:'column', gap:7 }}>
        <AudioCardMood label={localizeBuiltinText(d.mood,lang)} color={color}/>

        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {([['style', s.style],['texture', s.texture],['rhythm', s.rhythm]] as const).map(([k, lb]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:9.5, color:'#4A4A48' }}>{lb}</span>
              <span style={{ fontSize:9.5, color:'#9A9A96', textAlign:'right', maxWidth:120 }}>{localizeBuiltinText(d[k],lang)}</span>
            </div>
          ))}
        </div>

        <div data-guide-target={`demo-play-${cardId}`} style={{marginTop:'auto'}}>
          <AudioCardPlayback playing={playing} progress={progress} duration={durationLabel} primary="#3BBDAF"
            onToggle={toggle} onSeek={seek}/>
          {audioProps&&<audio {...audioProps}/>} 
        </div>
      </div>
    </div>
  )
}
