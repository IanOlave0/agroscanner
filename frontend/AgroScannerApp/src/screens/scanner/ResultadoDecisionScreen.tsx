/**
 * @file src/screens/scanner/ResultadoDecisionScreen.tsx
 * @description Pantalla de decisión post-resultado.
 * Bifurca el flujo según el contexto del usuario:
 * - SIN CUENTA: Muestra resultado + CTA para registrarse
 * - CON CUENTA + SIN PARCELAS: Prompt para crear parcela
 * - CON CUENTA + CON PARCELAS: Auto-navega a PinPlacementScreen
 *
 * Migración UI/UX:
 * - Header tipo ticket con muescas laterales, versión compacta.
 * - Iconos animados (pulse/bounce) según estado del flujo.
 * - Layout en stacks de Tamagui (YStack, XStack).
 *
 * @author AgroScanner Team
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { YStack, XStack, Text } from 'tamagui';
import { MapPin, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';

import { COLORS, SHADOW } from '../../constants';
import { RootStackParams } from '../../types';
import { getUsuarioActivo, getParcelasByUsuario, insertDeteccion } from '../../database/queries';
import { Usuario } from '../../types';

type ResultadoDecisionNavigationProp = NativeStackNavigationProp<RootStackParams, 'ResultadoDecision'>;
type ResultadoDecisionRouteProp = RouteProp<RootStackParams, 'ResultadoDecision'>;

type Props = {
  navigation: ResultadoDecisionNavigationProp;
  route: ResultadoDecisionRouteProp;
};

// ── Icono con animación pulse (lateo) ────────────────────────────────
const AnimatedPulseIcon = ({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
};

// ── Icono con animación bounce (rebote Y) ────────────────────────────
const AnimatedBounceIcon = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -10, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0,   duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

// ── Mapeo nombre de enfermedad → ID en catalogo ────────────────────
const ENFERMEDAD_NAME_TO_ID: Record<string, number> = {
  HLB: 1,
  Sigatoka: 2,
  Shigatoka: 2,
  Araña: 3,
};

/**
 * Obtiene el ID de enfermedad a partir del nombre detectado por la IA.
 * Realiza busqueda por inclusion parcial (case-insensitive).
 *
 * @param name  Nombre de la enfermedad detectada
 * @returns ID numerico de la enfermedad o null si no coincide
 */
const getEnfermedadIdFromName = (name: string): number | null => {
  for (const [key, id] of Object.entries(ENFERMEDAD_NAME_TO_ID)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return id;
  }
  return null;
};

export default function ResultadoDecisionScreen({ navigation, route }: Props) {
  const { resultado, imagenUri, cultivoId, cultivoNombre } = route.params;

  const [loading, setLoading] = useState(true);
  const [flujo, setFlujo] = useState<'sin_cuenta' | 'sin_parcelas' | 'con_parcelas' | null>(null);
  const [deteccionGuardada, setDeteccionGuardada] = useState(false);

  const confianzaPct = (resultado.confianza * 100).toFixed(0);
  const esPositivo = resultado.resultado_positivo;
  const colorHeader = esPositivo ? COLORS.danger : COLORS.success;
  const IconoResultado = esPositivo ? AlertTriangle : CheckCircle2;
  const textoHeader = esPositivo ? 'Probabilidad de infección' : 'Planta sana';

  useEffect(() => {
    verificarContexto();
  }, []);

  /**
   * Navegación post-render para el flujo con parcelas.
   * Se ejecuta en un efecto para evitar mutaciones durante el render.
   */
  useEffect(() => {
    if (flujo === 'con_parcelas') {
      navigation.replace('PinPlacement', {
        resultado,
        imagenUri,
        cultivoId,
        cultivoNombre,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flujo]);

  /**
   * Verifica el contexto del usuario y determina el flujo apropiado.
   */
  const verificarContexto = async () => {
    try {
      const user = await getUsuarioActivo() as Usuario | null;

      if (!user || !user.token) {
        setFlujo('sin_cuenta');
      } else {
        const parcelas = await getParcelasByUsuario(user.id);
        if (parcelas.length > 0) {
          setFlujo('con_parcelas');
        } else {
          setFlujo('sin_parcelas');
        }
      }
    } catch (error) {
      console.error('[ResultadoDecision] Error verificando contexto:', error);
      setFlujo('sin_cuenta');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Guarda la deteccion actual como usuario invitado.
   * Utiliza la parcela por defecto del invitado (guest-parcela)
   * y coordenadas de pin neutras (0, 0) ya que el invitado
   * no tiene parcelas reales registradas.
   */
  const guardarDeteccionInvitado = async () => {
    try {
      const enfermedadId = resultado.resultado_positivo
        ? getEnfermedadIdFromName(resultado.enfermedad)
        : null;
      const id = randomUUID();

      await insertDeteccion(
        id,
        'guest',
        'guest-parcela',
        cultivoId,
        enfermedadId,
        imagenUri,
        resultado.confianza * 100,
        null,
        null,
        0,
        0,
      );

      console.log('[ResultadoDecision] Deteccion de invitado guardada:', id);
      setDeteccionGuardada(true);
    } catch (error) {
      console.error('[ResultadoDecision] Error guardando deteccion de invitado:', error);
    }
  };

  useEffect(() => {
    if (flujo === 'sin_cuenta' && !deteccionGuardada) {
      guardarDeteccionInvitado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flujo]);

  // ── Estado de carga ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgPrimary }} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text fontSize={16} color="$textSecondary" mt="$md">
          Verificando tu cuenta...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$lg" pt="$lg" pb="$xxl">

          {/* ── Header tipo ticket compacto ──────────────────────── */}
          <YStack mx="$lg" alignItems="center" justifyContent="center">
            <YStack
              bg={colorHeader}
              p="$lg"
              alignItems="center"
              gap="$sm"
              borderRadius="$2xl"
              width="100%"
              style={SHADOW.lg}
            >
              {/* Icono indicador dinámico — compacto */}
              <IconoResultado size={32} color={COLORS.white} />

              {/* Título secundario */}
              <Text fontSize={14} fontWeight="600" color="rgba(255,255,255,0.7)">
                Resultado del Análisis
              </Text>

              {/* Porcentaje dominante — compacto */}
              <Text fontSize={40} fontWeight="800" color="$white">
                {confianzaPct}%
              </Text>

              {/* Subtítulo contextual */}
              <Text fontSize={14} fontWeight="500" color="rgba(255,255,255,0.9)">
                {textoHeader}
              </Text>
            </YStack>

            {/* Muesca izquierda tipo ticket */}
            <YStack position="absolute" left={-10} top="50%" marginTop={-14}>
              <YStack width={20} height={28} bg={COLORS.bgPrimary} borderRadius={999} />
            </YStack>

            {/* Muesca derecha tipo ticket */}
            <YStack position="absolute" right={-10} top="50%" marginTop={-14}>
              <YStack width={20} height={28} bg={COLORS.bgPrimary} borderRadius={999} />
            </YStack>
          </YStack>

          {/* ── Contenido ────────────────────────────────────────── */}
          <YStack px="$lg" gap="$lg">

            {/* Card de detección */}
            <YStack bg="$white" borderRadius="$lg" p="$lg" style={SHADOW.md}>
              <Text fontSize={14} color="$textMuted" mb={4}>
                {esPositivo ? 'Enfermedad detectada:' : 'Detección:'}
              </Text>
              <Text fontSize={22} fontWeight="700" color={colorHeader} mb={12}>
                {esPositivo ? resultado.enfermedad : 'Planta sana'}
              </Text>
              <YStack height={1} bg="$border" my={12} />
              <Text fontSize={14} color="$textMuted" mb={4}>
                {esPositivo ? 'Tratamiento sugerido:' : 'Recomendación preventiva:'}
              </Text>
              <Text fontSize={16} color="$textSecondary" lineHeight={22}>
                {resultado.tratamiento}
              </Text>
            </YStack>

            {/* ── Flujo: Sin cuenta ──────────────────────────────── */}
            {flujo === 'sin_cuenta' && (
              <YStack gap="$lg">
                {/* Deteccion guardada localmente */}
                <YStack
                  bg={COLORS.successLight}
                  borderRadius="$lg"
                  p="$lg"
                  borderWidth={1}
                  borderColor={COLORS.success}
                  alignItems="center"
                  gap="$sm"
                >
                  <CheckCircle2 size={32} color={COLORS.success} />
                  <Text fontSize={16} fontWeight="700" color={COLORS.success} textAlign="center">
                    Escaneo guardado localmente
                  </Text>
                  <Text fontSize={14} color="$textSecondary" textAlign="center" lineHeight={20}>
                    Crea una cuenta para sincronizar tus detecciones en la nube y ubicarlas en tus parcelas.
                  </Text>
                </YStack>

                <YStack
                  bg="$primaryBg"
                  borderRadius="$lg"
                  p="$lg"
                  borderWidth={1}
                  borderColor="$primaryLight"
                  alignItems="center"
                  gap="$sm"
                >
                  <AnimatedPulseIcon color={COLORS.primary}>
                    <UserPlus size={48} color={COLORS.primary} />
                  </AnimatedPulseIcon>

                  <Text fontSize={18} fontWeight="700" color="$textPrimary" textAlign="center">
                    ¿Quieres geolocalizar tus detecciones?
                  </Text>
                  <Text fontSize={14} color="$textSecondary" textAlign="center" lineHeight={22}>
                    Crea una cuenta para registrar tus parcelas y ubicar exactamente dónde están las plantas enfermas.
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Welcome')}
                    activeOpacity={0.85}
                  >
                    <YStack bg="$primary" py="$md" px="$xl" borderRadius="$md" mt="$sm">
                      <Text fontSize={16} fontWeight="600" color="$white">
                        Crear cuenta gratis
                      </Text>
                    </YStack>
                  </TouchableOpacity>
                </YStack>

                <TouchableOpacity onPress={() => navigation.navigate('Home')} activeOpacity={0.85}>
                  <YStack p="$md" alignItems="center">
                    <Text fontSize={16} fontWeight="600" color="$textMuted">
                      Volver al inicio
                    </Text>
                  </YStack>
                </TouchableOpacity>
              </YStack>
            )}

            {/* ── Flujo: Sin parcelas ──────────────────────────────── */}
            {flujo === 'sin_parcelas' && (
              <YStack gap="$lg">
                <YStack
                  bg="$acentoLight"
                  borderRadius="$lg"
                  p="$lg"
                  borderWidth={1}
                  borderColor="$acento"
                  alignItems="center"
                  gap="$sm"
                >
                  {/* Icono animado bounce */}
                  <AnimatedBounceIcon>
                    <MapPin size={48} color={COLORS.acento} />
                  </AnimatedBounceIcon>

                  <Text fontSize={18} fontWeight="700" color="$textPrimary" textAlign="center">
                    Necesitas registrar una parcela
                  </Text>
                  <Text fontSize={14} color="$textSecondary" textAlign="center" lineHeight={22}>
                    Para guardar esta detección con ubicación exacta, primero debes dibujar al menos una parcela en el mapa.
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ParcelaCanvas', { parcelaId: undefined })}
                    activeOpacity={0.85}
                  >
                    <YStack bg="$acento" py="$md" borderRadius="$md" alignItems="center" mt="$sm" width="100%">
                      <Text fontSize={16} fontWeight="600" color="$white">
                        Crear mi primera parcela
                      </Text>
                    </YStack>
                  </TouchableOpacity>
                </YStack>

                <TouchableOpacity onPress={() => navigation.navigate('Home')} activeOpacity={0.85}>
                  <YStack borderWidth={1} borderColor="$primary" borderRadius="$md" py="$md" alignItems="center">
                    <Text fontSize={16} fontWeight="700" color="$primary">
                      Volver al inicio
                    </Text>
                  </YStack>
                </TouchableOpacity>
              </YStack>
            )}

          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
