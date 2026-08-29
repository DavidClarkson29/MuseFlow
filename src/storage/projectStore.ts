import type { Lang } from '../i18n'
import type { CanvasNode, Wire } from '../types'

const DB_NAME = 'museflow-local-projects'
const DB_VERSION = 1
const PROJECTS = 'projects'
const ASSETS = 'assets'

export type ProjectSlot = 'autosave' | 'manual'
export type ImportKind = 'auto' | 'image' | 'audio-hum' | 'audio-ref'

export interface ProjectSnapshot {
  version: 1
  savedAt: number
  lang: Lang
  nodes: CanvasNode[]
  wires: Wire[]
}

interface StoredAsset {
  id: string
  name: string
  type: string
  size: number
  lastModified: number
  blob: Blob
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS)
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(storeName:string, mode:IDBTransactionMode, run:(store:IDBObjectStore)=>IDBRequest<T>) {
  const db = await openDb()
  return new Promise<T>((resolve,reject) => {
    const tx = db.transaction(storeName,mode)
    const request = run(tx.objectStore(storeName))
    let result:T
    request.onsuccess = () => { result = request.result }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('IndexedDB transaction aborted')) }
  })
}

function cleanNodes(nodes:CanvasNode[]) {
  return nodes.map(node => {
    const data = { ...node.data }
    if (typeof data.imageUrl === 'string' && data.imageUrl.startsWith('blob:')) delete data.imageUrl
    if (typeof data.audioUrl === 'string' && data.audioUrl.startsWith('blob:')) delete data.audioUrl
    return { ...node, data }
  })
}

export async function storeImportedAsset(file:File) {
  const id = `asset-${Date.now().toString(36)}-${crypto.randomUUID().slice(0,8)}`
  const asset:StoredAsset = { id, name:file.name, type:file.type, size:file.size, lastModified:file.lastModified, blob:file }
  await transact(ASSETS,'readwrite',store=>store.put(asset,id))
  return id
}

async function getAsset(id:string) {
  return transact<StoredAsset | undefined>(ASSETS,'readonly',store=>store.get(id))
}

export async function saveProject(slot:ProjectSlot, nodes:CanvasNode[], wires:Wire[], lang:Lang) {
  const snapshot:ProjectSnapshot = { version:1, savedAt:Date.now(), lang, nodes:cleanNodes(nodes), wires }
  await transact(PROJECTS,'readwrite',store=>store.put(snapshot,slot))
  return snapshot.savedAt
}

export async function loadProject(slot:ProjectSlot) {
  return transact<ProjectSnapshot | undefined>(PROJECTS,'readonly',store=>store.get(slot))
}

export async function hydrateProject(snapshot:ProjectSnapshot) {
  const nodes = await Promise.all(snapshot.nodes.map(async node => {
    const assetId = typeof node.data.assetId === 'string' ? node.data.assetId : ''
    if (!assetId) return node
    const asset = await getAsset(assetId)
    if (!asset?.blob) return node
    const data = { ...node.data }
    const url = URL.createObjectURL(asset.blob)
    if (node.type === 'image') data.imageUrl = url
    if (node.type === 'audio') data.audioUrl = url
    data.fileName = asset.name
    data.fileType = asset.type
    data.fileSize = asset.size
    return { ...node, data }
  }))
  return { ...snapshot, nodes }
}

export function releaseAssetUrls(nodes:CanvasNode[]) {
  for (const node of nodes) {
    for (const key of ['imageUrl','audioUrl']) {
      const value = node.data[key]
      if (typeof value === 'string' && value.startsWith('blob:')) URL.revokeObjectURL(value)
    }
  }
}
