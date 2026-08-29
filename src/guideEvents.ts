export type MuseFlowGuideEvent =
  | { type:'audio-play'; nodeId:string }
  | { type:'demo-play'; cardId:string }

export const GUIDE_EVENT_NAME = 'museflow-guide-event'

export function emitGuideEvent(detail:MuseFlowGuideEvent) {
  window.dispatchEvent(new CustomEvent<MuseFlowGuideEvent>(GUIDE_EVENT_NAME,{detail}))
}

