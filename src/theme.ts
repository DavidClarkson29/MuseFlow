import type { CanvasNode } from './types'

// 唯一主题色来源：任何组件需要节点主题色都从这里取
export function nodeThemeColor(node: CanvasNode): string {
  switch (node.type) {
    case 'image':          return '#3BBDAF'
    case 'audio':          return node.data.isRef ? '#4BA35A' : '#F5A523'
    case 'text':           return '#6B6EF5'
    case 'intent':         return '#9B7EFF'
    case 'constraint':     return '#E06A5A'
    case 'question':       return '#F5C87A'
    case 'note':           return '#D8C46A'
    case 'direction':      return String(node.data.color ?? '#8A8A86')
    case 'audioFolder':    return '#8A7CFF'
    case 'work':           return String(node.data.color ?? '#A56CFF')
    case 'lyrics':         return '#E56B8A'
    case 'fuse':           return '#F06090'
    case 'brief':
    case 'result':
    case 'prompt':         return '#3BBDAF'
    case 'interpretation':
    case 'explore':
    case 'field':          return '#6B6EF5'
    default:               return '#8A8A86'
  }
}

export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(v.slice(0, 6), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
