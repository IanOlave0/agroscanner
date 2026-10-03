/**
 * @file src/screens/scanner/PinPlacementScreen.tsx
 * @description Pantalla de colocación de pin en parcela.
 * Vincula una detección del modelo ML a una parcela y coordenadas exactas.
 *
 * Migración UI/UX:
 * - Layout externo migrado a Tamagui (YStack, XStack, Text).
 * - Header rediseñado al patrón centrado verde + flecha volver.
 * - Icono emoji 📍 reemplazado por MapPin de Lucide.
 * - Canvas SVG interno se mantiene funcionalmente igual.
 * - Hint movido fuera del canvas como texto simple.
 *
 * @author AgroScanner Team
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { YStack, XStack, Text } from 'tamagui';
import { Svg, Line } from 'react-native-svg';
import {
  MapPin, ArrowLeft, Ruler, CheckCircle2,
} from 'lucide-react-native';

import { COLORS, SHADOW } from '../../constants';
import { RootStackParams, ResultadoML, Parcela, Usuario } from '../../types';
import {
  getParcelasByUsuario, getUsuarioActivo, insertDeteccion,
  updateCompartirDatos,
} from '../../database/queries';
import ConsentimientoModal from '../../components/ConsentimientoModal';
import { parseGeometria, puntoEnPoligono } from '../../utils/geometria';
import { useAuth } from '../../context/AuthContext';
import { randomUUID } from 'expo-crypto';

type PinPlacementNavigationProp = NativeStackNavigationProp<RootStackParams, 'PinPlacement'>;
type PinPlacementRouteProp = RouteProp<RootStackParams, 'PinPlacement'>;

type Props = {
  navigation: PinPlacementNavigationProp;
  route: PinPlacementRouteProp;
};

// Tamaño del canvas SVG (mantenido igual)
const CANVAS_SIZE = 280;

interface PinPosition {
  x: number;
  y: number;
  lat: number;
  lng: number;
}

const ENFERMEDAD_NAME_TO_ID: Record<string, number> = {
  HLB: 1,
  Sigatoka: 2,
  Shigatoka: 2,
  Araña: 3,
};

const getEnfermedadIdFromName = (name: string): number | null => {
  for (const [key, id] of Object.entries(ENFERMEDAD_NAME_TO_ID)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return id;
  }
  return null;
};

export default function PinPlacementScreen({ navigation, route }: Props) {
  const { resultado, imagenUri, cultivoId, cultivoNombre } = route.params;
  const { refreshAuth } = useAuth();
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [parcelaSeleccionada, setParcelaSeleccionada] = useState<Parcela | null>(null);
  const [pin, setPin] = useState<PinPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConsentimiento, setShowConsentimiento] = useState(false);

  useEffect(() => {
    cargarParcelas();
  }, []);

  /**
   * Carga las parcelas del usuario activo.
   */
  const cargarParcelas = async () => {
    try {
      const usuario = await getUsuarioActivo() as Usuario | null;
      if (!usuario) {
        Alert.alert(
          'Sesión requerida',
          'Para guardar detecciones, debes registrarte. ¿Deseas hacerlo ahora?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Registrarme', onPress: () => navigation.navigate('Welcome') },
          ]
        );
        return;
      }

      const lista = await getParcelasByUsuario(usuario.id);
      setParcelas(lista);

      if (lista.length === 0) {
        Alert.alert(
          'Sin parcelas',
          'Debes registrar al menos una parcela antes de hacer detecciones.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[PinPlacement] Error cargando parcelas:', error);
      Alert.alert('Error', 'No se pudieron cargar las parcelas');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Selecciona una parcela para colocar el pin.
   */
  const handleSeleccionarParcela = (p: Parcela) => {
    setParcelaSeleccionada(p);
    setPin(null);
  };

  /**
   * Maneja el tap en el canvas para colocar el pin.
   */
  const handleCanvasTap = (event: any) => {
    if (!parcelaSeleccionada) return;

    const { locationX, locationY } = event.nativeEvent;

    const vertices = parseGeometria(parcelaSeleccionada.geometria);

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    vertices.forEach(v => {
      if (v.lat < minLat) minLat = v.lat;
      if (v.lat > maxLat) maxLat = v.lat;
      if (v.lng < minLng) minLng = v.lng;
      if (v.lng > maxLng) maxLng = v.lng;
    });

    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    const padding = 20;
    const usableSize = CANVAS_SIZE - padding * 2;

    const lng = minLng + ((locationX - padding) / usableSize) * lngRange;
    const lat = minLat + ((locationY - padding) / usableSize) * latRange;

    const newPin: PinPosition = {
      x: locationX,
      y: locationY,
      lat,
      lng,
    };

    const dentro = puntoEnPoligono(vertices, { lat, lng });
    if (!dentro) {
      Alert.alert('Pin fuera de parcela', 'El pin debe estar dentro del polígono de la parcela');
      return;
    }

    setPin(newPin);
  };

  /**
   * Guarda la detección vinculada a parcela y coordenadas.
   * Si el usuario no ha definido su consentimiento de compartir datos,
   * muestra el modal de consentimiento antes de confirmar.
   */
  const handleGuardar = async () => {
    if (!parcelaSeleccionada) {
      Alert.alert('Error', 'Selecciona una parcela');
      return;
    }

    if (!pin) {
      Alert.alert('Error', 'Coloca el pin en la planta enferma');
      return;
    }

    try {
      const usuario = await getUsuarioActivo() as Usuario | null;
      if (!usuario) {
        Alert.alert('Sesión requerida', 'Debes iniciar sesión');
        return;
      }

      const enfermedadId = resultado.resultado_positivo
        ? getEnfermedadIdFromName(resultado.enfermedad)
        : null;
      const id = randomUUID();

      await insertDeteccion(
        id,
        usuario.id,
        parcelaSeleccionada.id,
        cultivoId,
        enfermedadId,
        imagenUri,
        resultado.confianza * 100,
        null,
        null,
        pin.lat,
        pin.lng
      );

      if (!usuario.compartir_datos) {
        setShowConsentimiento(true);
        return;
      }

      Alert.alert(
        'Exito',
        'Deteccion guardada correctamente',
        [{ text: 'OK', onPress: () => navigation.navigate('Home', { screen: 'Historial' } as any) }]
      );
    } catch (error) {
      console.error('[PinPlacement] Error guardando deteccion:', error);
      Alert.alert('Error', 'No se pudo guardar la deteccion');
    }
  };

  const handleConsentimientoAceptar = async () => {
    setShowConsentimiento(false);
    try {
      const usuario = await getUsuarioActivo() as Usuario | null;
      if (usuario) {
        await updateCompartirDatos(usuario.id, 1);
        await refreshAuth();
      }
    } catch (error) {
      console.error('[PinPlacement] Error guardando consentimiento:', error);
    }
    Alert.alert(
      'Gracias',
      'Tus datos ayudaran a proteger los cultivos de la region. Siempre puedes cambiar esto en tu perfil.',
      [{ text: 'OK', onPress: () => navigation.navigate('Home', { screen: 'Historial' } as any) }]
    );
  };

  const handleConsentimientoRechazar = async () => {
    setShowConsentimiento(false);
    try {
      const usuario = await getUsuarioActivo() as Usuario | null;
      if (usuario) {
        await updateCompartirDatos(usuario.id, 0);
        await refreshAuth();
      }
    } catch (error) {
      console.error('[PinPlacement] Error guardando consentimiento:', error);
    }
    Alert.alert(
      'Entendido',
      'Tus datos se quedan solo en tu telefono. Puedes activarlo cuando quieras desde tu perfil.',
      [{ text: 'OK', onPress: () => navigation.navigate('Home', { screen: 'Historial' } as any) }]
    );
  };

  /**
   * Renderiza el canvas SVG con el polígono de la parcela y el pin.
   * MANTENIDO FUNCIONALMENTE IGUAL — solo reemplaza emoji 📍 por MapPin.
   */
  const renderParcela = () => {
    if (!parcelaSeleccionada) return null;

    const vertices = parseGeometria(parcelaSeleccionada.geometria);

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    vertices.forEach(v => {
      if (v.lat < minLat) minLat = v.lat;
      if (v.lat > maxLat) maxLat = v.lat;
      if (v.lng < minLng) minLng = v.lng;
      if (v.lng > maxLng) maxLng = v.lng;
    });

    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    const padding = 20;
    const usableSize = CANVAS_SIZE - padding * 2;

    const scaled = vertices.map(v => ({
      x: padding + ((v.lng - minLng) / lngRange) * usableSize,
      y: padding + ((v.lat - minLat) / latRange) * usableSize,
    }));

    return (
      <YStack alignItems="center" gap="$sm">
        <Text fontSize={16} fontWeight="700" color="$textPrimary">
          {parcelaSeleccionada.alias}
        </Text>

        <View
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            backgroundColor: COLORS.white,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: COLORS.border,
            overflow: 'hidden',
          }}
        >
          {/* SVG del polígono */}
          <Svg
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          >
            {scaled.map((v, i) => {
              if (i === 0) return null;
              const prev = scaled[i - 1];
              return (
                <Line
                  key={`line-${i}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={v.x}
                  y2={v.y}
                  stroke={COLORS.primary}
                  strokeWidth={2}
                />
              );
            })}

            {scaled.length >= 3 && (
              <Line
                x1={scaled[scaled.length - 1].x}
                y1={scaled[scaled.length - 1].y}
                x2={scaled[0].x}
                y2={scaled[0].y}
                stroke={COLORS.primary}
                strokeWidth={2}
              />
            )}

          </Svg>

          {/* Pin icon */}
          {pin && (
            <View
              style={{
                position: 'absolute',
                left: pin.x - 12,
                top: pin.y - 24,
                alignItems: 'center',
              }}
            >
              <MapPin size={24} color={COLORS.danger} fill={COLORS.danger} />
            </View>
          )}

          {/* Overlay táctil */}
          <TouchableOpacity
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            onPress={handleCanvasTap}
          />
        </View>
      </YStack>
    );
  };

  // ── Estado de carga ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$md">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text fontSize={16} color="$textSecondary">
            Cargando parcelas...
          </Text>
        </YStack>
      </SafeAreaView>
    );
  }

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
              Ubicar Planta Enferma
            </Text>
          </YStack>

          {/* ── Card resumen análisis ────────────────────────────── */}
          <YStack
            mx="$lg"
            backgroundColor={COLORS.white}
            borderRadius="$lg"
            p="$md"
            style={SHADOW.md}
            gap="$sm"
          >
            <XStack alignItems="center" gap="$xs">
              <CheckCircle2 size={18} color={COLORS.primary} />
                <Text fontSize={16} fontWeight="700" color={COLORS.textPrimary}>
                Resultado del análisis
              </Text>
            </XStack>
            <Text fontSize={14} color={COLORS.textSecondary}>
              Enfermedad: {resultado.enfermedad}
            </Text>
            <Text fontSize={14} color={COLORS.textSecondary}>
              Confianza: {(resultado.confianza * 100).toFixed(1)}%
            </Text>
          </YStack>

          {/* ... (El resto de tu código del Canvas y el Botón sigue igual, 
              solo asegúrate de cambiar los color="$textPrimary" a color={COLORS.textPrimary}) ... */}

          {/* ── Selección de parcela ─────────────────────────────── */}
          <YStack px="$lg" gap="$md">
            <Text fontSize={18} fontWeight="700" color="$textPrimary">
              1. Selecciona la parcela
            </Text>

            {parcelas.length === 0 ? (
              <Text fontSize={16} color="$textMuted" textAlign="center" py="$xl">
                No tienes parcelas registradas
              </Text>
            ) : (
              <YStack gap="$md">
                {parcelas.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleSeleccionarParcela(item)}
                    activeOpacity={0.85}
                  >
                    <YStack
                      width="100%"
                      bg="$white"
                      p="$md"
                      borderRadius="$md"
                      borderWidth={2}
                      borderColor={parcelaSeleccionada?.id === item.id ? COLORS.primary : COLORS.border}
                      style={parcelaSeleccionada?.id === item.id ? { backgroundColor: COLORS.primary + '10' } : undefined}
                      gap="$xs"
                    >
                      <Text
                        fontSize={16}
                        fontWeight="700"
                        color="$textPrimary"
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.alias}
                      </Text>
                      <XStack alignItems="center" gap="$xs">
                        <Ruler size={14} color={COLORS.textSecondary} />
                        <Text fontSize={14} color="$textSecondary">
                          {item.metros_cuadrados.toFixed(0)} m²
                        </Text>
                      </XStack>
                    </YStack>
                  </TouchableOpacity>
                ))}
              </YStack>
            )}
          </YStack>

          {/* ── Canvas con pin ───────────────────────────────────── */}
          {parcelaSeleccionada && (
            <YStack px="$lg" gap="$md">
              <Text fontSize={18} fontWeight="700" color="$textPrimary">
                2. Coloca el pin en la planta
              </Text>
              <Text fontSize={14} color="$textMuted">
                Toca dentro del polígono para colocar el pin
              </Text>
              {renderParcela()}
            </YStack>
          )}

          {/* ── Botón guardar ────────────────────────────────────── */}
          <YStack px="$lg">
            <TouchableOpacity
              onPress={handleGuardar}
              disabled={!parcelaSeleccionada || !pin}
              activeOpacity={0.85}
            >
              <YStack
                bg={(!parcelaSeleccionada || !pin) ? COLORS.textMuted : COLORS.primary}
                py="$md"
                borderRadius="$lg"
                alignItems="center"
              >
                <Text fontSize={16} fontWeight="700" color="$white">
                  Guardar Detección
                </Text>
              </YStack>
            </TouchableOpacity>
          </YStack>

        </YStack>
      </ScrollView>

      <ConsentimientoModal
        visible={showConsentimiento}
        onAccept={handleConsentimientoAceptar}
        onDecline={handleConsentimientoRechazar}
      />
    </SafeAreaView>
  );
}
