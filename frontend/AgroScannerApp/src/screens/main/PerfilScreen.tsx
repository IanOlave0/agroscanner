/**
 * @file src/screens/main/PerfilScreen.tsx
 * @description Pantalla de perfil del usuario.
 * Muestra información del usuario, preferencias y opciones de cuenta.
 *
 * Migración UI/UX:
 * - Layout reemplazado de View/StyleSheet a stacks de Tamagui (YStack, XStack).
 * - Iconos de emojis migrados a vectoriales de Lucide React Native.
 * - Tipografía utiliza tokens de color de Tamagui; fontSize usa valores numéricos.
 *
 * @author AgroScanner Team
 */

import React, { useState } from 'react';
import {
  Switch, ScrollView, StatusBar, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { YStack, XStack, Text } from 'tamagui';
import {
  User, UserCheck, Bell,
  Cloud, Clock, ClipboardList, Shield,
  LogOut, ChevronRight, Sprout,
} from 'lucide-react-native';

import { RootStackParams } from '../../types';
import { COLORS, SHADOW } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { updateCompartirDatos } from '../../database/queries';

const PerfilScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { usuario, estado, logout, refreshAuth } = useAuth();
  const [notificaciones, setNotificaciones] = useState(true);
  const [compartirDatos, setCompartirDatos] = useState(!!usuario?.compartir_datos);

  const isGuest = estado === 'guest';
  const nombreUsuario = usuario?.nombre || 'Invitado';
  const zonaAgricola = usuario?.zona_agricola || 'Colima, MX';

  const handleCerrarSesion = async () => {
    Alert.alert(
      'Cerrar sesion',
      'Estas seguro que deseas cerrar tu sesion?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesion',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Welcome');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack pb="$xxl" gap="$lg">

          {/* ── Header de perfil ─────────────────────────────────── */}
          <YStack alignItems="center" pt="$xxl" pb="$lg" bg="$white" borderBottomWidth={1} borderBottomColor="$border" gap="$sm">
            <YStack width={90} height={90} borderRadius="$full" bg="$bgPrimary" alignItems="center" justifyContent="center" borderWidth={3} borderColor="$primary">
            {!isGuest ? (
              <UserCheck size={44} color={COLORS.primary} />
            ) : (
              <User size={44} color={COLORS.primary} />
            )}
            </YStack>
            <Text fontSize={22} fontWeight="800" color="$textPrimary">
              {nombreUsuario}
            </Text>
            {!isGuest ? (
              <Text fontSize={16} color="$textSecondary">
                Agricultor · {zonaAgricola}
              </Text>
            ) : (
              <YStack bg="$bgPrimary" px="$md" py={4} borderRadius="$full" borderWidth={1} borderColor="$border">
                <Text fontSize={14} color="$textMuted" fontWeight="600">
                  Modo invitado
                </Text>
              </YStack>
            )}
          </YStack>

          {/* ── Banner: invitado ─────────────────────────────────── */}
          {isGuest && (
            <YStack mx="$lg" bg="$primaryBg" borderRadius="$lg" p="$lg" gap="$xs" borderWidth={1} borderColor="$primaryLight">
              <Text fontSize={16} fontWeight="700" color="$primary">
                Guarda tus escaneos
              </Text>
              <Text fontSize={14} color="$textSecondary" lineHeight={18}>
                Crea una cuenta para sincronizar tus detecciones y verlas en el mapa regional.
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Registro')} activeOpacity={0.85}>
                <YStack bg="$primary" borderRadius="$md" py="$sm" alignItems="center" mt="$sm">
                  <Text fontSize={16} fontWeight="700" color="$white">
                    Crear cuenta gratis
                  </Text>
                </YStack>
              </TouchableOpacity>
            </YStack>
          )}

          {/* ── Preferencias ─────────────────────────────────────── */}
          <SeccionMenu titulo="Preferencias">
            <ItemSwitch
              icon={Sprout}
              label="Mis datos ayudan a la comunidad"
              descripcion="Compartir detecciones de forma anonima para alertar a otros productores"
              valor={compartirDatos}
              onChange={async (v) => {
                setCompartirDatos(v);
                if (usuario?.id) {
                  await updateCompartirDatos(usuario.id, v ? 1 : 0);
                  await refreshAuth();
                }
              }}
            />
            <ItemSwitch
              icon={Bell}
              label="Notificaciones de alerta"
              valor={notificaciones}
              onChange={setNotificaciones}
            />


          </SeccionMenu>

          {/* ── Sincronización ───────────────────────────────────── */}
          <SeccionMenu titulo="Sincronización">
            <ItemMenu
              icon={Cloud}
              label="Escaneos pendientes"
              valor={isGuest ? '1 pendiente' : '0 pendientes'}
              onPress={() => {}}
            />
            <ItemMenu
              icon={Clock}
              label="Última sincronización"
              valor="Hace 2 horas"
              onPress={() => {}}
            />
          </SeccionMenu>

          {/* ── Información ──────────────────────────────────────── */}
          <SeccionMenu titulo="Información">
            <ItemMenu
              icon={ClipboardList}
              label="Modelo de detección"
              valor="En desarrollo (demo)"
              onPress={() => {}}
            />
            <ItemMenu
              icon={Shield}
              label="Política de privacidad"
              onPress={() => {}}
            />
          </SeccionMenu>

          {/* ── Créditos ─────────────────────────────────────────── */}
          <YStack alignItems="center" gap={4} py="$md">
            <Text fontSize={12} color="$textMuted" textAlign="center">
              Ian Olave · Carlos Ramírez · José Negrete · Andrew Ceja · Daria Vázquez
            </Text>
            <Text fontSize={12} color="$textMuted" textAlign="center">
              TecNM · Instituto Tecnológico de Colima
            </Text>
          </YStack>

          {/* ── Cerrar sesión ────────────────────────────────────── */}
          {!isGuest && (
            <TouchableOpacity onPress={handleCerrarSesion} activeOpacity={0.85}>
              <YStack mx="$lg" bg="#FFF5F5" borderRadius="$lg" py="$md" alignItems="center" borderWidth={1} borderColor="#FEB2B2">
                <XStack alignItems="center" gap="$sm">
                  <LogOut size={20} color="#C53030" />
                  <Text fontSize={16} fontWeight="700" color="#C53030">
                    Cerrar sesión
                  </Text>
                </XStack>
              </YStack>
            </TouchableOpacity>
          )}

        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Subcomponente: Sección de menú ─────────────────────────────────
const SeccionMenu = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <YStack px="$lg" gap="$xs">
    <Text fontSize={12} fontWeight="700" color="$textMuted" textTransform="uppercase" letterSpacing={1}>
      {titulo}
    </Text>
    <YStack bg="$white" borderRadius="$lg" borderWidth={1} borderColor="$border" overflow="hidden">
      {children}
    </YStack>
  </YStack>
);

// ── Subcomponente: Item con switch ─────────────────────────────────
const ItemSwitch = ({
  icon: Icon,
  label,
  descripcion,
  valor,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  descripcion?: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) => (
  <XStack alignItems="center" px="$md" py="$md" gap="$md" borderBottomWidth={0.5} borderBottomColor="$border">
    <Icon size={20} color={COLORS.primary} />
    <YStack flex={1}>
      <Text fontSize={16} color="$textPrimary" fontWeight="500">
        {label}
      </Text>
      {descripcion && (
        <Text fontSize={12} color="$textMuted" mt={2}>
          {descripcion}
        </Text>
      )}
    </YStack>
    <Switch
      value={valor}
      onValueChange={onChange}
      trackColor={{ true: COLORS.primary + '80', false: COLORS.border }}
      thumbColor={valor ? COLORS.primary : '#f4f3f4'}
    />
  </XStack>
);

// ── Subcomponente: Item de menú ────────────────────────────────────
const ItemMenu = ({
  icon: Icon,
  label,
  valor,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  valor?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <XStack alignItems="center" px="$md" py="$md" gap="$md" borderBottomWidth={0.5} borderBottomColor="$border">
      <Icon size={20} color={COLORS.primary} />
      <Text fontSize={16} color="$textPrimary" fontWeight="500">
        {label}
      </Text>
      <YStack flex={1} />
      {valor && (
        <Text fontSize={14} color="$textMuted">
          {valor}
        </Text>
      )}
      <ChevronRight size={18} color={COLORS.textMuted} />
    </XStack>
  </TouchableOpacity>
);

export default PerfilScreen;
