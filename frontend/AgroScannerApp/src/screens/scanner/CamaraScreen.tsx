/**
 * Pantalla de camara real para escaneo de cultivos.
 *
 * Captura una imagen con CameraView o selecciona una desde galeria, copia la
 * imagen al almacenamiento persistente de la app y conserva el mock del modelo ML.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw } from 'lucide-react-native';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParams, ResultadoML } from '../../types';
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING, RADIUS } from '../../constants';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParams, 'Camara'>;
  route: RouteProp<RootStackParams, 'Camara'>;
};

const CamaraScreen = ({ navigation, route }: Props) => {
  const { cultivoId, cultivoNombre } = route.params;
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [analizando, setAnalizando] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<CameraType>('back');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewRatio, setPreviewRatio] = useState<number>(1);
  const autoPermissionRequested = useRef(false);

  useEffect(() => {
    if (!cameraPermission || cameraPermission.granted || autoPermissionRequested.current) {
      return;
    }

    autoPermissionRequested.current = true;
    requestCameraPermission().catch((error) => {
      console.log(error);
    });
  }, [cameraPermission, requestCameraPermission]);

  const ensureCameraPermission = async () => {
    if (cameraPermission?.granted) return true;

    const response = await requestCameraPermission();
    if (!response.granted) {
      Alert.alert(
        'Permiso de camara requerido',
        'Activa el permiso de camara para poder tomar fotos de cultivos.',
      );
      return false;
    }

    return true;
  };

  const ensureGalleryPermission = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) return true;

    const response = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!response.granted) {
      Alert.alert(
        'Permiso de galeria requerido',
        'Activa el permiso de galeria para seleccionar fotos de cultivos.',
      );
      return false;
    }

    return true;
  };

  const persistImage = async (sourceUri: string) => {
    const photoDir = new Directory(Paths.document, 'agroscanner', 'capturas');
    photoDir.create({ intermediates: true, idempotent: true });

    const extension = getImageExtension(sourceUri);
    const destination = new File(photoDir, `deteccion-${Date.now()}.${extension}`);
    await new File(sourceUri).copy(destination);

    return destination.uri;
  };

  const saveImageToGallery = async (imageUri: string) => {
    try {
      const current = await MediaLibrary.getPermissionsAsync(true, ['photo']);
      const permission = current.granted
        ? current
        : await MediaLibrary.requestPermissionsAsync(true, ['photo']);

      if (!permission.granted) {
        return;
      }

      await MediaLibrary.saveToLibraryAsync(imageUri);
    } catch (error) {
      console.log(error);
    }
  };

  const analizarImagen = async (imageUri: string) => {
    setAnalizando(true);

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));

      const resultadoSimulado: ResultadoML = getResultadoSimulado(cultivoId);

      navigation.navigate('Resultado', {
        resultado: resultadoSimulado,
        imagenUri: imageUri,
        cultivoId,
        cultivoNombre,
      });
    } catch (error) {
      console.log(error);
      Alert.alert('No se pudo analizar', 'Intenta capturar o seleccionar la imagen de nuevo.');
    } finally {
      setAnalizando(false);
    }
  };

  const handleCapturar = async () => {
    if (analizando) return;

    const hasPermission = await ensureCameraPermission();
    if (!hasPermission) return;

    if (!cameraReady || !cameraRef.current) {
      Alert.alert('Camara no lista', 'Espera un momento y vuelve a intentar.');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        exif: false,
      });

      const imageUri = await persistImage(photo.uri);
      await saveImageToGallery(imageUri);
      await analizarImagen(imageUri);
    } catch (error) {
      console.log(error);
      Alert.alert('No se pudo capturar', 'Revisa la camara e intenta nuevamente.');
    }
  };

  const handleGaleria = async () => {
    if (analizando) return;

    const hasPermission = await ensureGalleryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const { uri, width, height } = result.assets[0];
      const imageUri = await persistImage(uri);
      setPreviewUri(imageUri);
      setPreviewRatio(width && height ? width / height : 1);
    } catch (error) {
      console.log(error);
      Alert.alert('No se pudo abrir la galeria', 'Intenta seleccionar la imagen de nuevo.');
    }
  };

  const handleConfirmarPreview = () => {
    if (!previewUri) return;
    const uri = previewUri;
    setPreviewUri(null);
    analizarImagen(uri);
  };

  const handleCancelarPreview = () => {
    setPreviewUri(null);
  };

  const toggleFlash = () => {
    setFlash((current) => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  if (!cameraPermission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionFallback}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.permissionTitle}>Preparando camara...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionFallback}>
          <TouchableOpacity
            style={[styles.btnBack, styles.permissionBackButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnBackText}>X</Text>
          </TouchableOpacity>
          <Text style={styles.permissionTitle}>Permiso de camara</Text>
          <Text style={styles.permissionText}>
            AgroScanner necesita acceso a la camara para fotografiar hojas.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={ensureCameraPermission}>
            <Text style={styles.permissionButtonText}>Permitir camara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permissionSecondaryButton} onPress={handleGaleria}>
            <Text style={styles.permissionSecondaryText}>Elegir desde galeria</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.camaraArea}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
        />

        <View style={styles.overlay}>
          <View style={styles.camaraHeader}>
            <TouchableOpacity
              style={styles.btnBack}
              onPress={() => navigation.goBack()}
              disabled={analizando}
            >
              <Text style={styles.btnBackText}>X</Text>
            </TouchableOpacity>
            <View style={styles.cultivoBadge}>
              <Text style={styles.cultivoBadgeText}>{cultivoNombre}</Text>
            </View>
            <TouchableOpacity
              style={styles.btnBack}
              onPress={toggleFacing}
              disabled={analizando}
            >
              <RefreshCw size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <Text style={styles.instruccionTexto}>
            Enfoca la hoja dentro del marco
          </Text>

          <View style={styles.marcoContainer}>
            <View style={styles.marco}>
              <View style={[styles.esquina, styles.esquinaTL]} />
              <View style={[styles.esquina, styles.esquinaTR]} />
              <View style={[styles.esquina, styles.esquinaBL]} />
              <View style={[styles.esquina, styles.esquinaBR]} />
            </View>
          </View>

          <Text style={styles.tipsTexto}>
            Buena luz - Hoja centrada - Sin mover
          </Text>

          {analizando && (
            <View style={styles.analizandoOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.analizandoTitulo}>Analizando...</Text>
              <Text style={styles.analizandoSub}>Menos de 3 segundos</Text>
            </View>
          )}

          <View style={styles.controles}>
            <TouchableOpacity
              style={styles.btnControl}
              onPress={handleGaleria}
              disabled={analizando}
            >
              <Text style={styles.btnControlText}>Galeria</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnCaptura,
                (!cameraReady || analizando) && styles.btnCapturaDisabled,
              ]}
              onPress={handleCapturar}
              disabled={analizando}
              activeOpacity={0.8}
            >
              <View style={styles.btnCapturaInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnControl}
              onPress={toggleFlash}
              disabled={analizando}
            >
              <Text style={styles.btnControlText}>
                Flash {flash === 'off' ? 'Off' : flash === 'on' ? 'On' : 'Auto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {previewUri && (
          <View style={styles.previewOverlay}>
            <Image source={{ uri: previewUri }} style={[styles.previewImage, { aspectRatio: previewRatio }]} resizeMode="cover" />
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewButton} onPress={handleCancelarPreview}>
                <Text style={styles.previewCancelText}>DESCARTAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewButtonConfirm} onPress={handleConfirmarPreview}>
                <Text style={styles.previewConfirmText}>CONFIRMAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const getImageExtension = (uri: string) => {
  const cleanUri = uri.split('?')[0] ?? uri;

  if (cleanUri.startsWith('content://')) {
    return 'jpg';
  }

  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || 'jpg';
};

const getResultadoSimulado = (cultivoId: number): ResultadoML => {
  const resultados: Record<number, ResultadoML> = {
    1: {
      enfermedad: 'HLB (Dragon Amarillo)',
      confianza: 0.92,
      resultado_positivo: true,
      nivel_riesgo: 'critico',
      tratamiento: 'No tiene cura. Retire el arbol infectado inmediatamente para evitar propagacion. Controle el vector y contacte a SENASICA para reporte oficial.',
    },
    2: {
      enfermedad: 'Araña Roja',
      confianza: 0.78,
      resultado_positivo: true,
      nivel_riesgo: 'alto',
      tratamiento: 'Aplique acaricida natural (jabon potasico) cada 7 dias. Introduzca depredadores naturales como Phytoseiulus persimilis. Evite el exceso de nitrogeno en la fertilizacion.',
    },
    3: {
      enfermedad: 'Sigatoka Negra',
      confianza: 0.85,
      resultado_positivo: true,
      nivel_riesgo: 'alto',
      tratamiento: 'Aplique fungicida sistemico. Elimine hojas con dano severo, mejore el drenaje y repita aplicacion en 15 dias.',
    },
  };
  return resultados[cultivoId] ?? resultados[1];
};

export default CamaraScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camaraArea: {
    flex: 1,
    backgroundColor: '#111',
    position: 'relative',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  permissionFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    backgroundColor: '#111',
    gap: SPACING.md,
  },
  permissionTitle: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.bold,
  },
  permissionText: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  permissionButtonText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
  },
  permissionBackButton: {
    position: 'absolute',
    top: SPACING.xl,
    left: SPACING.lg,
  },
  permissionSecondaryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  permissionSecondaryText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.medium,
  },
  camaraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  btnBack: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBackText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.bold,
  },
  cultivoBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  cultivoBadgeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
  },
  instruccionTexto: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  marcoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marco: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  esquina: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  esquinaTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  esquinaTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  esquinaBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  esquinaBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  tipsTexto: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  analizandoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  analizandoTitulo: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  analizandoSub: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.7)',
  },
  controles: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  btnControl: {
    alignItems: 'center',
    minWidth: 72,
  },
  btnControlText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
  },
  btnCaptura: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    borderWidth: 4,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCapturaDisabled: {
    borderColor: COLORS.textMuted,
  },
  btnCapturaInner: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  previewImage: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  previewActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    justifyContent: 'center',
  },
  previewButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  previewCancelText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
  },
  previewButtonConfirm: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  previewConfirmText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
