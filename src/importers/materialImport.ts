import type { CanvasNode } from '../types'
import { storeImportedAsset, type ImportKind } from '../storage/projectStore'

function importId(prefix:string) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0,6)}`
}

function baseName(fileName:string) {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}

function isImage(file:File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name)
}

function isAudio(file:File) {
  return file.type.startsWith('audio/') || /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(file.name)
}

function formatDuration(seconds:number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds/60)
  return `${minutes}:${Math.floor(seconds%60).toString().padStart(2,'0')}`
}

function readAudioDuration(url:string) {
  return new Promise<string>(resolve => {
    const audio = new Audio()
    const finish = () => resolve(formatDuration(audio.duration))
    audio.preload = 'metadata'
    audio.onloadedmetadata = finish
    audio.onerror = () => resolve('0:00')
    audio.src = url
  })
}

export async function createImportedNodes(files:File[], kind:ImportKind, startX:number, startY:number) {
  const nodes:CanvasNode[] = []
  for (const [index,file] of files.entries()) {
    const fileIsImage = isImage(file)
    const fileIsAudio = isAudio(file)
    const accepted = kind === 'image' ? fileIsImage
      : kind === 'audio-hum' || kind === 'audio-ref' ? fileIsAudio
      : fileIsImage || fileIsAudio
    if (!accepted) continue
    const assetId = await storeImportedAsset(file)
    const url = URL.createObjectURL(file)
    const x = startX + (index%3)*26
    const y = startY + (index%3)*24
    if (fileIsImage) {
      nodes.push({
        id:importId('img'), type:'image', x, y, w:200, h:176, visible:true, selected:false, inputs:[], outputs:[],
        data:{ label:'图片素材', name:baseName(file.name), imageUrl:url, assetId, fileName:file.name,
          fileType:file.type, fileSize:file.size, imported:true, keywords:[], weight:35 },
      })
      continue
    }
    const isHum = kind === 'audio-hum'
    const duration = await readAudioDuration(url)
    nodes.push({
      id:importId('audio'), type:'audio', x, y, w:200, h:isHum?100:156, visible:true, selected:false, inputs:[], outputs:[],
      data:{ label:isHum?'哼唱片段':'参考音频', name:baseName(file.name), fileName:file.name, duration,
        isHum, isRef:!isHum, weight:isHum?45:35, analysis:null, audioUrl:url, assetId,
        fileType:file.type, fileSize:file.size, imported:true },
    })
  }
  return nodes
}
