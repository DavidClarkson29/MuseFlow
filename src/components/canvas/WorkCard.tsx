import { useEffect, useState } from 'react'
import type { CanvasNode } from '../../types'
import { useLang } from '../../App'
import type { WorkItem } from './model'
import { AudioCardHeader, AudioCardMood, AudioCardPlayback, durationSeconds, WorkSourceRows } from './AudioCardPrimitives'

export function WorkContent({ node, onOpenDetail }: { node:CanvasNode; onOpenDetail:(id:string)=>void }) {
  return <WorkCard work={node.data as unknown as WorkItem} cardId={node.id} onOpenDetail={onOpenDetail}/>
}

function fallbackRatios(count:number, seed:string) {
  if (count <= 0) return []
  if (count === 1) return [100]
  let hash = [...seed].reduce((value,char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 2166136261)
  const minimum = count >= 4 ? 12 : 15
  const flexible = 100 - minimum * count
  const weights = Array.from({length:count}, () => {
    hash = (Math.imul(hash,1664525) + 1013904223) >>> 0
    return 0.35 + hash / 0xffffffff
  })
  const total = weights.reduce((sum,value)=>sum+value,0)
  const exact = weights.map(value=>minimum + value/total*flexible)
  const result = exact.map(Math.floor)
  let remainder = 100 - result.reduce((sum,value)=>sum+value,0)
  const order = exact.map((value,index)=>({index,fraction:value-Math.floor(value)})).sort((a,b)=>b.fraction-a.fraction)
  for (let i=0;i<remainder;i++) result[order[i%order.length].index] += 1
  if (result.every(value=>value===result[0])) { result[0] += 3; result[result.length-1] -= 3 }
  return result
}

export function WorkCard({ work:d, cardId, onOpenDetail, onRemove }: {
  work: WorkItem
  cardId: string
  onOpenDetail?: (id:string) => void
  onRemove?: () => void
}) {
  const s = useLang()
  const [playing,setPlaying] = useState(false)
  const [prog,setProg] = useState(0)
  const workDuration = String(d.duration ?? '3:30')
  useEffect(() => {
    if (!playing) return
    const total = Math.max(1,durationSeconds(workDuration))
    const t = window.setInterval(() => setProg(p => {
      const next = Math.min(100,p+100/(total*10))
      if (next >= 100) window.setTimeout(()=>setPlaying(false),0)
      return next
    }), 100)
    return () => window.clearInterval(t)
  }, [playing,workDuration])
  const color = d.color || '#8A7CFF', accent = d.accent || '#42D9D0'
  const sources = d.sources ?? []
  const mode = String(d.mode || 'remix').toUpperCase()
  const hasLyrics = !!(d as any).lyrics || (typeof (d as any).usedPrompt === 'string' && String((d as any).usedPrompt).includes('歌词'))
  return (
    <div data-card-kind="work" style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden',
      borderRadius:11, border:`1px solid ${color}55`,
      background:`radial-gradient(circle at 92% 6%,${accent}28,transparent 34%),radial-gradient(circle at 4% 100%,${color}28,transparent 42%),#15151B`,
      boxShadow:`0 14px 34px rgba(0,0,0,.42),0 0 28px ${color}18` }}>
      <AudioCardHeader title={d.name} badge={mode} primary={color} badgeColor={accent}
        hasLyrics={hasLyrics} onOpen={()=>onOpenDetail?.(cardId)} onRemove={onRemove} removeLabel="移除作品"/>
      <div data-card-part="body" style={{ padding:'9px 10px 8.75px',display:'flex',flexDirection:'column',gap:7,flex:1,minHeight:0 }}>
        <AudioCardMood label={String(d.mood ?? mode)} color={color}/>
        <WorkSourceRows sources={sources}/>
        <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',justifyContent:'center'}}>
          {(() => {
            const mk = String(d.mode ?? 'remix').toLowerCase()
            const isCover = mk === 'cover'
            if (isCover) {
              const v = Number((d as unknown as Record<string,unknown>).similarity ?? (d as unknown as Record<string,unknown>).ratio ?? 86)
              return (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:9}}><span style={{color:'#5D5B67'}}>{s.similarity}</span><span style={{color:'#817F8C',fontFamily:"'JetBrains Mono',monospace"}}>{v}%</span></div>
                  <div style={{height:3,borderRadius:2,background:'#2A2930'}}><div style={{width:`${v}%`,height:'100%',borderRadius:2,background:`linear-gradient(90deg,${color},${accent})`}}/></div>
                </>
              )
            }
            const n = sources.length
            if (n <= 1) {
              const v = Number((d as unknown as Record<string,unknown>).ratio ?? 100)
              return (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:9}}><span style={{color:'#5D5B67'}}>{s.originalRatio}</span><span style={{color:'#817F8C',fontFamily:"'JetBrains Mono',monospace"}}>{v}%</span></div>
                  <div style={{height:3,borderRadius:2,background:'#2A2930'}}><div style={{width:`${v}%`,height:'100%',borderRadius:2,background:color}}/></div>
                </>
              )
            }
            let segs: number[]
            if (n === 2) {
              const r1 = Number((d as unknown as Record<string,unknown>).ratio ?? 50)
              segs = [r1, 100 - r1]
            } else {
              const saved = d.sourceRatios
              segs = saved?.length === n && saved.reduce((sum,value)=>sum+value,0) === 100
                ? saved
                : fallbackRatios(n,cardId)
            }
            return (
              <>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:9}}><span style={{color:'#5D5B67'}}>{s.originalRatio}</span><span style={{color:'#817F8C',fontFamily:"'JetBrains Mono',monospace"}}>{segs.map(v=>`${v}%`).join(' · ')}</span></div>
                <div style={{display:'flex',height:3,borderRadius:2,background:'#2A2930',overflow:'hidden'}}>{segs.map((v,i)=><div key={i} style={{width:`${v}%`,background:(sources[i] as unknown as {color:string}|undefined)?.color ?? (i%2?accent:color)}}/>)}</div>
                {n < 4 && <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:3}}>{sources.map((s,i)=><span key={s.id} style={{fontSize:8,color:(s as unknown as {color:string}).color ?? (i%2?accent:color)}}>{String(s.name).slice(0,6)} {segs[i]}%</span>)}</div>}
              </>
            )
          })()}
        </div>
      <AudioCardPlayback playing={playing} progress={prog} duration={workDuration} primary={color} secondary={accent}
        onToggle={()=>{if(playing)setPlaying(false);else{if(prog>=100)setProg(0);setPlaying(true)}}}/>
      </div>
    </div>
  )
}
