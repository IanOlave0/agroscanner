/**
 * @file src/screens/scanner/ResultadoScreen.tsx
 * @description Pantalla de resultado del análisis del modelo ML.
 * Muestra la enfermedad detectada, porcentaje de confianza y tratamiento sugerido.
 *
 * Migración UI/UX:
 * - Layout reemplazado de View/StyleSheet a stacks de Tamagui (YStack, XStack).
 * - Iconos de emojis migrados a vectoriales de Lucide React Native.
 *
 * @author AgroScanner Team
 */

import React from 'react';
import {
  ScrollView, StatusBar, TouchableOpacity, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { YStack, XStack, Text } from 'tamagui';
import { ClipboardList, Share2, AlertTriangle, CheckCircle2 } from 'lucide-react-native';

import { COLORS, SHADOW } from '../../constants';
import { RootStackParams } from '../../types';

type ResultadoScreenNavigationProp = NativeStackNavigationProp<RootStackParams, 'Resultado'>;

const ResultadoScreen = () => {
  const navigation = useNavigation<ResultadoScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParams, 'Resultado'>>();
  const { resultado, imagenUri, cultivoId, cultivoNombre } = route.params;

  const confianzaPct = (resultado.confianza * 100).toFixed(0);
  const esPositivo = resultado.resultado_positivo;
  const colorHeader = esPositivo ? COLORS.danger : COLORS.success;
  const IconoResultado = esPositivo ? AlertTriangle : CheckCircle2;
  const textoHeader = esPositivo ? 'Probabilidad de infección' : 'Planta sana';

  const handleCompartir = async () => {
    try {
      await Share.share({
        message: `Alerta AgroScanner: Detectado ${resultado.enfermedad} con ${confianzaPct}% de confianza.`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$lg" pt="$lg" pb="$xxl">

          {/* ── Header tipo ticket con muescas laterales ───────── */}
          <YStack mx="$lg" alignItems="center" justifyContent="center">
            <YStack
              bg={colorHeader}
              p="$xl"
              alignItems="center"
              gap="$md"
              borderRadius="$2xl"
              width="100%"
              style={SHADOW.lg}
            >
              {/* Icono indicador dinámico */}
              <IconoResultado size={48} color={COLORS.white} />

              {/* Título secundario */}
              <Text fontSize={14} fontWeight="600" color="rgba(255,255,255,0.7)">
                Resultado del Análisis
              </Text>

              {/* Porcentaje dominante */}
              <Text fontSize={56} fontWeight="800" color="$white">
                {confianzaPct}%
              </Text>

              {/* Subtítulo contextual */}
              <Text fontSize={16} fontWeight="500" color="rgba(255,255,255,0.9)">
                {textoHeader}
              </Text>

              {/* Badge con nombre de enfermedad */}
              <YStack
                mt="$sm"
                bg="rgba(255,255,255,0.2)"
                px="$lg"
                py="$sm"
                borderRadius="$full"
              >
                <Text fontSize={16} fontWeight="700" color="$white">
                  {resultado.enfermedad}
                </Text>
              </YStack>
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

            {/* Card de información */}
            <YStack bg="$white" borderRadius="$lg" p="$lg" style={SHADOW.md}>
              <Text fontSize={14} color="$textMuted" mb={4}>
                Cultivo analizado:
              </Text>
              <Text fontSize={22} fontWeight="700" color="$textPrimary">
                {cultivoNombre}
              </Text>
            </YStack>

            {/* Tratamiento sugerido */}
            <YStack gap="$sm">
              <XStack alignItems="center" gap="$sm">
                <ClipboardList size={20} color={COLORS.primary} />
                <Text fontSize={16} fontWeight="700" color="$textPrimary">
                  Tratamiento sugerido
                </Text>
              </XStack>
              <YStack
                bg="$primaryBg"
                p="$md"
                borderRadius="$md"
                borderLeftWidth={4}
                borderLeftColor="$primary"
              >
                <Text fontSize={14} color="$textSecondary" lineHeight={22}>
                  {resultado.tratamiento}
                </Text>
              </YStack>
            </YStack>

            {/* Botones de acción */}
            <YStack gap="$md" mt="$xl">
              <TouchableOpacity
                onPress={() => navigation.navigate('ResultadoDecision', { resultado, imagenUri, cultivoId, cultivoNombre })}
                activeOpacity={0.85}
              >
                <YStack bg="$primary" borderRadius="$lg" p="$md" alignItems="center">
                  <Text fontSize={16} fontWeight="700" color="$white">
                    Continuar
                  </Text>
                </YStack>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleCompartir} activeOpacity={0.85}>
                <YStack
                  borderWidth={1}
                  borderColor="$primary"
                  borderRadius="$lg"
                  p="$md"
                  alignItems="center"
                >
                  <XStack alignItems="center" gap="$sm">
                    <Share2 size={18} color={COLORS.primary} />
                    <Text fontSize={16} fontWeight="700" color="$primary">
                      Compartir reporte
                    </Text>
                  </XStack>
                </YStack>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
                <YStack p="$md" alignItems="center">
                  <Text fontSize={14} color="$textMuted">
                    Repetir escaneo
                  </Text>
                </YStack>
              </TouchableOpacity>
            </YStack>

          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ResultadoScreen;
