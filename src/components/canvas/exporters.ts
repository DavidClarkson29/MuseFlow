import type { CanvasNode } from '../../types'

function safeFileName(raw: string) {
  const clean = raw.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ')
  return clean || 'MuseFlow Export'
}

function nodeName(node: CanvasNode) {
  const d = node.data
  const raw = String(d.name ?? d.title ?? d.label ?? d.fileName ?? node.id)
  if (raw === '__HUM__') return '哼唱片段'
  if (raw === '__REF__') return '参考音频'
  return raw.replace(/__/g, '')
}

function triggerDownload(href: string, fileName: string, revoke = false) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  if (revoke) window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}

function hashSeed(text: string) {
  let hash = 2166136261
  for (let i=0; i<text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return hash >>> 0
}

// The prototype has no persisted audio binary yet. This produces a small, valid,
// playable WAV so the export action remains real until a backend audioUrl is supplied.
function createPreviewWav(seedText: string) {
  const sampleRate = 22050
  const seconds = 2.4
  const sampleCount = Math.floor(sampleRate * seconds)
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)
  const write = (offset:number, text:string) => {
    for (let i=0; i<text.length; i++) view.setUint8(offset+i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + sampleCount*2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate*2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, sampleCount*2, true)

  const seed = hashSeed(seedText)
  const root = 110 * Math.pow(2, (seed % 12) / 12)
  for (let i=0; i<sampleCount; i++) {
    const t = i/sampleRate
    const fadeIn = Math.min(1, t/0.08)
    const fadeOut = Math.min(1, (seconds-t)/0.35)
    const pulse = 0.72 + 0.28*Math.sin(Math.PI*2*1.7*t)
    const wave = Math.sin(Math.PI*2*root*t)*0.52
      + Math.sin(Math.PI*2*root*1.5*t)*0.23
      + Math.sin(Math.PI*2*root*2*t)*0.12
    const value = Math.max(-1, Math.min(1, wave*fadeIn*fadeOut*pulse*0.55))
    view.setInt16(44+i*2, value*0x7fff, true)
  }
  return new Blob([buffer], { type:'audio/wav' })
}

export function isAudioExportNode(node: CanvasNode) {
  return node.type === 'audio'
    || node.type === 'work'
    || node.type === 'result'
    || (node.type === 'direction' && (!!node.data.demo || !!node.data.duration))
}

export function downloadNodeAudio(node: CanvasNode) {
  const name = safeFileName(nodeName(node))
  const audioUrl = typeof node.data.audioUrl === 'string' ? node.data.audioUrl : ''
  if (audioUrl) {
    const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(audioUrl)?.[1] ?? 'wav'
    triggerDownload(audioUrl, `${name}.${ext}`)
    return `${name}.${ext}`
  }
  const blobUrl = URL.createObjectURL(createPreviewWav(`${node.id}:${name}`))
  triggerDownload(blobUrl, `${name}.wav`, true)
  return `${name}.wav`
}

export function exportNodeLyrics(node: CanvasNode) {
  const title = safeFileName(String(node.data.title ?? '未命名歌词'))
  const sections = (node.data.sections as Array<{label?:string; content?:string}> | undefined) ?? []
  const body = sections.map(section => {
    const label = String(section.label ?? '段落').trim() || '段落'
    const content = String(section.content ?? '').trim()
    return `[${label}]${content ? `\n${content}` : ''}`
  }).join('\n\n')
  const text = `# ${title}\n\n${body || '[歌词]\n'}`
  const url = URL.createObjectURL(new Blob([`\uFEFF${text}`], { type:'text/plain;charset=utf-8' }))
  const fileName = `${title}.txt`
  triggerDownload(url, fileName, true)
  return fileName
}
