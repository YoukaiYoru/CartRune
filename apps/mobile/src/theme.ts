export const theme = {
  bg: {
    deep: '#111019',
    card: '#1b1726',
    surface: '#272137',
    elevated: '#342b49',
    input: '#201b2c',
    panel: '#211c2f',
  },
  accent: {
    primary: '#d5f36b',
    warm: '#ff8a4c',
    muted: '#69e2d1',
    dim: '#817994',
    violet: '#9b82f3',
  },
  text: {
    primary: '#fff8ed',
    secondary: '#d0c8dc',
    muted: '#958ba8',
    accent: '#d5f36b',
  },
  border: {
    subtle: '#30283f',
    default: '#4a3d5f',
    shelf: '#5a4a6e',
  },
  shelf: {
    top: '#554469',
    face: '#2b223b',
    edge: '#ff8a4c',
    shadow: '#09080e',
  },
  status: {
    playing: '#69e2d1',
    completed: '#958ba8',
    backlog: '#ff8a4c',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    pill: 999,
  },
  spacing: {
    screen: 18,
    section: 28,
  },
} as const;
