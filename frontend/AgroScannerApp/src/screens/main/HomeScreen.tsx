/**
 * @file src/screens/main/HomeScreen.tsx
 * @description Pantalla principal (Home) - Panel de control del agricultor.
 * Muestra parcelas registradas, detecciones recientes con nivel de riesgo
 * y accesos rápidos a funciones principales.
 *
 * Migración UI/UX:
 * - Layout reemplazado de View/StyleSheet a stacks de Tamagui (YStack, XStack).
 * - Tipografía utiliza tokens de color de Tamagui; fontSize usa valores numéricos
 *   (compatibilidad con Tamagui v3 RC).
 * - Iconos de emojis migrados a vectoriales de Lucide React Native.
 * - ScrollView de RN se mantiene (Tamagui no expone ScrollView nativo estable).
 *
 * @author AgroScanner Team
 */

import React, { useState, useEffect } from 'react';
import {
  ScrollView, StatusBar, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { YStack, XStack, Text } from 'tamagui';
import {
  User, WifiOff, Sprout, MapPin, ChevronRight,
  CheckCircle2, AlertCircle, AlertTriangle,
  SearchX, ClipboardList, Map as MapIcon,
  ShieldAlert,
} from 'lucide-react-native';

import { COLORS, SHADOW } from '../../constants';
import { getParcelasByUsuario, getDeteccionesByUsuario, updateCompartirDatos } from '../../database/queries';
import { Parcela, Deteccion, RootStackParams } from '../../types';
import { formatearArea, parseGeometria } from '../../utils/geometria';
import { useAuth } from '../../context/AuthContext';
import ConsentimientoModal from '../../components/ConsentimientoModal';

// ── Tipos de navegación ────────────────────────────────────────────
type TabParams = {
  Home: undefined;
  Scanner: undefined;
  Historial: undefined;
  Mapa: undefined;
  Perfil: undefined;
};

// ── Componente principal ───────────────────────────────────────────
const HomeScreen = () => {
  const navigation = useNavigation<BottomTabNavigationProp<TabParams>>();
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { estado, usuarioId, usuario, refreshAuth } = useAuth();
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [detecciones, setDetecciones] = useState<Deteccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConsentimiento, setShowConsentimiento] = useState(false);

  const esInvitado = estado === 'guest';

  useFocusEffect(
    React.useCallback(() => {
      cargarDatos();
    }, [usuarioId])
  );

  const cargarDatos = async () => {
    try {
      if (esInvitado) {
        setParcelas([]);
        setDetecciones([]);
        return;
      }

      const [listaParcelas, listaDetecciones] = await Promise.all([
        getParcelasByUsuario(usuarioId),
        getDeteccionesByUsuario(usuarioId),
      ]);

      setParcelas(listaParcelas);
      setDetecciones(listaDetecciones);
    } catch (error) {
      console.error('[HomeScreen] Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIrAGestionParcelas = () => {
    stackNavigation.navigate('ParcelaGestion');
  };

  const handleEditarParcela = (id: string) => {
    stackNavigation.navigate('ParcelaCanvas', { parcelaId: id });
  };

  // ── Efecto Typewriter para el nombre del usuario ───────────────────
  const [displayedNombre, setDisplayedNombre] = useState('');

  useEffect(() => {
    const nombreCompleto = usuario?.nombre || 'Invitado';
    setDisplayedNombre('');
    let index = 0;

    const interval = setInterval(() => {
      if (index < nombreCompleto.length) {
        setDisplayedNombre(nombreCompleto.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [usuario?.nombre]);

  const parcelasVisibles = parcelas.slice(0, 3);
  const deteccionesRecientes = detecciones.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack px="$lg" pt="$md" pb="$xxl" gap="$md">

          {/* ── Header: saludo typewriter + acceso a perfil ──────── */}
          <XStack justifyContent="space-between" alignItems="flex-start" mb="$xs">
            <YStack flex={1}>
              <Text fontSize={16} color="$textSecondary">
                Bienvenido,
              </Text>
              <Text fontSize={28} fontWeight="800" color="$textPrimary" lineHeight={36} mt="$xs">
                {displayedNombre}
                <Text fontSize={28} fontWeight="800" color="$primary">
                  {'|'}
                </Text>
              </Text>
            </YStack>
            <TouchableOpacity onPress={() => navigation.navigate('Perfil')} activeOpacity={0.7}>
              <YStack alignItems="center" gap={2}>
                <YStack width={48} height={48} borderRadius="$full" bg="$bgGreen" borderWidth={2} borderColor="$primary" alignItems="center" justifyContent="center">
                  <User size={22} color={COLORS.primary} />
                </YStack>
                <Text fontSize={10} fontWeight="600" color="$primary">
                  Mi perfil
                </Text>
              </YStack>
            </TouchableOpacity>
          </XStack>

          {/* ── Banner: modo sin conexión ────────────────────────── */}
          <XStack alignItems="center" bg="$bgGreen" borderRadius="$md" p="$md" gap="$md" borderWidth={1} borderColor="$primaryLight">
            <WifiOff size={28} color={COLORS.primary} />
            <YStack flex={1}>
              <Text fontSize={16} fontWeight="600" color="$primary">
                Modo sin conexion disponible
              </Text>
              <Text fontSize={14} color="$textSecondary">
                Funciona directo en tu celular, sin internet
              </Text>
            </YStack>
          </XStack>

          {/* ── Banner: recordatorio de consentimiento ────────────── */}
          {!esInvitado && usuario && !usuario.compartir_datos && (
            <TouchableOpacity onPress={() => setShowConsentimiento(true)} activeOpacity={0.85}>
              <XStack
                alignItems="center"
                bg={COLORS.acentoLight}
                borderRadius="$md"
                p="$md"
                gap="$md"
                borderWidth={1}
                borderColor={COLORS.acento}
              >
                <ShieldAlert size={24} color={COLORS.acentoDark} />
                <YStack flex={1}>
                  <Text fontSize={14} fontWeight="700" color={COLORS.acentoDark}>
                    Tus detecciones pueden alertar a otros productores sobre plagas
                  </Text>
                  <Text fontSize={12} color={COLORS.textSecondary} mt={2}>
                    Cuando quieras, puedes activarlo tocando aqui.
                  </Text>
                </YStack>
              </XStack>
            </TouchableOpacity>
          )}

          {/* ── Panel: Mis Parcelas ──────────────────────────────── */}
          <YStack bg="$white" borderRadius="$lg" overflow="hidden" style={SHADOW.md}>
            {/* Cabecera del panel */}
            <TouchableOpacity onPress={handleIrAGestionParcelas} activeOpacity={0.7}>
              <XStack alignItems="center" justifyContent="space-between" bg="$primary" py="$md" px="$lg">
                <XStack alignItems="center" gap="$sm">
                  <Sprout size={20} color={COLORS.white} />
                  <Text fontSize={16} fontWeight="600" color="$white">
                    Mis Parcelas
                  </Text>
                </XStack>
                <ChevronRight size={20} color={COLORS.white} />
              </XStack>
            </TouchableOpacity>

            {/* Contenido: lista o vacío */}
            {parcelas.length === 0 ? (
              <YStack p="$lg" alignItems="center" bg="$bgPrimary" gap="$xs">
                <Text fontSize={14} color="$textMuted">
                  Sin parcelas registradas
                </Text>
                <Text fontSize={12} color="$textMuted" textAlign="center">
                  Toca "Mis Parcelas" para crear tu primera parcela
                </Text>
              </YStack>
            ) : (
              <>
                {parcelasVisibles.map((parcela) => (
                  <ParcelaRow
                    key={parcela.id}
                    parcela={parcela}
                    onPress={() => handleEditarParcela(parcela.id)}
                  />
                ))}
              </>
            )}
          </YStack>

          {/* ── Sección: Detecciones recientes ───────────────────── */}
          {deteccionesRecientes.length > 0 ? (
            <>
              <Text fontSize={18} fontWeight="700" color="$textPrimary" mt="$xs">
                Detecciones recientes
              </Text>
              <YStack gap="$sm">
                {deteccionesRecientes.map((deteccion) => (
                  <DeteccionCard key={deteccion.id} deteccion={deteccion} />
                ))}
              </YStack>
            </>
          ) : (
            <YStack bg="$white" borderRadius="$lg" p="$lg" alignItems="center" gap="$sm">
              <SearchX size={40} color={COLORS.textMuted} />
              <Text fontSize={14} color="$textSecondary" textAlign="center">
                Sin detecciones aún. Ve a "Escanear" para comenzar.
              </Text>
            </YStack>
          )}

          {/* ── Sección: Acceso rápido ───────────────────────────── */}
          <Text fontSize={18} fontWeight="700" color="$textPrimary" mt="$xs">
            Acceso rápido
          </Text>
          <XStack gap="$sm">
            <AccesoRapidoBtn
              icon={ClipboardList}
              label="Ver historial"
              onPress={() => navigation.navigate('Historial')}
            />
            <AccesoRapidoBtn
              icon={MapIcon}
              label="Mapa de calor"
              onPress={() => navigation.navigate('Mapa')}
            />
          </XStack>

        </YStack>
      </ScrollView>

      <ConsentimientoModal
        visible={showConsentimiento}
        onAccept={async () => {
          setShowConsentimiento(false);
          try {
            await updateCompartirDatos(usuarioId, 1);
            await refreshAuth();
            setDetecciones([]);
            setParcelas([]);
            await cargarDatos();
          } catch (error) {
            console.error('[HomeScreen] Error guardando consentimiento:', error);
          }
        }}
        onDecline={async () => {
          setShowConsentimiento(false);
          try {
            await updateCompartirDatos(usuarioId, 0);
            await refreshAuth();
            setDetecciones([]);
            setParcelas([]);
            await cargarDatos();
          } catch (error) {
            console.error('[HomeScreen] Error guardando consentimiento:', error);
          }
        }}
      />
    </SafeAreaView>
  );
};

// ── Subcomponente: Fila de parcela ─────────────────────────────────
/**
 * Renderiza una fila de parcela con ícono, alias, metadatos y flecha.
 *
 * @param parcela  Datos de la parcela a mostrar.
 * @param onPress  Handler al tocar la fila.
 */
const ParcelaRow = ({ parcela, onPress }: { parcela: Parcela; onPress: () => void }) => {
  const vertices = parseGeometria(parcela.geometria);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <XStack alignItems="center" bg="$bgPrimary" p="$md" gap="$sm" borderBottomWidth={1} borderBottomColor="$border">
        <YStack width={36} height={36} borderRadius="$md" bg="$bgGreen" alignItems="center" justifyContent="center">
          <MapPin size={18} color={COLORS.primary} />
        </YStack>
        <YStack flex={1}>
          <Text fontSize={16} fontWeight="600" color="$textPrimary">
            {parcela.alias}
          </Text>
          <Text fontSize={14} color="$textSecondary" mt={2}>
            {vertices.length} vértices · {formatearArea(parcela.metros_cuadrados)}
          </Text>
        </YStack>
        <ChevronRight size={20} color={COLORS.textMuted} />
      </XStack>
    </TouchableOpacity>
  );
};

// ── Subcomponente: Card de detección ───────────────────────────────
/**
 * Renderiza una card de detección reciente con nivel de riesgo visual.
 *
 * @param deteccion  Datos de la detección a mostrar.
 */
const DeteccionCard = ({ deteccion }: { deteccion: Deteccion }) => {
  const { icon: RiesgoIcon, color: riesgoColor, texto: riesgoTexto } = getNivelRiesgoMeta(deteccion);

  /**
   * Formatea una fecha combinando fecha absoluta + tiempo relativo.
   * Ej: "15 may 2026 · hoy", "12 may 2026 · hace 3d", "1 ene 2026".
   */
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
    <XStack alignItems="center" bg="$white" borderRadius="$md" p="$md" gap="$md">
      <YStack flex={1} gap={2}>
        <Text fontSize={16} fontWeight="600" color="$textPrimary">
          {deteccion.enfermedad_id
            ? deteccion.nombre_enfermedad || 'Enfermedad detectada'
            : 'Sano'}
        </Text>
        <Text fontSize={14} color="$textSecondary">
          {deteccion.nombre_cultivo || 'Cultivo'} • {deteccion.parcela_alias || 'Sin parcela'}
        </Text>
      </YStack>
      <YStack alignItems="flex-end" gap={4}>
        <RiesgoIcon size={18} color={riesgoColor} />
        <Text fontSize={12} color="$textMuted">
          {formatFechaRelativa(deteccion.fecha_creacion || '')}
        </Text>
        <Text fontSize={11} fontWeight="600" color={riesgoColor}>
          {riesgoTexto}
        </Text>
      </YStack>
    </XStack>
  );
};

// ── Subcomponente: Botón de acceso rápido ──────────────────────────
/**
 * Botón cuadrado para acceso rápido a funciones principales.
 *
 * @param icon    Componente de ícono de lucide-react-native.
 * @param label   Texto descriptivo.
 * @param onPress Handler al tocar.
 */
const AccesoRapidoBtn = ({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flex: 1 }}>
    <YStack flex={1} bg="$white" borderRadius="$lg" p="$md" alignItems="center" gap="$sm" borderWidth={1} borderColor="$border">
      <Icon size={32} color={COLORS.primary} />
      <Text fontSize={14} fontWeight="600" color="$textSecondary" textAlign="center">
        {label}
      </Text>
    </YStack>
  </TouchableOpacity>
);

// ── Utilidad: Metadatos de nivel de riesgo ─────────────────────────
/**
 * Determina el ícono, color y texto del badge de riesgo según la detección.
 *
 * @param deteccion Registro de detección a evaluar.
 * @returns Objeto con icono Lucide, color HEX y texto descriptivo.
 */
const getNivelRiesgoMeta = (deteccion: Deteccion) => {
  if (!deteccion.enfermedad_id) {
    return { icon: CheckCircle2, color: COLORS.semaforoVerde, texto: 'Sano' };
  }
  if (deteccion.nivel_confianza >= 80) {
    return { icon: AlertCircle, color: COLORS.semaforoRojo, texto: 'Alto' };
  }
  return { icon: AlertTriangle, color: COLORS.semaforoAmarillo, texto: 'Medio' };
};

export default HomeScreen;
