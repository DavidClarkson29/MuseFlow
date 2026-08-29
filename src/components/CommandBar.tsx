import { useState, useRef, useEffect } from 'react'
import type { Lang } from '../i18n'
import { strings } from '../i18n'

interface Props {
  lang: Lang
  onSubmit: (text: string) => void
  onClose: () => void
}

export default function CommandBar({ lang, onSubmit, onClose }: Props) {
  const s = strings[lang]
  const [val, setVal] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div style={{ position:'fixed', top:64, left:'50%', transform:'translateX(-50%)', zIndex:85, width:440 }}
      onClick={e=>e.stopPropagation()}>
      <div className="palette-appear" style={{
        background:'rgba(22,22,21,0.92)', backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        border:'1px solid #33333F', borderRadius:12,
        boxShadow:'0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(107,110,245,0.15)',
        padding:'10px 12px',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <span style={{ fontSize:8.5, fontWeight:800, padding:'2px 7px', borderRadius:5,
            background:'#6B6EF520', border:'1px solid #6B6EF545', color:'#8A8AFF', flexShrink:0 }}>⌘K</span>
          <input ref={ref} value={val}
            onChange={e=>setVal(e.target.value)}
            onKeyDown={e=>{
              if (e.key === 'Enter') { e.preventDefault(); onSubmit(val.trim()) }
              if (e.key === 'Escape') onClose()
            }}
            placeholder={s.cmdkPh}
            style={{ flex:1, minWidth:0, background:'transparent', border:'none', outline:'none',
              color:'#E8E8E4', fontSize:13.5, fontFamily:"'Inter',sans-serif" }}
          />
          <kbd style={{ fontSize:9.5, color:'#3A3A38' }}>esc</kbd>
        </div>
        <div style={{ fontSize:10, color:'#4A4A48', marginTop:7, paddingLeft:2 }}>{s.cmdkHint}</div>
      </div>
    </div>
  )
}
