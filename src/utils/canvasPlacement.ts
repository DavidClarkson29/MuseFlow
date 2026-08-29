import type { CanvasNode } from '../types'

const DEFAULT_GAP=18
const SEARCH_STEP=36
const MAX_RING=72

function isFrameChild(candidate:CanvasNode, obstacle:CanvasNode) {
  if(obstacle.type!=='frame' || !['image','audio','text'].includes(candidate.type))return false
  const cx=candidate.x+candidate.w/2
  const cy=candidate.y+candidate.h/2
  return cx>obstacle.x && cx<obstacle.x+obstacle.w && cy>obstacle.y && cy<obstacle.y+obstacle.h
}

function overlaps(candidate:CanvasNode, obstacle:CanvasNode, gap=DEFAULT_GAP) {
  if(!obstacle.visible || obstacle.id===candidate.id || isFrameChild(candidate,obstacle))return false
  return candidate.x<obstacle.x+obstacle.w+gap
    && candidate.x+candidate.w+gap>obstacle.x
    && candidate.y<obstacle.y+obstacle.h+gap
    && candidate.y+candidate.h+gap>obstacle.y
}

function isFree(candidate:CanvasNode, existing:CanvasNode[]) {
  return !existing.some(node=>overlaps(candidate,node))
}

/**
 * Keeps the requested drop point whenever it is free. If occupied, searches a
 * deterministic expanding grid around it so newly created tiles never cover
 * existing tiles while still appearing close to the user's intended location.
 */
export function placeNodeWithoutOverlap(candidate:CanvasNode, existing:CanvasNode[]) {
  if(isFree(candidate,existing))return candidate
  const originX=candidate.x
  const originY=candidate.y
  for(let ring=1;ring<=MAX_RING;ring++) {
    const offsets:Array<[number,number]>=[]
    for(let y=-ring;y<=ring;y++)offsets.push([ring,y])
    for(let x=ring-1;x>=-ring;x--)offsets.push([x,ring])
    for(let y=ring-1;y>=-ring;y--)offsets.push([-ring,y])
    for(let x=-ring+1;x<ring;x++)offsets.push([x,-ring])
    for(const [ox,oy] of offsets) {
      const placed={...candidate,x:originX+ox*SEARCH_STEP,y:originY+oy*SEARCH_STEP}
      if(isFree(placed,existing))return placed
    }
  }
  const furthestRight=existing.filter(node=>node.visible).reduce((right,node)=>Math.max(right,node.x+node.w),originX)
  return {...candidate,x:furthestRight+DEFAULT_GAP,y:originY}
}

export function placeNodesWithoutOverlap(candidates:CanvasNode[],existing:CanvasNode[]) {
  const placed:CanvasNode[]=[]
  for(const candidate of candidates)placed.push(placeNodeWithoutOverlap(candidate,[...existing,...placed]))
  return placed
}
