// ─────────────────────────────────────────
// COLORES — Paleta moderna para campo
// Legible bajo sol (uso en campo)
// ─────────────────────────────────────────
export const COLORS = {
  // Marca principal
  primary:      '#1B6B2F',
  primaryLight: '#4CAF50',
  primaryDark:  '#0D4A1E',
  primaryBg:    '#F1F8F1',

  // Acento dorado de la marca
  acento:      '#F4A825',
  acentoLight: '#FFF3D6',
  acentoDark:  '#C17D0A',

  // Fondos
  bgPrimary:   '#F5F7F2',
  bgCard:      '#FFFFFF',
  bgGreen:     '#EDF7EE',
  bgGreenDark: '#D4EDDA',

  // Alertas
  danger:       '#C62828',
  dangerLight:  '#FFEBEE',
  warning:      '#E65100',
  warningLight: '#FFF3E0',
  success:      '#1B6B2F',
  successLight: '#EDF7EE',

  // Semáforo
  semaforoRojo:     '#D32F2F',
  semaforoAmarillo: '#F9A825',
  semaforoVerde:    '#2E7D32',

  // Texto
  textPrimary:   '#1A1A1A',
  textSecondary: '#4A4A4A',
  textMuted:     '#888888',
  textWhite:     '#FFFFFF',

  // Bordes
  border:  '#E0E0E0',
  divider: '#F0F0F0',

  // Extras
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
};

// ─────────────────────────────────────────
// SOMBRAS
// ─────────────────────────────────────────
export const SHADOW = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#1B6B2F',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius:  12,
    elevation:     8,
  },
};

// ─────────────────────────────────────────
// TIPOGRAFÍA
// ─────────────────────────────────────────
export const FONT_SIZE = {
  xs:   12,
  sm:   14,
  md:   16,
  lg:   18,
  xl:   22,
  xxl:  28,
  xxxl: 36,
};

export const FONT_WEIGHT = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
};

// ─────────────────────────────────────────
// ESPACIADO
// ─────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 999,
};

// ─────────────────────────────────────────
// CULTIVOS
// ─────────────────────────────────────────
export const CULTIVOS = {
  limon: {
    id:          1,
    nombre:      'Limón Mexicano',
    enfermedad:  'HLB (Dragón Amarillo)',
    color:       '#8BC34A',
    colorFondo:  '#F1F8E9',
    colorBorde:  '#7CB342',
    descripcion: 'Detecta Huanglongbing en hojas de limón',
  },
  papaya: {
    id:          2,
    nombre:      'Papaya',
    enfermedad:  'Araña Roja',
    color:       '#E65100',
    colorFondo:  '#FFF3E0',
    colorBorde:  '#FF6D00',
    descripcion: 'Detecta Tetranychus urticae en hojas de papaya',
  },
  platano: {
    id:          3,
    nombre:      'Plátano',
    enfermedad:  'Sigatoka Negra',
    color:       '#F9A825',
    colorFondo:  '#FFFDE7',
    colorBorde:  '#F4A825',
    descripcion: 'Detecta Mycosphaerella fijiensis en hojas de plátano',
  },
};

// ─────────────────────────────────────────
// API
// ─────────────────────────────────────────
export const API_URL = 'http://10.0.2.2:8000';
// Producción Railway:
// export const API_URL = 'https://agroscanner.up.railway.app';

// ─────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────
export const STORAGE = {
  TOKEN:   'agroscanner_token',
  USUARIO: 'agroscanner_usuario',
  OFFLINE: 'agroscanner_offline_queue',
};

// ─────────────────────────────────────────
// ASSETS — Imágenes de la app
// ─────────────────────────────────────────
//export const IMAGES = {
  // logo: require('../../assets/logo/jaguar.png'),
//};