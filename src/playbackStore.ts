import { useSyncExternalStore } from 'react'

export interface PlaybackSnapshot {
  id:string
  title:string
  duration:string
  color:string
  accent?:string
  progress:number
  playing:true
}

let snapshot:PlaybackSnapshot|null=null
let activeHandle=0
let stopActive:(()=>void)|null=null
const listeners=new Set<()=>void>()

function emit(){ listeners.forEach(listener=>listener()) }

export function beginPlayback(track:Omit<PlaybackSnapshot,'playing'>,onInterrupt:()=>void) {
  stopActive?.()
  activeHandle+=1
  stopActive=onInterrupt
  snapshot={...track,progress:Math.max(0,Math.min(100,track.progress)),playing:true}
  emit()
  return activeHandle
}

export function updatePlayback(handle:number,patch:Partial<Pick<PlaybackSnapshot,'progress'|'title'|'duration'|'color'|'accent'>>) {
  if(handle!==activeHandle || !snapshot)return
  snapshot={...snapshot,...patch,progress:Math.max(0,Math.min(100,patch.progress??snapshot.progress))}
  emit()
}

export function stopPlayback(handle?:number) {
  if(!snapshot || (handle!==undefined && handle!==activeHandle))return
  const interrupt=stopActive
  stopActive=null
  snapshot=null
  interrupt?.()
  emit()
}

function subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener)}
function getSnapshot(){return snapshot}

export function useGlobalPlayback(){
  return useSyncExternalStore(subscribe,getSnapshot,getSnapshot)
}
