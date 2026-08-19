import { useLang } from '../App'

interface Props { onClose: () => void }

export default function ExportPanel({ onClose }: Props) {
  const s = useLang()

  const params: [string, string][] = [
    [s.mood,           'Nostalgic / Bittersweet'],
    [s.energy,         '68%'],
    [s.tempoLabel,     '96 BPM'],
    [s.style,          'City Pop × Cinematic'],
    [s.texture,        'Warm / Analog + Dark'],
    [s.rhythm,         'Relaxed → Groovy'],
    [s.instrumentation,'Electric Piano / Bass / Guitar / Soft Synth / Strings'],
    [s.referencesLabel,'3 tracks'],
    [s.origMelodyLabel,'melody-demo.wav'],
  ]

  const axes = [
    { label:`${s.acoustic} ←→ ${s.electronic}`, value: 44 },
    { label:`${s.relaxed} ←→ ${s.intense}`,     value: 68 },
    { label:`${s.familiar} ←→ ${s.experimental}`, value: 30 },
  ]

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="inspector-appear"
        onClick={e=>e.stopPropagation()}
        style={{
          background:'#1A1A19', border:'1px solid #2C2C2A', borderRadius:14,
          width:480, maxHeight:'82vh', overflow:'hidden',
          boxShadow:'0 32px 80px rgba(0,0,0,0.7)',
          display:'flex', flexDirection:'column',
        }}
      >
        {/* Header */}
        <div style={{ padding:'16px 18px', borderBottom:'1px solid #242422', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#3BBDAF', boxShadow:'0 0 6px #3BBDAF80' }}/>
              <span style={{ fontSize:11, color:'#3BBDAF', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase' }}>{s.creativeBrief}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:'#F0F0EE', letterSpacing:'-0.03em' }}>{s.exportTitle}</div>
            <div style={{ fontSize:11, color:'#4A4A48', marginTop:2 }}>{s.exportSubtitle}</div>
          </div>
          <button onClick={onClose} style={{
            width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
            background:'#222220', border:'none', borderRadius:7, cursor:'pointer', color:'#5A5A56',
            fontFamily:"'Inter',sans-serif",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:16 }}>
          {/* Creative path */}
          <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
            <PathTag label={s.pathTagSource}/>
            <Arrow/>
            <PathTag label={s.pathTagWarmPop} color="#F5A523"/>
            <Arrow/>
            <PathTag label={s.pathTagGroovy} color="#F5A523"/>
            <Arrow/>
            <PathTag label={s.hybridLabel} color="#F06090"/>
          </div>

          {/* Parameters table */}
          <div style={{ border:'1px solid #222220', borderRadius:10, overflow:'hidden' }}>
            {params.map(([k, v], i) => (
              <div key={k} style={{
                display:'flex', padding:'9px 14px',
                borderBottom: i < params.length-1 ? '1px solid #1E1E1C' : 'none',
                background: i%2===0 ? '#1E1E1C' : '#1A1A19',
              }}>
                <span style={{ fontSize:11, color:'#4A4A48', width:130, flexShrink:0 }}>{k}</span>
                <span style={{ fontSize:11, color:'#C0C0BC', fontWeight:500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Tone axes */}
          <div>
            <div style={{ fontSize:9, fontWeight:700, color:'#3A3A38', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>{s.toneAxes}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {axes.map(({ label, value }) => (
                <div key={label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:10, color:'#4A4A48' }}>{label}</span>
                    <span style={{ fontSize:10, color:'#5A5A56', fontFamily:"'JetBrains Mono',monospace" }}>{value}</span>
                  </div>
                  <div style={{ height:3, background:'#222220', borderRadius:2 }}>
                    <div style={{ height:'100%', width:`${value}%`, background:'#F06090', borderRadius:2, opacity:0.7 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid #1E1E1C', display:'flex', gap:7, flexShrink:0 }}>
          <EBtn label={s.exportAudio} icon="🎵" primary/>
          <EBtn label={s.copyPrompt} icon="📋"/>
          <EBtn label={s.openInDAW} icon="🎛"/>
        </div>
      </div>
    </div>
  )
}

function PathTag({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
      background: color ? color+'18' : '#1E1E1C',
      border:`1px solid ${color ? color+'30' : '#2C2C2A'}`,
      color: color ?? '#5A5A56',
    }}>{label}</span>
  )
}

function Arrow() { return <span style={{ color:'#2C2C2A', fontSize:12 }}>→</span> }

function EBtn({ label, icon, primary }: { label: string; icon: string; primary?: boolean }) {
  return (
    <button style={{
      flex: primary ? 1.4 : 1,
      display:'flex', alignItems:'center', justifyContent:'center', gap:5,
      padding:'9px 12px',
      background: primary ? '#3BBDAF' : '#1E1E1C',
      border: primary ? 'none' : '1px solid #2C2C2A',
      borderRadius:7,
      color: primary ? '#0D0D0C' : '#8A8A86',
      fontSize:11, fontWeight:700, cursor:'pointer',
      fontFamily:"'Inter',sans-serif",
      transition:'opacity 0.1s',
    }}
    onMouseEnter={e=>{ e.currentTarget.style.opacity='0.82' }}
    onMouseLeave={e=>{ e.currentTarget.style.opacity='1' }}
    >
      <span>{icon}</span> {label}
    </button>
  )
}
