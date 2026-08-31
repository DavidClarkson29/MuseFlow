import { useCallback, useEffect, useRef, useState } from 'react'
import { beginPlayback, stopPlayback, updatePlayback } from '../playbackStore'

export function formatAudioDuration(seconds:number) {
  const value=Math.max(0,Math.round(seconds))
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`
}

export function useAudioPlayback({id,title,duration,color,accent,audioUrl,onPlay,onDurationChange}:{
  id:string
  title:string
  duration:string
  color:string
  accent?:string
  audioUrl?:string
  onPlay?:()=>void
  onDurationChange?:(duration:string)=>void
}) {
  const audioRef=useRef<HTMLAudioElement>(null)
  const playbackHandle=useRef<number|null>(null)
  const progressRef=useRef(0)
  const [playing,setPlaying]=useState(false)
  const [progress,setProgress]=useState(0)
  const [durationLabel,setDurationLabel]=useState(duration)

  useEffect(()=>setDurationLabel(duration),[duration])

  const stopLocal=useCallback(()=>{
    audioRef.current?.pause()
    setPlaying(false)
  },[])

  useEffect(()=>{
    if(!playing || audioUrl)return
    const parts=durationLabel.split(':').map(Number)
    const total=Math.max(1,parts.length===2?parts[0]*60+parts[1]:parts[0]||1)
    const timer=window.setInterval(()=>{
      const next=Math.min(100,progressRef.current+100/(total*10))
      progressRef.current=next
      setProgress(next)
      if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{progress:next})
      if(next>=100){
        const handle=playbackHandle.current
        playbackHandle.current=null
        setPlaying(false)
        progressRef.current=0
        setProgress(0)
        if(handle!==null)stopPlayback(handle)
      }
    },100)
    return()=>window.clearInterval(timer)
  },[audioUrl,durationLabel,playing])

  useEffect(()=>()=>{
    audioRef.current?.pause()
    if(playbackHandle.current!==null)stopPlayback(playbackHandle.current)
  },[])

  const stop=useCallback(()=>{
    const handle=playbackHandle.current
    playbackHandle.current=null
    if(handle!==null)stopPlayback(handle)
    else stopLocal()
  },[stopLocal])

  const toggle=useCallback(()=>{
    if(playing){ stop(); return }
    const nextProgress=progressRef.current>=100?0:progressRef.current
    progressRef.current=nextProgress
    if(progress>=100)setProgress(0)
    const audio=audioRef.current
    if(audioUrl && !audio)return
    if(audio && Number.isFinite(audio.duration) && audio.duration>0){
      audio.currentTime=audio.duration*nextProgress/100
    }
    playbackHandle.current=beginPlayback({id,title,duration:durationLabel,color,accent,progress:nextProgress},stopLocal)
    setPlaying(true)
    onPlay?.()
    if(audio){
      void audio.play().catch(()=>{
        const handle=playbackHandle.current
        playbackHandle.current=null
        if(handle!==null)stopPlayback(handle)
        setPlaying(false)
      })
    }
  },[accent,audioUrl,color,durationLabel,id,onPlay,playing,progress,stop,stopLocal,title])

  const seek=useCallback((next:number)=>{
    const value=Math.max(0,Math.min(100,next))
    progressRef.current=value
    setProgress(value)
    const audio=audioRef.current
    if(audio && Number.isFinite(audio.duration) && audio.duration>0)audio.currentTime=audio.duration*value/100
    if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{progress:value})
  },[])

  const audioProps=audioUrl?{
    ref:audioRef,
    src:audioUrl,
    preload:'metadata' as const,
    onLoadedMetadata:(event:React.SyntheticEvent<HTMLAudioElement>)=>{
      const audio=event.currentTarget
      if(!Number.isFinite(audio.duration)||audio.duration<=0)return
      const nextDuration=formatAudioDuration(audio.duration)
      setDurationLabel(nextDuration)
      onDurationChange?.(nextDuration)
      if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{duration:nextDuration})
    },
    onTimeUpdate:(event:React.SyntheticEvent<HTMLAudioElement>)=>{
      const audio=event.currentTarget
      const next=audio.duration>0?audio.currentTime/audio.duration*100:0
      progressRef.current=next
      setProgress(next)
      if(playbackHandle.current!==null)updatePlayback(playbackHandle.current,{progress:next})
    },
    onEnded:()=>{
      const handle=playbackHandle.current
      playbackHandle.current=null
      progressRef.current=0
      setProgress(0)
      setPlaying(false)
      if(handle!==null)stopPlayback(handle)
    },
  }:null

  return {playing,progress,durationLabel,toggle,seek,audioProps}
}
