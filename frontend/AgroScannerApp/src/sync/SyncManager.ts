/**
 * SyncManager — Sincronizacion offline-first (push-only).
 *
 * Sube parcelas y detecciones pendientes de SQLite local a Supabase
 * cuando se detecta conexion a internet. Las imagenes se suben a
 * Supabase Storage y la URI local se reemplaza por la URL publica.
 *
 * Reglas:
 * - Solo sincroniza si el usuario acepto compartir_datos = 1
 * - Los datos de invitado (usuario_id = 'guest') nunca se suben
 * - Retry con exponential backoff: 1s, 4s, 16s
 *
 * @author AgroScanner Team
 */

import { supabase } from '../supabase/client';
import { File } from 'expo-file-system';
import {
  getParcelasPendientes,
  getDeteccionesPendientes,
  updateParcelaSincronizado,
  updateDeteccionSincronizado,
  getUsuarioActivo,
} from '../database/queries';
import { getDatabase } from '../database/initDB';
import type { Parcela, Deteccion, Usuario } from '../types';

const RETRY_DELAYS = [1000, 4000, 16000];
const BUCKET_NAME = 'detecciones';

let syncing = false;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>, label: string): Promise<T> => {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < RETRY_DELAYS.length) {
        console.warn(`[AgroScanner Sync] ${label} - intento ${attempt + 1} fallido, reintentando en ${RETRY_DELAYS[attempt]}ms`);
        await delay(RETRY_DELAYS[attempt]);
      } else {
        console.error(`[AgroScanner Sync] ${label} - agotados los reintentos:`, error);
        throw error;
      }
    }
  }
  throw new Error(`[AgroScanner Sync] ${label} - error inesperado`);
};

/**
 * Sube una imagen local a Supabase Storage y retorna la URL publica.
 *
 * Se lee el archivo local con la API File de expo-file-system
 * (metodo bytes()) y se sube el contenido binario real a Storage.
 *
 * @param localUri    Ruta local de la imagen (file://)
 * @param userId      UUID del usuario dueno de la imagen
 * @param deteccionId UUID de la deteccion asociada
 * @returns URL publica de la imagen en Supabase Storage
 * @throws Error si la subida falla tras los reintentos
 */
const uploadImage = async (localUri: string, userId: string, deteccionId: string): Promise<string> => {
  const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `${userId}/${deteccionId}.${ext}`;
  const contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;

  console.log(`[AgroScanner Sync] Subiendo imagen: ${path}`);

  await withRetry(async () => {
    const fileBytes = await new File(localUri).bytes();

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileBytes, {
        contentType,
        upsert: true,
      });

    if (error) throw error;
  }, `uploadImage/${deteccionId}`);

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  console.log(`[AgroScanner Sync] Imagen subida: ${publicUrl}`);
  return publicUrl;
};

/**
 * Asegura que el usuario exista en public.usuarios en Postgres antes
 * de sincronizar datos. Si no existe, las FK de parcelas/detecciones
 * fallan con error 23503.
 */
const ensureUsuarioInSupabase = async (usuario: Usuario): Promise<void> => {
  const { error } = await supabase.from('usuarios').upsert({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email || '',
    zona_agricola: usuario.zona_agricola || null,
    telefono: usuario.telefono || null,
    compartir_datos: usuario.compartir_datos ? 1 : 0,
  }, { onConflict: 'id' });

  if (error) {
    console.error('[AgroScanner Sync] Error haciendo upsert de usuario a Supabase:', error);
    throw error;
  }
  console.log('[AgroScanner Sync] Usuario verificado en Supabase:', usuario.id);
};

/**
 * Sube parcelas pendientes a Supabase.
 * Filtra por sincronizado = 0 del usuario autenticado.
 */
const pushParcelas = async (usuarioId: string): Promise<{ subidas: number; errores: number }> => {
  const pendientes = (await getParcelasPendientes(usuarioId)) as Parcela[];
  let subidas = 0;
  let errores = 0;

  for (const parcela of pendientes) {
    try {
      await withRetry(async () => {
        const { error } = await supabase.from('parcelas').upsert({
          id: parcela.id,
          alias: parcela.alias,
          geometria: typeof parcela.geometria === 'string'
            ? JSON.parse(parcela.geometria)
            : parcela.geometria,
          metros_cuadrados: parcela.metros_cuadrados,
          area_timestamp: parcela.area_timestamp || null,
          usuario_id: parcela.usuario_id,
          fecha_creacion: parcela.fecha_creacion || new Date().toISOString(),
        });

        if (error) throw error;
      }, `pushParcelas/${parcela.id}`);

      await updateParcelaSincronizado(parcela.id);
      subidas++;
    } catch (error) {
      console.error(`[AgroScanner Sync] Error subiendo parcela ${parcela.id}:`, error);
      errores++;
    }
  }

  return { subidas, errores };
};

/**
 * Sube detecciones pendientes a Supabase.
 * - Sube la imagen a Storage
 * - Reemplaza imagen_uri por la URL publica
 * - Upsert en tabla detecciones
 * - Marca como sincronizado en SQLite
 */
const pushDetecciones = async (usuarioId: string): Promise<{ subidas: number; errores: number }> => {
  const pendientes = (await getDeteccionesPendientes(usuarioId)) as Deteccion[];
  let subidas = 0;
  let errores = 0;

  for (const deteccion of pendientes) {
    try {
      let imagenUrl = deteccion.imagen_uri;

      if (imagenUrl && (imagenUrl.startsWith('file://') || imagenUrl.startsWith('content://') || imagenUrl.startsWith('/'))) {
        imagenUrl = await uploadImage(imagenUrl, deteccion.usuario_id, deteccion.id);
      }

      await withRetry(async () => {
        const { error } = await supabase.from('detecciones').upsert({
          id: deteccion.id,
          usuario_id: deteccion.usuario_id,
          parcela_id: deteccion.parcela_id,
          cultivo_id: deteccion.cultivo_id,
          enfermedad_id: deteccion.enfermedad_id || null,
          imagen_uri: imagenUrl,
          nivel_confianza: deteccion.nivel_confianza,
          latitud: deteccion.latitud || null,
          longitud: deteccion.longitud || null,
          pin_latitud: deteccion.pin_latitud,
          pin_longitud: deteccion.pin_longitud,
          compartido: true,
          fecha_creacion: deteccion.fecha_creacion || new Date().toISOString(),
        });

        if (error) throw error;
      }, `pushDetecciones/${deteccion.id}`);

      await updateDeteccionSincronizado(deteccion.id);

      if (imagenUrl !== deteccion.imagen_uri) {
        const db = getDatabase();
        await db.runAsync(
          'UPDATE detecciones SET imagen_uri = ? WHERE id = ?',
          [imagenUrl, deteccion.id],
        );
      }
      subidas++;
    } catch (error) {
      console.error(`[AgroScanner Sync] Error subiendo deteccion ${deteccion.id}:`, error);
      errores++;
    }
  }

  return { subidas, errores };
};

/**
 * Punto de entrada principal del SyncManager.
 * Verifica que el usuario haya aceptado compartir datos y que no sea
 * invitado antes de iniciar la sincronizacion.
 *
 * @returns Resumen de la sincronizacion
 */
export const pushPendingData = async (): Promise<{
  parcelas: { subidas: number; errores: number };
  detecciones: { subidas: number; errores: number };
} | null> => {
  if (syncing) {
    console.log('[AgroScanner Sync] Ya hay una sincronizacion en curso');
    return null;
  }

  syncing = true;
  console.log('[AgroScanner Sync] Iniciando sincronizacion push...');

  try {
    getDatabase();
  } catch {
    console.log('[AgroScanner Sync] BD no inicializada, sincronizacion pospuesta');
    syncing = false;
    return null;
  }

  try {
    const usuario = await getUsuarioActivo() as Usuario | null;
    if (!usuario) {
      console.log('[AgroScanner Sync] No hay usuario activo, sincronizacion pospuesta');
      return null;
    }

    console.log('[AgroScanner Sync] Verificando usuario en Supabase...');

    if (usuario.id === 'guest' || !usuario.compartir_datos) {
      console.log('[AgroScanner Sync] Usuario no apto para sync (guest o no comparte datos)');
      return null;
    }

    await ensureUsuarioInSupabase(usuario);

    console.log('[AgroScanner Sync] Subiendo parcelas...');
    const resultadoParcelas = await pushParcelas(usuario.id);
    console.log(`[AgroScanner Sync] Parcelas: ${resultadoParcelas.subidas} subidas, ${resultadoParcelas.errores} errores`);

    console.log('[AgroScanner Sync] Subiendo detecciones...');
    const resultadoDetecciones = await pushDetecciones(usuario.id);
    console.log(`[AgroScanner Sync] Detecciones: ${resultadoDetecciones.subidas} subidas, ${resultadoDetecciones.errores} errores`);

    console.log('[AgroScanner Sync] Sincronizacion completada');
    return { parcelas: resultadoParcelas, detecciones: resultadoDetecciones };
  } catch (error) {
    console.error('[AgroScanner Sync] Error general:', error);
    return null;
  } finally {
    syncing = false;
  }
};

export default { pushPendingData };
