export const theme = {
  bg: {
    deep: '#070A12',
    card: '#101727',
    surface: '#17233A',
    elevated: '#203451',
    input: '#0D1422',
    panel: '#0B1220',
    glass: 'rgba(22, 34, 56, 0.78)',
    glassStrong: 'rgba(28, 45, 72, 0.92)',
  },
  accent: {
    primary: '#B8FF4A',
    warm: '#FF8A5B',
    muted: '#5DE7D4',
    dim: '#7383A0',
    violet: '#9C7CFF',
    electric: '#56B6FF',
  },
  text: {
    primary: '#F4F7FF',
    secondary: '#B7C3D9',
    muted: '#71809A',
    accent: '#B8FF4A',
  },
  border: {
    subtle: 'rgba(146, 180, 226, 0.14)',
    default: 'rgba(146, 180, 226, 0.32)',
    shelf: '#315276',
    glow: 'rgba(93, 231, 212, 0.52)',
  },
  shelf: {
    top: '#203451',
    face: '#101A2C',
    edge: '#FF8A5B',
    shadow: '#03050A',
  },
  status: {
    playing: '#69e2d1',
    completed: '#958ba8',
    backlog: '#ff8a4c',
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 26,
    pill: 999,
  },
  spacing: {
    screen: 18,
    section: 28,
  },
  motion: {
    micro: 160,
    state: 240,
    entrance: 450,
    stagger: 60,
  },
  depth: {
    perspective: 760,
    lift: 2,
    shadowOpacity: 0.32,
  },
} as const;
