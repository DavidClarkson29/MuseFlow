export type NodeType =
  | 'image' | 'audio' | 'text' | 'mood'
  | 'explore' | 'direction' | 'fuse' | 'brief' | 'result'

export type DataType = 'visual' | 'audio' | 'text' | 'mood' | 'direction' | 'any'

export interface Port {
  id: string
  label: string
  dataType: DataType
  color: string
  yRel: number
}

export interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  w: number
  h: number
  inputs: Port[]
  outputs: Port[]
  visible: boolean
  selected: boolean
  state?: 'idle' | 'ready' | 'running' | 'done'
  data: Record<string, unknown>
}

export interface Wire {
  id: string
  fromNodeId: string
  fromPortId: string
  toNodeId: string
  toPortId: string
  color: string
}

export interface PendingWire {
  fromNodeId: string
  fromPortId: string
  isOutput: boolean
  startX: number
  startY: number
  mouseX: number
  mouseY: number
  color: string
}

export type OutputMode = 'create' | 'remix' | 'cover'
