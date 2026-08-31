export interface GuidedAudioAsset { audioUrl:string; duration:string }

export const GUIDED_DEMO_AUDIO:Record<string,GuidedAudioAsset> = {
  '暖调都市流行':{audioUrl:'/audio/demo-warm-city-pop.mp3',duration:'0:29'},
  '暗色电影':{audioUrl:'/audio/demo-dark-cinematic.mp3',duration:'0:30'},
  '梦幻电子':{audioUrl:'/audio/demo-dreamy-electronic.mp3',duration:'0:30'},
}

export const GUIDED_WORK_AUDIO:Record<string,GuidedAudioAsset> = {
  '爵士大乐队':{audioUrl:'/audio/work-sunset-slow.mp3',duration:'2:47'},
  'Citypop！':{audioUrl:'/audio/work-neon-breaks.mp3',duration:'1:42'},
  'Citypop!':{audioUrl:'/audio/work-neon-breaks.mp3',duration:'1:42'},
  // 兼容已经保存在浏览器里的旧标题。
  '碎拍霓虹版':{audioUrl:'/audio/work-neon-breaks.mp3',duration:'1:42'},
  '日落慢速版':{audioUrl:'/audio/work-sunset-slow.mp3',duration:'2:47'},
}

const GUIDED_SOURCE_AUDIO:Record<string,GuidedAudioAsset> = {
  '小样':{audioUrl:'/audio/guided-hum.mp3',duration:'0:24'},
  '参考音频':{audioUrl:'/audio/guided-reference.mp3',duration:'0:41'},
  '钢琴随笔':{audioUrl:'/audio/guided-reference.mp3',duration:'0:41'},
  '钢琴随笔.mp3':{audioUrl:'/audio/guided-reference.mp3',duration:'0:41'},
  // 兼容已经保存到浏览器里的旧教学卡片。
  '夜航参考母带':{audioUrl:'/audio/guided-reference.mp3',duration:'0:41'},
  'Night_Drive_Reference.mp3':{audioUrl:'/audio/guided-reference.mp3',duration:'0:41'},
}

export function resolveGuidedAudio(name:string|undefined):GuidedAudioAsset|undefined {
  if(!name)return undefined
  return GUIDED_SOURCE_AUDIO[name]??GUIDED_DEMO_AUDIO[name]??GUIDED_WORK_AUDIO[name]
}
