import { useEffect, type RefObject } from 'react'

export function useCanvasViewport(
  outerRef: RefObject<HTMLDivElement | null>,
  panX: number,
  panY: number,
  zoom: number,
  onViewportChange?: (panX:number, panY:number, zoom:number, width:number, height:number) => void,
) {
  useEffect(() => {
    if (!onViewportChange || !outerRef.current) return
    const rect = outerRef.current.getBoundingClientRect()
    onViewportChange(panX, panY, zoom, rect.width, rect.height)
  }, [outerRef, panX, panY, zoom, onViewportChange])

  useEffect(() => {
    if (!onViewportChange || !outerRef.current) return
    const ro = new ResizeObserver(() => {
      const rect = outerRef.current!.getBoundingClientRect()
      onViewportChange(panX, panY, zoom, rect.width, rect.height)
    })
    ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [outerRef, panX, panY, zoom, onViewportChange])
}
