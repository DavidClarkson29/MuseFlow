import { useEffect, useRef, useState } from 'react'

export function NodeHdr({ label, icon, accent, editable, onRename }: {
  label: string; icon?: React.ReactNode; accent?: string
  editable?: boolean; onRename?: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastClickRef = useRef(0)
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  // Finder 式慢速双击重命名：首次点击=选中；间隔 >300ms 的再次点击=进入重命名；快速双击=不动作
  const onLabelClick = () => {
    if (!editable) return
    const now = Date.now()
    const prev = lastClickRef.current
    const gap = now - prev
    lastClickRef.current = now
    if (prev === 0) return          // 首次点击：仅选中
    if (gap < 300) return           // 快速双击：不动作
    if (gap > 1500) return          // 间隔太久：视为重新选中
    setVal(label); setEditing(true) // 慢速第二次点击：进入重命名
  }
  const commit = () => {
    setEditing(false)
    const v = val.trim()
    if (v && v !== label && editable && onRename) onRename(v)
    else setVal(label)
  }
  return (
    <div style={{
      height:34, background:'#141413', borderBottom:'1px solid #2C2C2A',
      display:'flex', alignItems:'center', padding:'0 10px', gap:7, flexShrink:0,
    }}>
      {icon && (
        <div style={{
          width:18, height:18, borderRadius:4, flexShrink:0,
          background: accent ? accent+'20' : '#1E1E1C',
          border:`1px solid ${accent ? accent+'40' : '#2C2C2A'}`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10,
        }}>{icon}</div>
      )}
      {editing && editable ? (
        <input ref={inputRef} value={val}
          onChange={e=>setVal(e.target.value)}
          onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}
          onKeyDown={e=>{ e.stopPropagation()
            if (e.key==='Enter') commit()
            if (e.key==='Escape') { setEditing(false); setVal(label) } }}
          onBlur={commit}
          style={{ flex:1, minWidth:0, background:'rgba(0,0,0,0.3)',
            border:`1px solid ${accent ?? '#6B6EF5'}60`,
            borderRadius:4, color:'#E0E0DC', fontSize:10.5, fontWeight:600,
            outline:'none', padding:'2px 6px' }}/>
      ) : (
        <span
          onClick={onLabelClick}
          title={editable ? '再次点击重命名' : undefined}
          style={{ fontSize:11, fontWeight:600, color:'#7A7A76', letterSpacing:'-0.01em',
            cursor: editable ? 'text' : 'default', minWidth:0,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
      )}
    </div>
  )
}

