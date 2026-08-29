import type { CanvasNode } from '../../types'
import { downloadNodeAudio, exportNodeLyrics, isAudioExportNode } from './exporters'

export function canExportNode(node: CanvasNode) {
  return node.type === 'lyrics' || isAudioExportNode(node)
}

export function CardContextMenu({ node, x, y, onClose, onExported, labels }: {
  node: CanvasNode
  x: number
  y: number
  onClose: () => void
  onExported: (fileName:string) => void
  labels: { downloadAudio:string; exportLyrics:string }
}) {
  const isLyrics = node.type === 'lyrics'
  const run = () => {
    const fileName = isLyrics ? exportNodeLyrics(node) : downloadNodeAudio(node)
    onExported(fileName)
    onClose()
  }
  return (
    <div
      data-card-context-menu="1"
      role="menu"
      onPointerDown={e=>e.stopPropagation()}
      onContextMenu={e=>{e.preventDefault();e.stopPropagation()}}
      style={{
        position:'absolute', left:x, top:y, zIndex:120, width:206, padding:5, boxSizing:'border-box',
        background:'rgba(25,25,24,.96)', border:'1px solid #353532', borderRadius:10,
        boxShadow:'0 18px 46px rgba(0,0,0,.58), inset 0 1px rgba(255,255,255,.035)',
        backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', userSelect:'none',
      }}
    >
      <button
        type="button"
        role="menuitem"
        data-export-action={isLyrics ? 'lyrics' : 'audio'}
        onClick={run}
        style={{
          width:'100%', height:34, border:0, borderRadius:7, padding:'0 9px',
          display:'flex', alignItems:'center', gap:9, cursor:'pointer',
          background:'transparent', color:'#D8D8D3', textAlign:'left',
          fontSize:10.5, fontWeight:600, fontFamily:"'Inter',sans-serif",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='#30302E'}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}
      >
        <span aria-hidden="true" style={{ width:19, height:19, borderRadius:5, display:'grid', placeItems:'center',
          color:isLyrics?'#E56B8A':'#55D7CA', background:isLyrics?'#E56B8A18':'#3BBDAF18',
          border:`1px solid ${isLyrics?'#E56B8A32':'#3BBDAF32'}`, fontSize:10 }}>
          {isLyrics ? '¶' : '↓'}
        </span>
        <span style={{ flex:1 }}>{isLyrics ? labels.exportLyrics : labels.downloadAudio}</span>
        <span style={{ color:'#5B5B57', fontSize:9 }}>{isLyrics ? '.txt' : '.wav'}</span>
      </button>
    </div>
  )
}
