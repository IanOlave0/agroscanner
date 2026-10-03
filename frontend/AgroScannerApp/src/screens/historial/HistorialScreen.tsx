/**
 * @file src/screens/historial/HistorialScreen.tsx
 * @description Pantalla de historial de detecciones.
 * Muestra el listado de escaneos previos con filtro por cultivo,
 * consultando la base de datos real via getDeteccionesByUsuario.
 *
 * Migracion UI/UX:
 * - Layout reemplazado de View/StyleSheet a stacks de Tamagui (YStack, XStack).
 * - Iconos de emojis migrados a vectoriales de Lucide React Native.
 * - Iconos de cultivos reemplazados por componentes SVG vectoriales.
 *
 * @author AgroScanner Team
 */

import React, { useState } from 'react';
import {
  ScrollView, StatusBar, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { YStack, XStack, Text } from 'tamagui';
import {
  CloudOff, Sprout, CheckCircle2, AlertTriangle, UserPlus, RefreshCw,
} from 'lucide-react-native';

import { COLORS } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { getDeteccionesByUsuario } from '../../database/queries';
import { Deteccion, RootStackParams } from '../../types';
import { LimonIcon, PapayaIcon, PlatanoIcon } from '../../components/icons';
import { pushPendingData } from '../../sync/SyncManager';

const FILTROS = ['Todos', 'Limon', 'Papaya', 'Platano'];
const FILTRO_MAPA: Record<string, number> = { Limon: 1, Papaya: 2, Platano: 3 };

const HistorialScreen = () => {
  const { usuarioId, estado, usuario } = useAuth();
  const isGuest = estado === 'guest';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [detecciones, setDetecciones] = useState<Deteccion[]>([]);
  const [filtroActivo, setFiltroActivo] = useState('Todos');
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      cargarDetecciones();
    }, [usuarioId]),
  );

  const cargarDetecciones = async () => {
    try {
      const lista = await getDeteccionesByUsuario(usuarioId);
      setDetecciones(lista);
    } catch (error) {
      console.error('[HistorialScreen] Error cargando detecciones:', error);
    }
  };

  const deteccionesFiltradas = detecciones.filter(d => {
    if (filtroActivo === 'Todos') return true;
    return d.cultivo_id === FILTRO_MAPA[filtroActivo];
  });

  const getIconoCultivo = (id: number, size: number) => {
    switch (id) {
      case 1: return <LimonIcon width={size} height={size} />;
      case 2: return <PapayaIcon width={size} height={size} />;
      case 3: return <PlatanoIcon width={size} height={size} />;
      default: return null;
    }
  };

  const hayPendientes = usuario?.compartir_datos && detecciones.some(d => !d.sincronizado);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack pb="$xxl">

          {/* Header */}
          <YStack px="$lg" pt="$xl" pb="$md" gap="$xs">
            <Text fontSize={28} fontWeight="800" color="$textPrimary">
              Historial
            </Text>
            <Text fontSize={16} color="$textSecondary">
              {deteccionesFiltradas.length} escaneos registrados
            </Text>
          </YStack>

          {/* ── Banner: cuenta requerida (invitado) ──────────────── */}
          {isGuest && (
            <YStack mx="$lg" bg="$primaryBg" borderRadius="$lg" p="$md" gap="$sm" mb="$md" borderWidth={1} borderColor="$primaryLight">
              <XStack alignItems="center" gap="$sm">
                <UserPlus size={20} color={COLORS.primary} />
                <Text fontSize={15} fontWeight="700" color="$primary">
                  Guarda tus escaneos en la nube
                </Text>
              </XStack>
              <Text fontSize={13} color="$textSecondary" lineHeight={18}>
                Crea una cuenta para sincronizar tus detecciones entre dispositivos y acceder a mapas de calor de tus parcelas.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Registro')}
                activeOpacity={0.85}
              >
                <YStack
                  alignSelf="flex-start"
                  bg="$primary"
                  borderRadius="$full"
                  px="$lg"
                  py="$sm"
                  mt="$xs"
                >
                  <Text fontSize={14} fontWeight="700" color="$white">
                    Crear cuenta
                  </Text>
                </YStack>
              </TouchableOpacity>
            </YStack>
          )}

          {/* Banner: sin sincronizar */}
          {hayPendientes && (
            <YStack mx="$lg" bg="#FFF9C4" borderRadius="$md" p="$md" gap="$sm" mb="$md" borderWidth={1} borderColor="$warning">
              <XStack alignItems="center" gap="$md">
                <CloudOff size={24} color={COLORS.warning} />
                <YStack flex={1}>
                  <Text fontSize={14} fontWeight="700" color="#856404">
                    Tienes escaneos sin sincronizar
                  </Text>
                  <Text fontSize={12} color="$textSecondary">
                    Se subiran automaticamente cuando tengas internet
                  </Text>
                </YStack>
              </XStack>
              <TouchableOpacity
                onPress={async () => {
                  setSyncing(true);
                  await pushPendingData();
                  await cargarDetecciones();
                  setSyncing(false);
                }}
                disabled={syncing}
                activeOpacity={0.85}
              >
                <XStack
                  alignSelf="flex-end"
                  bg="#856404"
                  borderRadius="$full"
                  px="$lg"
                  py="$sm"
                  gap="$sm"
                  alignItems="center"
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <RefreshCw size={14} color={COLORS.white} />
                  )}
                  <Text fontSize={13} fontWeight="700" color={COLORS.white}>
                    {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                  </Text>
                </XStack>
              </TouchableOpacity>
            </YStack>
          )}

          {/* Filtros */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack px="$lg" gap="$sm" pb="$md">
              {FILTROS.map(filtro => (
                <TouchableOpacity
                  key={filtro}
                  onPress={() => setFiltroActivo(filtro)}
                  activeOpacity={0.85}
                >
                  <YStack
                    px="$md"
                    py="$sm"
                    borderRadius="$full"
                    bg={filtroActivo === filtro ? '$primary' : '$bgCard'}
                    borderWidth={1.5}
                    borderColor={filtroActivo === filtro ? '$primary' : '$border'}
                  >
                    <Text
                      fontSize={14}
                      fontWeight="600"
                      color={filtroActivo === filtro ? '$white' : '$textSecondary'}
                    >
                      {filtro}
                    </Text>
                  </YStack>
                </TouchableOpacity>
              ))}
            </XStack>
          </ScrollView>

          {/* Lista de detecciones */}
          <YStack px="$lg" gap="$md">
            {deteccionesFiltradas.length === 0 ? (
              <YStack alignItems="center" pt="$xxl" gap="$md">
                <Sprout size={56} color={COLORS.primaryLight} />
                <Text fontSize={22} fontWeight="700" color="$textSecondary">
                  Sin escaneos aun
                </Text>
                <Text fontSize={16} color="$textMuted" textAlign="center">
                  Tus detecciones apareceran aqui
                </Text>
              </YStack>
            ) : (
              deteccionesFiltradas.map(deteccion => (
                <TouchableOpacity
                  key={deteccion.id}
                  onPress={() => navigation.navigate('DeteccionDetalle', { deteccionId: deteccion.id })}
                  activeOpacity={0.85}
                >
                  <TarjetaDeteccion
                    deteccion={deteccion}
                    getIconoCultivo={getIconoCultivo}
                  />
                </TouchableOpacity>
              ))
            )}
          </YStack>

        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Subcomponente: Tarjeta de deteccion ────────────────────────────
const TarjetaDeteccion = ({
  deteccion,
  getIconoCultivo,
}: {
  deteccion: Deteccion;
  getIconoCultivo: (id: number, size: number) => React.ReactNode;
}) => {
  const confianzaPct = Math.round(deteccion.nivel_confianza);
  const esPositivo = !!deteccion.enfermedad_id;
  const colorResultado = esPositivo ? COLORS.danger : COLORS.success;

  const formatFechaRelativa = (fechaStr: string) => {
    const isoStr = fechaStr.includes('T') ? fechaStr : fechaStr.replace(' ', 'T') + 'Z';
    const fecha = new Date(isoStr);
    const ahora = new Date();
    const diffMs = Math.max(0, ahora.getTime() - fecha.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMins / 60);
    const diffDias = Math.floor(diffHoras / 24);

    const fechaAbsoluta = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

    if (diffDias < 1 && diffMins >= 60) return `${fechaAbsoluta} · hace ${diffHoras}h`;
    if (diffDias < 1) return `${fechaAbsoluta} · hoy`;
    if (diffDias < 7) return `${fechaAbsoluta} · hace ${diffDias}d`;
    return fechaAbsoluta;
  };

  return (
    <XStack bg="$bgCard" borderRadius="$lg" overflow="hidden" borderWidth={1} borderColor="$border" style={{ elevation: 2 }}>
      <YStack width={5} bg={colorResultado} />

      <YStack flex={1} p="$md" gap="$sm">
        <XStack alignItems="center" gap="$sm">
          {getIconoCultivo(deteccion.cultivo_id, 32)}
          <YStack flex={1}>
            <Text fontSize={16} fontWeight="700" color="$textPrimary">
              {deteccion.nombre_cultivo || 'Cultivo'}
            </Text>
            <Text fontSize={12} color="$textMuted">
              {formatFechaRelativa(deteccion.fecha_creacion || '')}
            </Text>
          </YStack>
          <XStack alignItems="center" gap="$xs" px="$sm" py={4} borderRadius="$full" bg={colorResultado + '20'}>
            {esPositivo ? (
              <AlertTriangle size={14} color={colorResultado} />
            ) : (
              <CheckCircle2 size={14} color={colorResultado} />
            )}
            <Text fontSize={12} fontWeight="700" color={colorResultado}>
              {esPositivo ? 'Enfermedad' : 'Sana'}
            </Text>
          </XStack>
        </XStack>

        <YStack gap="$xs">
          {esPositivo && (
            <Text fontSize={14} fontWeight="600" color="$danger">
              {deteccion.nombre_enfermedad || 'Enfermedad detectada'}
            </Text>
          )}
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={12} color="$textMuted">
              Certeza: {confianzaPct}%
            </Text>
            <XStack alignItems="center" gap={4}>
              <YStack width={8} height={8} borderRadius="$full" bg={deteccion.sincronizado ? '$success' : '$warning'} />
              <Text fontSize={12} color="$textMuted">
                {deteccion.sincronizado ? 'Sincronizado' : 'Pendiente'}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      </YStack>
    </XStack>
  );
};

export default HistorialScreen;
