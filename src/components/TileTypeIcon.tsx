export type TileIconKind =
  | 'image' | 'hum' | 'reference' | 'text' | 'lyrics' | 'intent'
  | 'frame' | 'folder' | 'demo' | 'work' | 'audio' | 'spark'
  | 'note'

interface Props {
  kind: TileIconKind
  color?: string
  size?: number
  className?: string
}

/**
 * MuseFlow tile icon family.
 * Every mark is intentionally single-colour and borderless so the card colour,
 * rather than an icon container, carries the type identity.
 */
export function TileTypeIcon({ kind, color = 'currentColor', size = 18, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    className,
    style: { display:'block', color, flexShrink:0 } as React.CSSProperties,
  }

  switch (kind) {
    case 'image':
      return <svg {...common}>
        <circle cx="17.7" cy="6.2" r="2.35" fill="currentColor"/>
        <path d="M3.1 18.7 8.4 11.4a1.35 1.35 0 0 1 2.14-.08l2.16 2.55 1.58-1.72a1.3 1.3 0 0 1 1.94.02l4.72 5.46c.76.88.14 2.25-1.02 2.25H4.17c-.61 0-1.07-.68-1.07-1.18Z" fill="currentColor"/>
      </svg>
    case 'hum':
      return <svg {...common}>
        <rect x="3" y="10" width="2.7" height="8" rx="1.35" fill="currentColor"/>
        <rect x="7.55" y="5.5" width="2.7" height="13" rx="1.35" fill="currentColor"/>
        <rect x="12.1" y="8" width="2.7" height="10.5" rx="1.35" fill="currentColor"/>
        <rect x="16.65" y="3" width="2.7" height="15.5" rx="1.35" fill="currentColor"/>
        <circle cx="21.1" cy="11.2" r="1.35" fill="currentColor"/>
      </svg>
    case 'reference':
      return <svg {...common}>
        <path d="M8.55 15.45 6.8 17.2a3.54 3.54 0 0 1-5-5l3.6-3.6a3.54 3.54 0 0 1 5 0 3.4 3.4 0 0 1 .66.92l-2.15 2.15a1.3 1.3 0 0 0-.3-.96 1.55 1.55 0 0 0-2.12.01l-2.57 2.57a1.5 1.5 0 0 0 2.12 2.12l1.29-1.29c.25.49.58.94.99 1.35l.23.2Z" fill="currentColor"/>
        <path d="m15.45 8.55 1.75-1.75a3.54 3.54 0 0 1 5 5l-3.6 3.6a3.54 3.54 0 0 1-5 0 3.4 3.4 0 0 1-.66-.92l2.15-2.15c.02.35.12.68.3.96a1.55 1.55 0 0 0 2.12-.01l2.57-2.57a1.5 1.5 0 0 0-2.12-2.12l-1.29 1.29a5.1 5.1 0 0 0-.99-1.35l-.23-.2Z" fill="currentColor"/>
        <path d="m8.1 14.15 6.05-6.05a1.24 1.24 0 0 1 1.75 1.75l-6.05 6.05a1.24 1.24 0 1 1-1.75-1.75Z" fill="currentColor"/>
      </svg>
    case 'text':
      return <svg {...common}>
        <path d="M4 4.2c0-.66.54-1.2 1.2-1.2h13.6a1.2 1.2 0 1 1 0 2.4h-5.5v14.1a1.3 1.3 0 0 1-2.6 0V5.4H5.2C4.54 5.4 4 4.86 4 4.2Z" fill="currentColor"/>
        <circle cx="18.8" cy="18.6" r="2.2" fill="currentColor" opacity=".55"/>
      </svg>
    case 'lyrics':
      return <svg {...common}>
        <path d="M9.4 3.7v11.15a3.75 3.75 0 1 1-2.45-3.52V6.05l11.4-2.45v8.8a3.75 3.75 0 1 1-2.45-3.52V2.94L9.4 4.34V3.7Z" fill="currentColor"/>
      </svg>
    case 'intent':
    case 'spark':
      return <svg {...common}>
        <path d="M12 1.8c.73 5.23 3.02 7.52 8.2 8.2-5.18.68-7.47 2.97-8.2 8.2-.73-5.23-3.02-7.52-8.2-8.2 5.18-.68 7.47-2.97 8.2-8.2Z" fill="currentColor"/>
        <circle cx="19.5" cy="18.2" r="2" fill="currentColor" opacity=".55"/>
      </svg>
    case 'frame':
      return <svg {...common}>
        <circle cx="5.2" cy="6" r="2.8" fill="currentColor"/>
        <path d="M12 2.9 15.1 6 12 9.1 8.9 6 12 2.9Z" fill="currentColor" opacity=".78"/>
        <rect x="16" y="3.2" width="5.6" height="5.6" rx="1.9" fill="currentColor" opacity=".58"/>
        <rect x="3" y="14.8" width="5.6" height="5.6" rx="1.9" fill="currentColor" opacity=".62"/>
        <circle cx="12" cy="17.6" r="2.8" fill="currentColor" opacity=".8"/>
        <path d="m18.8 14.5 3.2 5.7h-6.4l3.2-5.7Z" fill="currentColor"/>
      </svg>
    case 'folder':
      return <svg {...common}>
        <path d="M3 7.2c0-1.1.9-2 2-2h4.1l1.7 1.9H19c1.1 0 2 .9 2 2v1.15H3V7.2Z" fill="currentColor" opacity=".62"/>
        <path d="M2.4 11.15h19.2l-1.65 7.05a2.15 2.15 0 0 1-2.1 1.66H6.15a2.15 2.15 0 0 1-2.1-1.66L2.4 11.15Z" fill="currentColor"/>
        <circle cx="9" cy="15.15" r="1.05" fill="currentColor" opacity=".42"/>
        <circle cx="12" cy="15.15" r="1.05" fill="currentColor" opacity=".42"/>
        <circle cx="15" cy="15.15" r="1.05" fill="currentColor" opacity=".42"/>
      </svg>
    case 'note':
      return <svg {...common}>
        <path d="M5.2 3.1h10.45L20.9 8v10.8a2.1 2.1 0 0 1-2.1 2.1H5.2a2.1 2.1 0 0 1-2.1-2.1V5.2a2.1 2.1 0 0 1 2.1-2.1Z" fill="currentColor"/>
        <path d="M15.65 3.1V8h5.25l-5.25-4.9Z" fill="currentColor" opacity=".52"/>
        <circle cx="7.2" cy="16.9" r="1.25" fill="currentColor" opacity=".48"/>
      </svg>
    case 'demo':
      return <svg {...common}>
        <path d="M4 15.7V8.3c0-1.03 1.12-1.66 2-1.12l6.1 3.7a1.3 1.3 0 0 1 0 2.24L6 16.82c-.88.54-2-.09-2-1.12Z" fill="currentColor"/>
        <rect x="15.2" y="4" width="2.2" height="16" rx="1.1" fill="currentColor" opacity=".52"/>
        <rect x="19.2" y="7.1" width="2.2" height="9.8" rx="1.1" fill="currentColor" opacity=".82"/>
      </svg>
    case 'work':
      return <svg {...common}>
        <rect x="2.5" y="10.2" width="2.4" height="7.3" rx="1.2" fill="currentColor" opacity=".56"/>
        <rect x="6.4" y="6.8" width="2.4" height="10.7" rx="1.2" fill="currentColor" opacity=".76"/>
        <rect x="10.3" y="3.4" width="2.4" height="14.1" rx="1.2" fill="currentColor"/>
        <path d="M17.7 3.2c.4 2.3 1.55 3.45 3.85 3.85-2.3.4-3.45 1.55-3.85 3.85-.4-2.3-1.55-3.45-3.85-3.85 2.3-.4 3.45-1.55 3.85-3.85Z" fill="currentColor"/>
        <rect x="14.2" y="12" width="2.4" height="5.5" rx="1.2" fill="currentColor" opacity=".66"/>
        <rect x="18.1" y="10" width="2.4" height="7.5" rx="1.2" fill="currentColor" opacity=".48"/>
      </svg>
    case 'audio':
    default:
      return <svg {...common}>
        <rect x="3" y="9" width="2.6" height="8" rx="1.3" fill="currentColor" opacity=".55"/>
        <rect x="7.6" y="5" width="2.6" height="12" rx="1.3" fill="currentColor"/>
        <rect x="12.2" y="7.5" width="2.6" height="9.5" rx="1.3" fill="currentColor" opacity=".78"/>
        <rect x="16.8" y="3" width="2.6" height="14" rx="1.3" fill="currentColor" opacity=".9"/>
      </svg>
  }
}
