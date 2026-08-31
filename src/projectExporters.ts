import type { Lang } from './i18n'
import type { CanvasNode, Wire } from './types'
import { nodeThemeColor } from './theme'
import { downloadNodeAudio, isAudioExportNode } from './components/canvas/exporters'
import { localizeBuiltinText } from './contentI18n'

export type ProjectExportKind = 'path' | 'audio' | 'lyrics' | 'archive' | 'project'

export interface ProjectExportCounts {
  audio: number
  lyrics: number
}

function safeFileName(raw:string) {
  return raw.trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ') || 'MuseFlow Project'
}

function downloadBlob(blob:Blob, fileName:string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url),1000)
}

function nodeName(node:CanvasNode, lang:Lang) {
  const raw = String(node.data.name ?? node.data.title ?? node.data.label ?? node.data.fileName ?? node.id)
  if (raw === '__HUM__') return lang==='zh'?'小样':'Hum Clip'
  if (raw === '__REF__') return lang==='zh'?'参考音频':'Reference Audio'
  if (node.type === 'frame') return lang==='zh'?'融合板':'Fusion Board'
  if (node.type === 'audioFolder') return lang==='zh'?'音频创作夹':'Audio Studio'
  return localizeBuiltinText(raw.replace(/__/g,''),lang)
}

function nodeTypeLabel(node:CanvasNode, lang:Lang) {
  const zh:Record<string,string> = {
    image:'图片素材', audio:'音频素材', text:'文字意向', lyrics:'歌词', frame:'融合板',
    audioFolder:'音频创作夹', direction:'30s Demo', work:'作品', result:'作品',
  }
  const en:Record<string,string> = {
    image:'Image', audio:'Audio', text:'Text Intent', lyrics:'Lyrics', frame:'Fusion Board',
    audioFolder:'Audio Studio', direction:'30s Demo', work:'Track', result:'Track',
  }
  return (lang === 'zh' ? zh : en)[node.type] ?? node.type
}

function xml(raw:string) {
  return raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}

function exportCreativePath(projectName:string, nodes:CanvasNode[], wires:Wire[], lang:Lang) {
  const visible = nodes.filter(node => node.visible && node.type !== 'field')
  const padding = 72
  const minX = visible.length ? Math.min(...visible.map(node => node.x)) : 0
  const minY = visible.length ? Math.min(...visible.map(node => node.y)) : 0
  const maxX = visible.length ? Math.max(...visible.map(node => node.x + node.w)) : 960
  const maxY = visible.length ? Math.max(...visible.map(node => node.y + node.h)) : 600
  const width = Math.max(960,maxX-minX+padding*2)
  const height = Math.max(600,maxY-minY+padding*2+42)
  const ox = padding-minX
  const oy = padding+42-minY
  const byId = new Map(visible.map(node => [node.id,node]))
  const wireSvg = wires.map(wire => {
    const from = byId.get(wire.fromNodeId)
    const to = byId.get(wire.toNodeId)
    if (!from || !to) return ''
    const fp = from.outputs.find(port => port.id === wire.fromPortId)
    const tp = to.inputs.find(port => port.id === wire.toPortId)
    if (!fp || !tp) return ''
    const sx = from.x+from.w+ox, sy = from.y+fp.yRel+oy
    const ex = to.x+ox, ey = to.y+tp.yRel+oy
    const cx = (sx+ex)/2
    return `<path d="M${sx},${sy} C${cx},${sy} ${cx},${ey} ${ex},${ey}" fill="none" stroke="#888884" stroke-width="2" opacity=".62"/><circle cx="${sx}" cy="${sy}" r="4" fill="#888884"/><circle cx="${ex}" cy="${ey}" r="4" fill="#888884"/>`
  }).join('')
  const nodeSvg = visible.map(node => {
    const x=node.x+ox, y=node.y+oy, color=nodeThemeColor(node)
    const title=xml(nodeName(node,lang)), type=xml(nodeTypeLabel(node,lang))
    return `<g><rect x="${x}" y="${y}" width="${node.w}" height="${node.h}" rx="12" fill="#18181A" stroke="${color}" stroke-opacity=".6"/><rect x="${x}" y="${y}" width="4" height="${node.h}" rx="2" fill="${color}"/><text x="${x+18}" y="${y+27}" fill="#F1F1EE" font-size="14" font-weight="700" font-family="Inter,Arial,sans-serif">${title}</text><text x="${x+18}" y="${y+47}" fill="${color}" font-size="10" font-weight="700" font-family="Inter,Arial,sans-serif">${type}</text></g>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#343432"/></pattern></defs><rect width="100%" height="100%" fill="#101010"/><rect width="100%" height="100%" fill="url(#dots)"/><text x="${padding}" y="42" fill="#F1F1EE" font-size="20" font-weight="800" font-family="Inter,Arial,sans-serif">${xml(projectName)}</text><text x="${padding}" y="61" fill="#71716D" font-size="10" font-family="Inter,Arial,sans-serif">MuseFlow · ${lang==='zh'?'创作路径':'Creative Path'}</text>${wireSvg}${nodeSvg}</svg>`
  const fileName = `${safeFileName(projectName)}-${lang==='zh'?'创作路径':'creative-path'}.svg`
  downloadBlob(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),fileName)
  return fileName
}

function exportAllLyrics(projectName:string, nodes:CanvasNode[], lang:Lang) {
  const lyrics = nodes.filter(node => node.visible && node.type === 'lyrics')
  const body = lyrics.map(node => {
    const sections = (node.data.sections as Array<{label?:string;content?:string}>|undefined) ?? []
    const sectionText = sections.map(section => `## ${localizeBuiltinText(section.label ?? (lang==='zh'?'段落':'Section'),lang)}\n\n${localizeBuiltinText(String(section.content ?? '').trim(),lang) || (lang==='zh'?'（空）':'(empty)')}`).join('\n\n')
    return `# ${nodeName(node,lang)}\n\n${sectionText}`
  }).join('\n\n---\n\n')
  const fileName = `${safeFileName(projectName)}-${lang==='zh'?'全部歌词':'all-lyrics'}.md`
  downloadBlob(new Blob([`\uFEFF${body || (lang==='zh'?'# 暂无歌词\n':'# No lyrics\n')}`],{type:'text/markdown;charset=utf-8'}),fileName)
  return fileName
}

function exportCreativeArchive(projectName:string, nodes:CanvasNode[], wires:Wire[], lang:Lang) {
  const visible = nodes.filter(node => node.visible && node.type !== 'field')
  const entries = visible.map(node => {
    const data = node.data as Record<string,unknown>
    const sources = Array.isArray(data.sources) ? data.sources as Array<{name?:string}> : []
    const lines = [
      `## ${nodeName(node,lang)}`,
      `- ${lang==='zh'?'类型':'Type'}：${nodeTypeLabel(node,lang)}`,
      data.mode ? `- ${lang==='zh'?'生成方式':'Mode'}：${String(data.mode).toUpperCase()}` : '',
      sources.length ? `- ${lang==='zh'?'来源素材':'Sources'}：${sources.map(source=>localizeBuiltinText(source.name ?? 'Untitled',lang)).join(lang==='zh'?'、':', ')}` : '',
      data.weirdness !== undefined ? `- ${lang==='zh'?'创意度':'Creativity'}：${String(data.weirdness)}%` : '',
      data.styleInfluence !== undefined ? `- ${lang==='zh'?'风格影响':'Style influence'}：${String(data.styleInfluence)}%` : '',
      data.prompt ? `- ${lang==='zh'?'创作要求':'Creative brief'}：${localizeBuiltinText(data.prompt,lang)}` : '',
      data.usedPrompt ? `\n### ${lang==='zh'?'生成指令':'Generation instruction'}\n\n\`\`\`\n${localizeBuiltinText(data.usedPrompt,lang)}\n\`\`\`` : '',
    ].filter(Boolean)
    return lines.join('\n')
  }).join('\n\n')
  const header = `# ${projectName}\n\n${lang==='zh'?'MuseFlow 创作档案':'MuseFlow Creative Archive'}\n\n- ${lang==='zh'?'卡片':'Cards'}：${visible.length}\n- ${lang==='zh'?'连线':'Connections'}：${wires.length}\n- ${lang==='zh'?'导出时间':'Exported'}：${new Date().toLocaleString()}\n\n---\n\n`
  const fileName = `${safeFileName(projectName)}-${lang==='zh'?'创作档案':'creative-archive'}.md`
  downloadBlob(new Blob([`\uFEFF${header}${entries}`],{type:'text/markdown;charset=utf-8'}),fileName)
  return fileName
}

function exportProjectPackage(projectName:string, nodes:CanvasNode[], wires:Wire[], lang:Lang) {
  const cleanNodes = nodes.map(node => {
    const data={...node.data}
    if (typeof data.imageUrl==='string' && data.imageUrl.startsWith('blob:')) delete data.imageUrl
    if (typeof data.audioUrl==='string' && data.audioUrl.startsWith('blob:')) delete data.audioUrl
    return {...node,data}
  })
  const payload = { format:'museflow-project', version:1, exportedAt:Date.now(), projectName, lang, nodes:cleanNodes, wires }
  const fileName = `${safeFileName(projectName)}.museflow`
  downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),fileName)
  return fileName
}

export function getProjectExportCounts(nodes:CanvasNode[]):ProjectExportCounts {
  return {
    audio:nodes.filter(node => node.visible && isAudioExportNode(node)).length,
    lyrics:nodes.filter(node => node.visible && node.type === 'lyrics').length,
  }
}

export function runProjectExport(kind:ProjectExportKind, projectName:string, nodes:CanvasNode[], wires:Wire[], lang:Lang) {
  if (kind === 'path') return exportCreativePath(projectName,nodes,wires,lang)
  if (kind === 'lyrics') return exportAllLyrics(projectName,nodes,lang)
  if (kind === 'archive') return exportCreativeArchive(projectName,nodes,wires,lang)
  if (kind === 'project') return exportProjectPackage(projectName,nodes,wires,lang)
  const audioNodes = nodes.filter(node => node.visible && isAudioExportNode(node))
  audioNodes.forEach(downloadNodeAudio)
  return lang === 'zh' ? `已开始导出 ${audioNodes.length} 个音频文件` : `Exporting ${audioNodes.length} audio files`
}
