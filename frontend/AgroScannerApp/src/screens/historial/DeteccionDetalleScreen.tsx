/**
 * @file src/screens/historial/DeteccionDetalleScreen.tsx
 * @description Pantalla de detalle de una deteccion.
 * Muestra la imagen capturada, datos del cultivo, enfermedad detectada,
 * nivel de confianza, parcela asociada (solo para usuarios autenticados),
 * coordenadas del pin, fecha del analisis y estado de sincronizacion.
 *
 * La seccion de parcela y sincronizacion se oculta para usuarios
 * invitado (guest) ya que no tienen parcelas reales ni sincronizacion.
 *
 * Migracion UI/UX:
 * - Header con fondo verde y bordes redondeados inferiores.
 * - Layout con stacks de Tamagui (YStack, XStack, Text).
 * - Iconos vectoriales de Lucide React Native.
 * - Constantes de diseno desde src/constants.
 *
 * @author AgroScanner Team
 */

import React, { useState } from 'react';
import {
  ScrollView, TouchableOpacity, StatusBar, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { YStack, XStack, Text } from 'tamagui';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw, CloudOff, MapPin,
} from 'lucide-react-native';

import { COLORS, SHADOW } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { getDeteccionDetalle } from '../../database/queries';
import { pushPendingData } from '../../sync/SyncManager';
import { Deteccion, RootStackParams } from '../../types';
import { LimonIcon, PapayaIcon, PlatanoIcon } from '../../components/icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DetectionDetailNavigationProp = NativeStackNavigationProp<RootStackParams, 'DeteccionDetalle'>;
type DetectionDetailRouteProp = RouteProp<RootStackParams, 'DeteccionDetalle'>;

type Props = {
  navigation: DetectionDetailNavigationProp;
  route: DetectionDetailRouteProp;
};

/**
 * Devuelve el icono vectorial correspondiente al ID de cultivo.
 *
 * @param id    ID del cultivo (1 = Limon, 2 = Papaya, 3 = Platano)
 * @param size  Dimension en puntos del icono
 * @returns Componente SVG del icono o null si el ID no es valido
 */
const getIconoCultivo = (id: number, size: number) => {
  switch (id) {
    case 1: return <LimonIcon width={size} height={size} />;
    case 2: return <PapayaIcon width={size} height={size} />;
    case 3: return <PlatanoIcon width={size} height={size} />;
    default: return null;
  }
};

export default function DeteccionDetalleScreen({ navigation, route }: Props) {
  const { deteccionId } = route.params;
  const { estado } = useAuth();
  const isGuest = estado === 'guest';

  const [deteccion, setDeteccion] = useState<Deteccion | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      cargarDeteccion();
    }, [deteccionId]),
  );

  /**
   * Carga la deteccion completa con datos relacionados desde SQLite.
   */
  const cargarDeteccion = async () => {
    try {
      setLoading(true);
      const det = await getDeteccionDetalle(deteccionId) as Deteccion | null;
      setDeteccion(det);
    } catch (error) {
      console.error('[DetectionDetail] Error cargando deteccion:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Dispara la sincronizacion push y refresca los datos locales.
   */
  const handleSync = async () => {
    setSyncing(true);
    try {
      await pushPendingData();
      await cargarDeteccion();
    } catch (error) {
      console.error('[DetectionDetail] Error sincronizando:', error);
    } finally {
      setSyncing(false);
    }
  };

  // ── Estado de carga ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary }} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text fontSize={16} color="$textSecondary" mt="$md">
          Cargando detalle...
        </Text>
      </SafeAreaView>
    );
  }

  // ── Deteccion no encontrada ──────────────────────────────────────
  if (!deteccion) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$md" px="$lg">
          <AlertTriangle size={48} color={COLORS.warning} />
          <Text fontSize={18} fontWeight="700" color="$textPrimary" textAlign="center">
            Deteccion no encontrada
          </Text>
          <Text fontSize={14} color="$textMuted" textAlign="center">
            El registro solicitado no existe o fue eliminado.
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <YStack bg={COLORS.primary} borderRadius="$full" px="$xl" py="$sm" mt="$md">
              <Text fontSize={14} fontWeight="700" color={COLORS.white}>
                Volver
              </Text>
            </YStack>
          </TouchableOpacity>
        </YStack>
      </SafeAreaView>
    );
  }

  const esPositivo = !!deteccion.enfermedad_id;
  const colorEstado = esPositivo ? COLORS.danger : COLORS.success;
  const confianzaPct = Math.round(deteccion.nivel_confianza);
  const sincronizado = !!deteccion.sincronizado;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.primary }} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: COLORS.bgPrimary }}
      >
        <YStack gap="$lg" pb="$xxl">

          {/* ── Header con fondo verde y bordes redondeados ──────── */}
          <YStack
            backgroundColor={COLORS.primary}
            px="$lg"
            pt="$lg"
            pb="$xl"
            gap="$md"
            borderBottomLeftRadius={32}
            borderBottomRightRadius={32}
            style={SHADOW.lg}
          >
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <XStack alignItems="center" gap="$xs">
                <ArrowLeft size={20} color={COLORS.white} />
                <Text fontSize={14} fontWeight="600" color={COLORS.white}>
                  Volver
                </Text>
              </XStack>
            </TouchableOpacity>
            <Text fontSize={24} fontWeight="800" color={COLORS.white} textAlign="center">
              Detalle de Deteccion
            </Text>
          </YStack>

          {/* ── Imagen capturada ─────────────────────────────────── */}
          {deteccion.imagen_uri ? (
            <YStack mx="$lg" borderRadius="$lg" overflow="hidden" style={SHADOW.md}>
              <Image
                source={{ uri: deteccion.imagen_uri }}
                style={{ width: SCREEN_WIDTH - 48, height: 250 }}
                resizeMode="cover"
              />
            </YStack>
          ) : null}

          <YStack px="$lg" gap="$md">

            {/* ── Card: Cultivo + Confianza ──────────────────────── */}
            <YStack bg={COLORS.white} borderRadius="$lg" p="$lg" style={SHADOW.sm} gap="$md">
              <XStack alignItems="center" gap="$md">
                {getIconoCultivo(deteccion.cultivo_id, 44)}
                <YStack flex={1} gap="$xs">
                  <Text fontSize={20} fontWeight="700" color="$textPrimary">
                    {deteccion.nombre_cultivo || 'Cultivo'}
                  </Text>
                  <XStack alignItems="center" gap="$xs">
                    <Text fontSize={14} color="$textMuted">
                      Certeza de la deteccion:
                    </Text>
                    <Text fontSize={16} fontWeight="700" color={colorEstado}>
                      {confianzaPct}%
                    </Text>
                  </XStack>
                </YStack>
              </XStack>
            </YStack>

            {/* ── Card: Enfermedad ───────────────────────────────── */}
            <YStack bg={COLORS.white} borderRadius="$lg" p="$lg" style={SHADOW.sm} gap="$sm">
              <XStack alignItems="center" gap="$sm">
                {esPositivo ? (
                  <AlertTriangle size={24} color={COLORS.danger} />
                ) : (
                  <CheckCircle2 size={24} color={COLORS.success} />
                )}
                <Text fontSize={18} fontWeight="700" color={esPositivo ? COLORS.danger : COLORS.success}>
                  {esPositivo ? (deteccion.nombre_enfermedad || 'Enfermedad detectada') : 'Planta sana'}
                </Text>
              </XStack>
              {esPositivo && deteccion.nivel_confianza >= 80 && (
                <YStack bg={COLORS.dangerLight} borderRadius="$sm" p="$sm" mt="$xs">
                  <Text fontSize={13} fontWeight="600" color={COLORS.danger}>
                    Nivel de riesgo alto. Se recomienda tratamiento inmediato.
                  </Text>
                </YStack>
              )}
            </YStack>

            {/* ── Card: Parcela (solo autenticados) ───────────────── */}
            {!isGuest && deteccion.parcela_alias && (
              <YStack bg={COLORS.white} borderRadius="$lg" p="$lg" style={SHADOW.sm} gap="$sm">
                <Text fontSize={14} fontWeight="600" color="$textMuted">
                  Parcela
                </Text>
                <XStack alignItems="center" gap="$sm">
                  <MapPin size={18} color={COLORS.primary} />
                  <Text fontSize={16} fontWeight="600" color="$textPrimary">
                    {deteccion.parcela_alias}
                  </Text>
                </XStack>
                {(deteccion.pin_latitud != null && deteccion.pin_longitud != null) && (
                  <Text fontSize={14} color="$textSecondary">
                    {`Ubicacion del pin: ${Number(deteccion.pin_latitud).toFixed(4)}, ${Number(deteccion.pin_longitud).toFixed(4)}`}
                  </Text>
                )}
              </YStack>
            )}

            {/* ── Card: Fecha ────────────────────────────────────── */}
            <YStack bg={COLORS.white} borderRadius="$lg" p="$lg" style={SHADOW.sm} gap="$sm">
              <Text fontSize={14} fontWeight="600" color="$textMuted">
                Fecha del analisis
              </Text>
              <Text fontSize={16} fontWeight="600" color="$textPrimary">
                {new Date(deteccion.fecha_creacion || '').toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </YStack>

            {/* ── Card: Sincronizacion (solo autenticados) ────────── */}
            {!isGuest && (
              <YStack bg={COLORS.white} borderRadius="$lg" p="$lg" style={SHADOW.sm} gap="$md">
                <XStack alignItems="center" justifyContent="space-between">
                  <XStack alignItems="center" gap="$sm">
                    {sincronizado ? (
                      <CheckCircle2 size={20} color={COLORS.success} />
                    ) : (
                      <CloudOff size={20} color={COLORS.warning} />
                    )}
                    <Text
                      fontSize={14}
                      fontWeight="600"
                      color={sincronizado ? COLORS.success : COLORS.warning}
                    >
                      {sincronizado ? 'Sincronizado en la nube' : 'Pendiente de sincronizar'}
                    </Text>
                  </XStack>
                </XStack>
                {!sincronizado && (
                  <TouchableOpacity
                    onPress={handleSync}
                    disabled={syncing}
                    activeOpacity={0.85}
                  >
                    <XStack
                      bg={COLORS.warning}
                      borderRadius="$full"
                      px="$lg"
                      py="$sm"
                      alignItems="center"
                      justifyContent="center"
                      gap="$sm"
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <RefreshCw size={16} color={COLORS.white} />
                      )}
                      <Text fontSize={14} fontWeight="700" color={COLORS.white}>
                        {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                      </Text>
                    </XStack>
                  </TouchableOpacity>
                )}
              </YStack>
            )}

          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
