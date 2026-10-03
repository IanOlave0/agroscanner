// ─────────────────────────────────────────
// USUARIO
// Refleja la tabla usuarios de la BD
// ─────────────────────────────────────────
export interface Usuario {
  id:           string;
  nombre:       string;
  email:        string;
  token:        string;
  zona_agricola?: string;
  telefono?: string;
  compartir_datos?: boolean;
  fecha_creacion?: string;
  sincronizado?: boolean;
}

// ─────────────────────────────────────────
// PARCELA
// Refleja la tabla parcelas de la BD
// Geometría almacenada como JSON string
// ─────────────────────────────────────────
export interface Parcela {
  id:              string;
  alias:           string;
  geometria:       string;  // JSON: [{"lat": x, "lng": y}, ...]
  metros_cuadrados: number;
  area_timestamp?:  string;
  usuario_id:       string;
  fecha_creacion?:  string;
  sincronizado?:    boolean;
}

// ─────────────────────────────────────────
// CULTIVO
// Refleja la tabla cultivos de la BD
// ─────────────────────────────────────────
export interface Cultivo {
  id:                  number;
  nombre:              string;
  tratamiento_sugerido?: string;
}

// ─────────────────────────────────────────
// ENFERMEDAD
// Refleja la tabla enfermedades de la BD
// ─────────────────────────────────────────
export interface Enfermedad {
  id:          number;
  nombre:      string;
  descripcion: string;
}

// ─────────────────────────────────────────
// CULTIVO_ENFERMEDAD (Relación)
// Refleja la tabla cultivo_enfermedad de la BD
// ─────────────────────────────────────────
export interface CultivoEnfermedad {
  cultivo_id:    number;
  enfermedad_id: number;
  tratamiento:   string;
}

// ─────────────────────────────────────────
// DETECCION
// Refleja la tabla detecciones de la BD
// Es el dato más importante de la app
// ─────────────────────────────────────────
export interface Deteccion {
  id:                string;
  usuario_id:        string;
  parcela_id:        string;
  cultivo_id:        number;
  enfermedad_id?:    number;
  imagen_uri:        string;
  nivel_confianza:   number;    // 0-100
  latitud?:          number;    // GPS metadata
  longitud?:         number;    // GPS metadata
  pin_latitud:       number;    // Pin manual
  pin_longitud:      number;    // Pin manual
  compartido?:       boolean;
  fecha_creacion?:   string;
  sincronizado?:     boolean;
  // Datos relacionados (joins)
  nombre_cultivo?:     string;
  nombre_enfermedad?:  string;
  parcela_alias?:      string;
  tratamiento?:        string;
}

// ─────────────────────────────────────────
// RESULTADO ML
// Lo que regresa el modelo ML
// tras analizar una imagen
// ─────────────────────────────────────────
export interface ResultadoML {
  enfermedad:        string;
  confianza:         number;   // 0.0 a 1.0, ej: 0.92 = 92%
  resultado_positivo: boolean;
  tratamiento:       string;
  nivel_riesgo:      'critico' | 'alto' | 'sano';
}

// ─────────────────────────────────────────
// NAVEGACION
// Define las pantallas y sus parámetros
// ─────────────────────────────────────────
export type RootStackParams = {
  // Auth
  Welcome:   undefined;
  Login:     undefined;
  Registro:  undefined;

  // Main (tabs)
  Home:      undefined;
  Scanner:   undefined;
  Historial: undefined;
  Mapa:      undefined;
  Perfil:    undefined;

  // Scanner flow
  SeleccionCultivo: undefined;
  Camara:    { cultivoId: number; cultivoNombre: string };
  Resultado: { resultado: ResultadoML; imagenUri: string; cultivoId: number; cultivoNombre: string };
  ResultadoDecision: { resultado: ResultadoML; imagenUri: string; cultivoId: number; cultivoNombre: string };
  PinPlacement: { resultado: ResultadoML; imagenUri: string; cultivoId: number; cultivoNombre: string };

  // Parcelas flow
  ParcelaGestion: undefined;
  ParcelaCanvas:  { parcelaId?: string };  // undefined = nueva, string = editar

  // Historial detail
  DeteccionDetalle: { deteccionId: string };
};

// ─────────────────────────────────────────
// API RESPONSES
// Forma estándar de respuestas del backend
// ─────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message: string;
}

export interface LoginResponse {
  access_token: string;
  token_type:   string;
  usuario:      Usuario;
}