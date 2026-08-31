export type MuseFlowGuideEvent =
  | { type:'audio-play'; nodeId:string }
  | { type:'demo-play'; cardId:string }
  | { type:'upload-open'; kind:string }
  | { type:'rack-select'; nodeId:string }
  | { type:'detail-open'; nodeId:string }
  | { type:'audio-download'; nodeId:string }

export const GUIDE_EVENT_NAME = 'museflow-guide-event'

export function emitGuideEvent(detail:MuseFlowGuideEvent) {
  window.dispatchEvent(new CustomEvent<MuseFlowGuideEvent>(GUIDE_EVENT_NAME,{detail}))
}
