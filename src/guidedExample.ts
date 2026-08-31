import type { CanvasNode, Wire } from './types'
import type { GalleryBoard } from './components/ProjectGallery'

export const GUIDED_EXAMPLE_ID = 'example-midnight-city'
export const GUIDE_FRAME_ID = 'guide-frame'
export const GUIDE_IMAGE_ID = 'guide-image'
export const GUIDE_INTENT_ID = 'guide-intent'
export const GUIDE_HUM_ID = 'guide-hum'
export const GUIDE_REF_ID = 'guide-reference'
export const GUIDE_LYRICS_ID = 'guide-lyrics'

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
      data:{name:'孤独霓虹',mode:'song',vocal:'female',timeSig:'4/4',prompt:'',promptDirty:false,negative:'避免过度悲伤、密集鼓点和明亮日间感',generating:false,guideRole:'fusion'},
    },
    {
      id:GUIDE_HUM_ID,type:'audio',x:540,y:175,w:200,h:100,visible:true,selected:false,inputs:[],outputs:[],
      data:{label:'小样',duration:'0:24',audioUrl:'/audio/guided-hum.mp3',isHum:true,weight:55,guidePlayable:true,guideRole:'hum'},
    },
    {
      id:GUIDE_REF_ID,type:'audio',x:1370,y:780,w:200,h:156,visible:true,selected:false,inputs:[],outputs:[],
      data:{label:'参考音频',name:'钢琴随笔',fileName:'钢琴随笔.mp3',duration:'0:41',audioUrl:'/audio/guided-reference.mp3',isRef:true,weight:35,guidePlayable:true,analysis:{bpm:75,key:'C Minor',style:'Piano Solo'},guideRole:'remix-reference'},
    },
    {
      id:'guide-note',type:'note',x:280,y:470,w:200,h:118,visible:true,selected:false,inputs:[],outputs:[],
      data:{text:'素材决定内容，权重决定它被听见多少。生成的 Demo 也可以继续成为下一轮创作素材。',guideRole:'teaching-note'},
    },
  ]
}

export function buildGuidedIntentNode():CanvasNode {
  return {
    id:GUIDE_INTENT_ID,type:'text',x:280,y:410,w:200,h:100,visible:true,selected:true,inputs:[],outputs:[],
    data:{title:'文字意向',content:'黄昏结束后的夜晚，不要太悲伤。像雨后开车穿过霓虹街道。',weight:46,guideRole:'intent'},
  }
}

export function buildGuidedLyricsNode():CanvasNode {
  return {
    id:GUIDE_LYRICS_ID,type:'lyrics',x:170,y:610,w:360,h:380,visible:true,selected:true,inputs:[],
    outputs:[{id:'guide-lyrics-out',label:'Lyrics',dataType:'text',color:'#E56B8A',yRel:64}],
    data:{
      title:'霓虹雨夜',guideRole:'lyrics',
      sections:[
        {id:'guide-verse-1',type:'verse',label:'主歌',content:'雨滴滑过车窗的边缘\n城市把影子拉得很远\n红灯在后视镜里失焦\n我们沿着夜色向前'},
        {id:'guide-chorus-1',type:'chorus',label:'副歌',content:'穿过霓虹之后继续向前\n让这一夜替我们发言\n风把沉默吹成一首歌\n微光落在道路中间'},
        {id:'guide-verse-2',type:'verse',label:'主歌',content:'收音机留下一点回声\n像没有说完的告别\n高架桥掠过潮湿天空\n旧故事慢慢退远'},
        {id:'guide-chorus-2',type:'chorus',label:'副歌',content:'穿过霓虹之后继续向前\n别让清醒打断冒险\n雨夜把心跳调得更亮\n微光陪我们到终点'},
      ],
    },
  }
}

export function buildGuidedExampleBoard():GalleryBoard {
  return {
    id:GUIDED_EXAMPLE_ID,
    name:'孤独霓虹',
    nodes:buildGuidedExampleNodes(),
    wires:[] as Wire[],
    updatedAt:Date.now()-60_000,
    kind:'example',
    description:'从多模态素材到 Remix 完整作品',
    durationLabel:'约 8 分钟',
    templateVersion:12,
  }
}

export function ensureGuidedExampleBoard(boards:GalleryBoard[]) {
  const existing=boards.find(board=>board.id===GUIDED_EXAMPLE_ID)
  if(existing?.templateVersion===12)return boards
  const fresh=buildGuidedExampleBoard()
  return [fresh,...boards.filter(board=>board.id!==GUIDED_EXAMPLE_ID)]
}
