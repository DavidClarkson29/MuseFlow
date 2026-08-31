import { useLang } from '../App'

interface Props {
  colors: string[]
  accent: string
  size?: 'compact' | 'header' | 'rack'
}

/** A tiny live inventory map. It is data preview, not a type icon. */
export function MaterialMiniature({ colors, accent, size = 'header' }: Props) {
  const s=useLang()
  const visible = colors.slice(0, 16)
  const count = visible.length
  const columns = count <= 4 ? 2 : count <= 9 ? 3 : 4
  const cell = size === 'compact' ? (columns >= 4 ? 2.5 : 3.5)
    : size === 'rack' ? (columns >= 4 ? 3.5 : columns === 3 ? 4.5 : 5.5)
    : (columns >= 4 ? 3 : columns === 3 ? 4 : 5)
  const gap = size === 'compact' ? 2 : size === 'rack' ? 3 : 2.5
  const width = size === 'compact' ? 25 : size === 'rack' ? 34 : 31
  const height = size === 'compact' ? 20 : size === 'rack' ? 34 : 25
  const fallback = ['#6B6EF5', '#3BBDAF', '#F5A523', '#4BA35A']
  const cells = count ? visible : fallback

  return (
    <span aria-label={s.langToggle==='EN'?`${count} 个内部素材`:`${count} internal materials`} style={{
      width, height, boxSizing:'border-box', flexShrink:0, borderRadius:size === 'compact' ? 6 : size === 'rack' ? 9 : 7,
      display:'grid', gridTemplateColumns:`repeat(${columns},${cell}px)`, gridAutoRows:`${cell}px`,
      gap, placeContent:'center', background:`linear-gradient(145deg,${accent}16,#16161B)`,
      border:`1px solid ${accent}38`, boxShadow:`inset 0 1px rgba(255,255,255,.035)`,
    }}>
      {cells.map((color,index) => (
        <i key={index} style={{ width:cell, height:cell, display:'block', borderRadius:Math.max(1,cell*.28),
          background:color, opacity:count ? .94 : index === 0 ? .68 : .2 }}/>
      ))}
    </span>
  )
}
