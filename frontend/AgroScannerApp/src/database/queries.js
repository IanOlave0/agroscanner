/**
 * Módulo de consultas a la base de datos SQLite
 * 
 * Encargado de todas las operaciones CRUD (Create, Read, Update, Delete)
 * + funciones de sincronización offline-first
 * + autenticación JWT offline
 * 
 * PATRONES DE DISEÑO:
 * - Todas las funciones son asíncronas (async/await)
 * - Manejo de errores con try/catch
 * - Logs etiquetados por módulo [AgroScanner DB]
 * - Foreign keys activos para integridad referencial
 */
import { getDatabase } from "./initDB.js";

// ============================================================================
// USUARIOS - Gestión de sesión del agricultor
// ============================================================================

/**
 * Inserta un nuevo usuario en la base de datos
 * Se llama después de obtener token del backend (registro/login)
 *
 * @param {string} id - UUID único del usuario (del backend)
 * @param {string} nombre - Nombre completo del agricultor
 * @param {string} email - Correo electrónico del agricultor
 * @param {string} token - JWT emitido por el backend
 * @param {string|null} [zonaAgricola=null] - Zona agrícola del agricultor (opcional)
 * @param {string|null} [telefono=null] - Teléfono del agricultor (opcional)
 */
export async function insertUsuario(id, nombre, email, token, zonaAgricola = null, telefono = null) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "INSERT OR REPLACE INTO usuarios (id, nombre, email, token, zona_agricola, telefono) VALUES (?, ?, ?, ?, ?, ?)",
      [id, nombre, email, token, zonaAgricola, telefono]
    );
    console.log("[AgroScanner DB] Usuario insertado:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error inserting usuario:", error);
    throw error;
  }
}

/**
 * Obtiene un usuario por su ID
 * 
 * @param {string} id - UUID del usuario
 * @returns {Promise<Object|null>} Objeto del usuario o null si no existe
 */
export async function getUsuarioById(id) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync("SELECT * FROM usuarios WHERE id = ?", [id]);
  } catch (error) {
    console.error("[AgroScanner DB] Error getting usuario:", error);
    throw error;
  }
}

/**
 * Obtiene un usuario por su correo electrónico
 * Útil para verificar existencia antes de registro
 * 
 * @param {string} email - Correo electrónico
 * @returns {Promise<Object|null>} Objeto del usuario o null
 */
export async function getUsuarioByEmail(email) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync("SELECT * FROM usuarios WHERE email = ?", [email]);
  } catch (error) {
    console.error("[AgroScanner DB] Error getting usuario by email:", error);
    throw error;
  }
}

/**
 * Actualiza los datos del usuario (zona agrícola)
 * Se usa cuando el agricultor edita su perfil
 * 
 * @param {string} id - UUID del usuario
 * @param {string} zonaAgricola - Nueva zona agrícola
 * @param {number} sincronizado - 0=pendiente sync, 1=sincronizado (default 0)
 */
export async function updateUsuario(id, zonaAgricola, sincronizado = 0) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "UPDATE usuarios SET zona_agricola = ?, sincronizado = ? WHERE id = ?",
      [zonaAgricola, sincronizado, id]
    );
    console.log("[AgroScanner DB] Usuario actualizado:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error updating usuario:", error);
    throw error;
  }
}

/**
 * Actualiza la preferencia de compartir datos del usuario.
 * Controla si los datos del agricultor se sincronizan a la nube.
 *
 * @param {string} id - UUID del usuario
 * @param {number} compartir - 1 = activado, 0 = desactivado
 */
export async function updateCompartirDatos(id, compartir) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "UPDATE usuarios SET compartir_datos = ? WHERE id = ?",
      [compartir, id]
    );
    console.log("[AgroScanner DB] Compartir datos actualizado:", id, compartir);
  } catch (error) {
    console.error("[AgroScanner DB] Error updating compartir_datos:", error);
    throw error;
  }
}

/**
 * Obtiene el usuario actualmente logeado (único registro en tabla usuarios)
 * Se usa para verificar sesión activa en inicio de app
 * 
 * @returns {Promise<Object|null>} Objeto del usuario o null si no hay sesión
 */
export async function getUsuarioActivo() {
  const db = getDatabase();
  try {
    return await db.getFirstAsync(
      "SELECT * FROM usuarios WHERE token IS NOT NULL ORDER BY fecha_creacion DESC LIMIT 1",
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting usuario activo:", error);
    throw error;
  }
}

/**
 * Actualiza el token JWT del usuario
 * Se llama cuando se renueva el token desde el backend
 * 
 * @param {string} token - Nuevo token JWT
 */
export async function updateToken(token) {
  const db = getDatabase();
  try {
    await db.runAsync("UPDATE usuarios SET token = ? WHERE token IS NOT NULL", [token]);
    console.log("[AgroScanner DB] Token actualizado");
  } catch (error) {
    console.error("[AgroScanner DB] Error updating token:", error);
    throw error;
  }
}

/**
 * Cierra la sesión del usuario
 * Elimina el registro de la tabla usuarios (logout)
 * No elimina detecciones/parcelas del historial
 */
export async function logoutUsuario() {
  const db = getDatabase();
  try {
    await db.runAsync("DELETE FROM usuarios");
    console.log("[AgroScanner DB] Sesión cerrada, usuario eliminado");
  } catch (error) {
    console.error("[AgroScanner DB] Error logout usuario:", error);
    throw error;
  }
}

/**
 * Decodifica un token JWT para leer su payload
 * No verifica firma (solo lectura offline)
 * Formato JWT: header.payload.signature (BASE64)
 * 
 * @param {string} token - Token JWT a decodificar
 * @returns {Object|null} Payload decodificado o null si inválido
 */
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error("[AgroScanner DB] Error decoding JWT:", error);
    return null;
  }
}

/**
 * Verifica si el token JWT almacenado es válido para acceso offline
 * Lee el payload del JWT sin consultar al backend
 * 
 * FLUJO:
 * 1. Verifica que exista token almacenado
 * 2. Decodifica el JWT (header.payload.signature)
 * 3. Verifica campo "exp" (expiración) contra fecha actual
 * 4. Retorna resultado con objeto usuario si válido
 * 
 * @returns {Promise<{valido: boolean, razon?: string, usuario?: Object}>}
 */
export async function verifyTokenOffline() {
  const db = getDatabase();
  try {
    const usuario = await db.getFirstAsync("SELECT * FROM usuarios LIMIT 1");
    
    if (!usuario || !usuario.token) {
      console.log("[AgroScanner DB] No hay token almacenado");
      return { valido: false, razon: "sin_sesion" };
    }

    const payload = decodeJWT(usuario.token);
    
    if (!payload) {
      console.log("[AgroScanner DB] Token inválido");
      return { valido: false, razon: "token_invalido" };
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.log("[AgroScanner DB] Token expirado");
      return { valido: false, razon: "token_expirado" };
    }

    console.log("[AgroScanner DB] Token válido, usuario autenticado offline");
    return { valido: true, usuario };
  } catch (error) {
    console.error("[AgroScanner DB] Error verifying token offline:", error);
    throw error;
  }
}

// ============================================================================
// PARCELAS - Gestión de terrenos del agricultor (polígonos manuales)
// ============================================================================

/**
 * Inserta una nueva parcela con geometría en formato JSON
 * La parcela representa un terreno agrícola definido por un polígono
 * 
 * @param {string} id - UUID único de la parcela
 * @param {string} alias - Nombre identificador del terreno
 * @param {string} geometria - JSON array de coordenadas: [{"lat": x, "lng": y}, ...]
 * @param {number} metrosCuadrados - Área calculada (m²)
 * @param {string} areaTimestamp - Fecha del cálculo de área (ISO 8601)
 * @param {string} usuarioId - UUID del propietario
 */
export async function insertParcela(id, alias, geometria, metrosCuadrados, areaTimestamp, usuarioId) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "INSERT INTO parcelas (id, alias, geometria, metros_cuadrados, area_timestamp, usuario_id) VALUES (?, ?, ?, ?, ?, ?)",
      [id, alias, geometria, metrosCuadrados, areaTimestamp, usuarioId]
    );
    console.log("[AgroScanner DB] Parcela insertada:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error inserting parcela:", error);
    throw error;
  }
}

/**
 * Obtiene una parcela por su ID
 * 
 * @param {string} id - UUID de la parcela
 * @returns {Promise<Object|null>}
 */
export async function getParcelaById(id) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync("SELECT * FROM parcelas WHERE id = ?", [id]);
  } catch (error) {
    console.error("[AgroScanner DB] Error getting parcela:", error);
    throw error;
  }
}

/**
 * Obtiene todas las parcelas de un usuario
 * Ordenadas por fecha de creación
 * 
 * @param {string} usuarioId - UUID del usuario
 * @returns {Promise<Array>} Array de parcelas
 */
export async function getParcelasByUsuario(usuarioId) {
  const db = getDatabase();
  try {
    return await db.getAllAsync("SELECT * FROM parcelas WHERE usuario_id = ? ORDER BY fecha_creacion", [usuarioId]);
  } catch (error) {
    console.error("[AgroScanner DB] Error getting parcelas:", error);
    throw error;
  }
}

/**
 * Actualiza la geometría de una parcela (redibujo)
 * Recalcula el área y actualiza el timestamp
 * 
 * @param {string} id - UUID de la parcela
 * @param {string} geometria - Nuevo JSON de coordenadas
 * @param {number} metrosCuadrados - Nueva área calculada
 * @param {string} areaTimestamp - Nuevo timestamp de cálculo
 * @param {number} sincronizado - 0=pendiente, 1=sincronizado
 */
export async function updateParcelaGeometria(id, geometria, metrosCuadrados, areaTimestamp, sincronizado = 0) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "UPDATE parcelas SET geometria = ?, metros_cuadrados = ?, area_timestamp = ?, sincronizado = ? WHERE id = ?",
      [geometria, metrosCuadrados, areaTimestamp, sincronizado, id]
    );
    console.log("[AgroScanner DB] Parcela actualizada:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error updating parcela:", error);
    throw error;
  }
}

/**
 * Actualiza el alias de una parcela
 * 
 * @param {string} id - UUID de la parcela
 * @param {string} alias - Nuevo nombre
 * @param {number} sincronizado - 0=pendiente, 1=sincronizado
 */
export async function updateParcelaAlias(id, alias, sincronizado = 0) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "UPDATE parcelas SET alias = ?, sincronizado = ? WHERE id = ?",
      [alias, sincronizado, id]
    );
    console.log("[AgroScanner DB] Alias de parcela actualizado:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error updating parcela alias:", error);
    throw error;
  }
}

/**
 * Elimina una parcela
 * ADVERTENCIA: Esto también eliminará todas las detecciones vinculadas (CASCADE)
 * 
 * @param {string} id - UUID de la parcela
 */
export async function deleteParcela(id) {
  const db = getDatabase();
  try {
    await db.runAsync("DELETE FROM parcelas WHERE id = ?", [id]);
    console.log("[AgroScanner DB] Parcela eliminada:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error deleting parcela:", error);
    throw error;
  }
}

// ============================================================================
// CULTIVOS - Catálogo de cultivos disponibles
// ============================================================================

/**
 * Obtiene todos los cultivos del catálogo
 * 
 * @returns {Promise<Array>} Array de cultivos ordenados por nombre
 */
export async function getAllCultivos() {
  const db = getDatabase();
  try {
    return await db.getAllAsync("SELECT * FROM cultivos ORDER BY nombre");
  } catch (error) {
    console.error("[AgroScanner DB] Error getting cultivos:", error);
    throw error;
  }
}

/**
 * Obtiene un cultivo por su ID
 * 
 * @param {number} id - ID autoincremental
 * @returns {Promise<Object|null>}
 */
export async function getCultivoById(id) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync("SELECT * FROM cultivos WHERE id = ?", [id]);
  } catch (error) {
    console.error("[AgroScanner DB] Error getting cultivo:", error);
    throw error;
  }
}

// ============================================================================
// ENFERMEDADES - Catálogo de enfermedades
// ============================================================================

/**
 * Obtiene todas las enfermedades del catálogo
 * 
 * @returns {Promise<Array>} Array de enfermedades ordenadas por nombre
 */
export async function getAllEnfermedades() {
  const db = getDatabase();
  try {
    return await db.getAllAsync("SELECT * FROM enfermedades ORDER BY nombre");
  } catch (error) {
    console.error("[AgroScanner DB] Error getting enfermedades:", error);
    throw error;
  }
}

/**
 * Obtiene una enfermedad por su ID
 * 
 * @param {number} id - ID autoincremental
 * @returns {Promise<Object|null>}
 */
export async function getEnfermedadById(id) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync("SELECT * FROM enfermedades WHERE id = ?", [id]);
  } catch (error) {
    console.error("[AgroScanner DB] Error getting enfermedad:", error);
    throw error;
  }
}

/**
 * Obtiene todas las enfermedades que afectan a un cultivo específico
 * Incluye el tratamiento específico (tabla cultivo_enfermedad)
 * 
 * @param {number} cultivoId - ID del cultivo
 * @returns {Promise<Array>} Array de enfermedades con tratamiento
 */
export async function getEnfermedadesByCultivo(cultivoId) {
  const db = getDatabase();
  try {
    return await db.getAllAsync(
      `SELECT e.*, ce.tratamiento 
       FROM enfermedades e
       JOIN cultivo_enfermedad ce ON e.id = ce.enfermedad_id
       WHERE ce.cultivo_id = ?`,
      [cultivoId]
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting enfermedades by cultivo:", error);
    throw error;
  }
}

/**
 * Obtiene el tratamiento específico para una combinación cultivo-enfermedad
 * Se muestra cuando el modelo ML detecta una enfermedad
 * 
 * @param {number} cultivoId - ID del cultivo
 * @param {number} enfermedadId - ID de la enfermedad
 * @returns {Promise<Object|null>} Objeto con campo tratamiento
 */
export async function getTratamiento(cultivoId, enfermedadId) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync(
      "SELECT tratamiento FROM cultivo_enfermedad WHERE cultivo_id = ? AND enfermedad_id = ?",
      [cultivoId, enfermedadId]
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting tratamiento:", error);
    throw error;
  }
}

// ============================================================================
// DETECCIONES - Historial de análisis de cultivos
// ============================================================================

/**
 * Inserta una nueva detección (resultado del modelo ML)
 * Vinculada obligatoriamente a una parcela con pin manual
 * Se llama después de procesar una imagen con el modelo
 * 
 * @param {string} id - UUID único de la detección
 * @param {string} usuarioId - UUID del usuario que realizó análisis
 * @param {string} parcelaId - UUID de la parcela donde se encontró la enfermedad (obligatorio)
 * @param {number} cultivoId - ID del cultivo analizado
 * @param {number|null} enfermedadId - ID de enfermedad detectada (null si está sano)
 * @param {string} imagenUri - Ruta local de la imagen capturada
 * @param {number} nivelConfianza - Porcentaje de confianza del modelo ML (0-100)
 * @param {number|null} latitud - GPS latitud al momento del análisis (metadata)
 * @param {number|null} longitud - GPS longitud al momento del análisis (metadata)
 * @param {number} pinLatitud - Latitud del pin manual en la parcela
 * @param {number} pinLongitud - Longitud del pin manual en la parcela
 */
export async function insertDeteccion(
  id,
  usuarioId,
  parcelaId,
  cultivoId,
  enfermedadId,
  imagenUri,
  nivelConfianza,
  latitud,
  longitud,
  pinLatitud,
  pinLongitud
) {
  const db = getDatabase();
  try {
    await db.runAsync(
      `INSERT INTO detecciones (id, usuario_id, parcela_id, cultivo_id, enfermedad_id, imagen_uri, nivel_confianza, latitud, longitud, pin_latitud, pin_longitud)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, usuarioId, parcelaId, cultivoId, enfermedadId, imagenUri, nivelConfianza, latitud, longitud, pinLatitud, pinLongitud]
    );
    console.log("[AgroScanner DB] Detección insertada:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error inserting deteccion:", error);
    throw error;
  }
}

/**
 * Obtiene una detección por su ID
 * 
 * @param {string} id - UUID de la detección
 * @returns {Promise<Object|null>}
 */
export async function getDeteccionById(id) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync("SELECT * FROM detecciones WHERE id = ?", [id]);
  } catch (error) {
    console.error("[AgroScanner DB] Error getting deteccion:", error);
    throw error;
  }
}

/**
 * Obtiene una detección con sus datos relacionados (cultivo, enfermedad, parcela)
 * para la pantalla de detalle. Incluye nombres legibles mediante JOIN.
 *
 * @param {string} id - UUID de la detección
 * @returns {Promise<Object|null>} Detección con campos nombre_cultivo, nombre_enfermedad y parcela_alias
 */
export async function getDeteccionDetalle(id) {
  const db = getDatabase();
  try {
    return await db.getFirstAsync(
      `SELECT d.*, c.nombre as nombre_cultivo, e.nombre as nombre_enfermedad, p.alias as parcela_alias
       FROM detecciones d
       JOIN cultivos c ON d.cultivo_id = c.id
       JOIN parcelas p ON d.parcela_id = p.id
       LEFT JOIN enfermedades e ON d.enfermedad_id = e.id
       WHERE d.id = ?`,
      [id]
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting deteccion detalle:", error);
    throw error;
  }
}

/**
 * Obtiene todas las detecciones de un usuario
 * Incluye nombres de cultivo/enfermedad y alias de parcela (JOIN)
 * Ordenadas por fecha descendente (más recientes primero)
 * 
 * @param {string} usuarioId - UUID del usuario
 * @returns {Promise<Array>} Array de detecciones
 */
export async function getDeteccionesByUsuario(usuarioId) {
  const db = getDatabase();
  try {
    return await db.getAllAsync(
      `SELECT d.*, c.nombre as nombre_cultivo, e.nombre as nombre_enfermedad, p.alias as parcela_alias
       FROM detecciones d
       JOIN cultivos c ON d.cultivo_id = c.id
       JOIN parcelas p ON d.parcela_id = p.id
       LEFT JOIN enfermedades e ON d.enfermedad_id = e.id
       WHERE d.usuario_id = ?
       ORDER BY d.fecha_creacion DESC`,
      [usuarioId]
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting detecciones:", error);
    throw error;
  }
}

/**
 * Obtiene todas las detecciones de una parcela específica
 * Usado para mostrar mapa de calor por parcela
 * 
 * @param {string} parcelaId - UUID de la parcela
 * @returns {Promise<Array>} Array de detecciones
 */
export async function getDeteccionesByParcela(parcelaId) {
  const db = getDatabase();
  try {
    return await db.getAllAsync(
      `SELECT d.*, c.nombre as nombre_cultivo, e.nombre as nombre_enfermedad
       FROM detecciones d
       JOIN cultivos c ON d.cultivo_id = c.id
       LEFT JOIN enfermedades e ON d.enfermedad_id = e.id
       WHERE d.parcela_id = ?
       ORDER BY d.fecha_creacion DESC`,
      [parcelaId]
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting detecciones by parcela:", error);
    throw error;
  }
}

/**
 * Elimina una detección del historial
 * 
 * @param {string} id - UUID de la detección
 */
export async function deleteDeteccion(id) {
  const db = getDatabase();
  try {
    await db.runAsync("DELETE FROM detecciones WHERE id = ?", [id]);
    console.log("[AgroScanner DB] Detección eliminada:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error deleting deteccion:", error);
    throw error;
  }
}

// ============================================================================
// SINCRONIZACIÓN - Offline-First (para SyncManager)
// ============================================================================

/**
 * Obtiene detecciones pendientes de sincronizar
 * Se usa cuando hay conexión para subir al backend
 * 
 * @returns {Promise<Array>} Array de detecciones con sincronizado = 0
 */
export async function getDeteccionesPendientes(usuarioId) {
  const db = getDatabase();
  try {
    return await db.getAllAsync(
      "SELECT * FROM detecciones WHERE sincronizado = 0 AND usuario_id = ? ORDER BY fecha_creacion",
      [usuarioId]
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting detecciones pendientes:", error);
    throw error;
  }
}

/**
 * Obtiene parcelas pendientes de sincronizar
 * Se usa para sincronizar cambios de geometría/alias offline
 * 
 * @returns {Promise<Array>}
 */
export async function getParcelasPendientes(usuarioId) {
  const db = getDatabase();
  try {
    return await db.getAllAsync(
      "SELECT * FROM parcelas WHERE sincronizado = 0 AND usuario_id = ? ORDER BY fecha_creacion",
      [usuarioId]
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting parcelas pendientes:", error);
    throw error;
  }
}

/**
 * Obtiene usuarios con datos pendientes de sincronizar
 * (ej: zona_agricola editada offline)
 * 
 * @returns {Promise<Array>}
 */
export async function getUsuariosPendientes() {
  const db = getDatabase();
  try {
    return await db.getAllAsync(
      "SELECT * FROM usuarios WHERE sincronizado = 0 ORDER BY fecha_creacion"
    );
  } catch (error) {
    console.error("[AgroScanner DB] Error getting usuarios pendientes:", error);
    throw error;
  }
}

/**
 * Marca una detección como sincronizada
 * Se llama después de subir exitosamente al backend
 * 
 * @param {string} id - UUID de la detección
 * @param {number} sincronizado - 1 por defecto (ya sincronizado)
 */
export async function updateDeteccionSincronizado(id, sincronizado = 1) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "UPDATE detecciones SET sincronizado = ? WHERE id = ?",
      [sincronizado, id]
    );
    console.log("[AgroScanner DB] Detección marcada como sincronizada:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error updating deteccion sincronizado:", error);
    throw error;
  }
}

/**
 * Marca una parcela como sincronizada
 * Se llama después de subir la geometría al backend
 * 
 * @param {string} id - UUID de la parcela
 * @param {number} sincronizado - 1 por defecto
 */
export async function updateParcelaSincronizado(id, sincronizado = 1) {
  const db = getDatabase();
  try {
    await db.runAsync(
      "UPDATE parcelas SET sincronizado = ? WHERE id = ?",
      [sincronizado, id]
    );
    console.log("[AgroScanner DB] Parcela marcada como sincronizada:", id);
  } catch (error) {
    console.error("[AgroScanner DB] Error updating parcela sincronizado:", error);
    throw error;
  }
}