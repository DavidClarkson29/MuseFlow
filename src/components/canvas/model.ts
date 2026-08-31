export const DEMO_CARD_W = 226
export const DEMO_CARD_H = 172
export const WORK_CARD_W = 249
export const WORK_CARD_H = 200

export interface InboundRef { name: string; label: string; color: string }

export interface DemoItem {
  id: string
  lb: string
  name: string
  color: string
  mood: string
  style: string
  texture: string
  rhythm: string
  energy: number
  duration: string
  audioUrl?: string
  usedPrompt: string
  recipe?: {
    mats: { name: string; weight: number; kind: string; isRef: boolean; fileName?: string }[]
    mode: string; vocal: string; timeSig: string; negative: string; prompt?: string; lyrics?: string
  }
  lyrics?: string
}

export interface WorkItem {
  id: string
  name: string
  color: string
  accent: string
  mode: 'cover' | 'remix' | 'mashup' | 'extended' | 'finalize'
  mood: string
  style: string
  energy: number
  duration: string
  audioUrl?: string
  usedPrompt: string
  sources: WorkSource[]
  sourceRatios?: number[]
  lyrics?: string
}

export interface WorkSource {
  id:string
  name:string
  kind:string
  color:string
  duration?:string
  audioUrl?:string
  fileName?:string
  mood?:string
  style?:string
  texture?:string
  rhythm?:string
  accent?:string
  mode?:string
  originalType?:string
  originalData?:Record<string,unknown>
  w?:number
  h?:number
}
