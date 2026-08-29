import type { CanvasNode, Wire } from './types'
import type { GalleryBoard } from './components/ProjectGallery'

export const GUIDED_EXAMPLE_ID = 'example-midnight-city'
export const GUIDE_FRAME_ID = 'guide-frame'
export const GUIDE_IMAGE_ID = 'guide-image'
export const GUIDE_HUM_ID = 'guide-hum'
export const GUIDE_REF_ID = 'guide-reference'

const CITY_IMG = 'https://images.unsplash.com/photo-1541702467897-41915a07d3a7?w=400&h=280&fit=crop&auto=format'

export function buildGuidedExampleNodes():CanvasNode[] {
  return [
    {
      id:GUIDE_IMAGE_ID,type:'image',x:170,y:205,w:200,h:176,visible:true,selected:false,inputs:[],outputs:[],
      data:{label:'图片素材',name:'雨夜霓虹街道',imageUrl:CITY_IMG,keywords:['城市夜景','霓虹反射','暖色街灯','雨后路面'],weight:40,guideRole:'image'},
    },
    {
      id:GUIDE_FRAME_ID,type:'frame',x:500,y:90,w:780,h:640,visible:true,selected:false,
      inputs:[],outputs:[],
      data:{name:'午夜城市重构',mode:'song',vocal:'female',timeSig:'4/4',prompt:'',promptDirty:false,negative:'避免过度悲伤、密集鼓点和明亮日间感',generating:false,guideRole:'fusion'},
    },
    {
      id:GUIDE_HUM_ID,type:'audio',x:540,y:175,w:200,h:100,visible:true,selected:false,inputs:[],outputs:[],
      data:{label:'哼唱片段',duration:'0:08',isHum:true,weight:55,guidePlayable:true,guideRole:'hum'},
    },
    {
      id:'guide-intent',type:'text',x:540,y:315,w:200,h:100,visible:true,selected:false,inputs:[],outputs:[],
      data:{title:'文字意向',content:'黄昏结束后的夜晚，不要太悲伤。像雨后开车穿过霓虹街道。',weight:46,guideRole:'intent'},
    },
    {
      id:'guide-texture',type:'audio',x:770,y:175,w:200,h:156,visible:true,selected:false,inputs:[],outputs:[],
      data:{label:'氛围参考',fileName:'City_Ambience.wav',duration:'1:24',isRef:true,weight:35,guidePlayable:true,analysis:{bpm:96,key:'F# Minor',style:'City Pop / Jazz Fusion'},guideRole:'texture'},
    },
    {
      id:GUIDE_REF_ID,type:'audio',x:1370,y:175,w:200,h:156,visible:true,selected:false,inputs:[],outputs:[],
      data:{label:'参考音频',name:'夜航参考母带',fileName:'Night_Drive_Reference.mp3',duration:'3:42',isRef:true,weight:35,guidePlayable:true,analysis:{bpm:96,key:'F# Minor',style:'City Pop / Jazz Fusion'},guideRole:'remix-reference'},
    },
    {
      id:'guide-note',type:'note',x:175,y:435,w:200,h:118,visible:true,selected:false,inputs:[],outputs:[],
      data:{title:'从灵感到作品',content:'素材决定内容，权重决定它被听见多少。生成的 Demo 也可以继续成为下一轮创作素材。',guideRole:'teaching-note'},
    },
  ]
}

export function buildGuidedExampleBoard():GalleryBoard {
  return {
    id:GUIDED_EXAMPLE_ID,
    name:'午夜城市重构',
    nodes:buildGuidedExampleNodes(),
    wires:[] as Wire[],
    updatedAt:Date.now()-60_000,
    kind:'example',
    description:'从多模态素材到 Remix 完整作品',
    durationLabel:'约 5 分钟',
    templateVersion:1,
  }
}

export function ensureGuidedExampleBoard(boards:GalleryBoard[]) {
  const existing=boards.find(board=>board.id===GUIDED_EXAMPLE_ID)
  if(existing?.templateVersion===1)return boards
  const fresh=buildGuidedExampleBoard()
  return [fresh,...boards.filter(board=>board.id!==GUIDED_EXAMPLE_ID)]
}
