import { useRef, useState } from 'react'
import type { Lang } from '../i18n'
import type { CanvasNode, Wire } from '../types'

export function useMuseFlowState(buildInitialNodes: () => CanvasNode[]) {
  const [lang, setLang] = useState<Lang>('zh')
  const [nodes, setNodes] = useState<CanvasNode[]>(buildInitialNodes)
  const [wires, setWires] = useState<Wire[]>([])
  const [inspectedNode, setInspectedNode] = useState<CanvasNode | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [parkingIds, setParkingIds] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ panX:60, panY:40, zoom:1, width:1280, height:720 })

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const wiresRef = useRef(wires)
  wiresRef.current = wires

  return {
    lang, setLang, nodes, setNodes, wires, setWires,
    inspectedNode, setInspectedNode,
    compareIds, setCompareIds,
    showCompare, setShowCompare,
    cmdkOpen, setCmdkOpen,
    parkingIds, setParkingIds,
    detailId, setDetailId,
    viewport, setViewport,
    nodesRef, wiresRef,
  }
}
