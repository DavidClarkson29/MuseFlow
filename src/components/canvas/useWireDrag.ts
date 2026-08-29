import { useState } from 'react'
import type { PendingWire } from '../../types'

export interface GhostPort { nodeId:string; isInput:boolean; yRel:number; color:string }

export function useWireDrag() {
  const [pendingWire, setPendingWire] = useState<PendingWire | null>(null)
  const [ghost, setGhost] = useState<GhostPort | null>(null)
  const [hoveredWire, setHoveredWire] = useState<string | null>(null)

  const clearWireDrag = () => {
    setPendingWire(null)
    setGhost(null)
  }

  return {
    pendingWire, setPendingWire,
    ghost, setGhost,
    hoveredWire, setHoveredWire,
    clearWireDrag,
  }
}
