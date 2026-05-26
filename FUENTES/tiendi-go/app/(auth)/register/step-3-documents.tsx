import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { DocumentSlot } from '@/components/ui/DocumentSlot';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Colors, Spacing } from '@/constants/theme';
import { authService } from '@/services/auth.service';

type DocKey = 'licencia' | 'soat' | 'antecedentes' | 'tarjeta';

interface DocSlotConfig {
  key: DocKey;
  label: string;
}

const ALL_DOCS: DocSlotConfig[] = [
  { key: 'licencia', label: 'Licencia de conducir' },
  { key: 'soat', label: 'SOAT' },
  { key: 'antecedentes', label: 'Antecedentes penales' },
  { key: 'tarjeta', label: 'Tarjeta de propiedad' },
];

const SIMPLE_DOCS: DocSlotConfig[] = [
  { key: 'licencia', label: 'Foto del vehículo' },
];

export default function Step3DocumentsScreen() {
  const router = useRouter();
  const { vehicleType } = useLocalSearchParams<{ vehicleType?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [activeCameraKey, setActiveCameraKey] = useState<DocKey | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const isSimple = vehicleType === 'Bicicleta' || vehicleType === 'APie';
  const slots = isSimple ? SIMPLE_DOCS : ALL_DOCS;

  const openSource = (key: DocKey) => {
    Alert.alert('Subir documento', 'Elegí cómo querés agregar el documento', [
      { text: 'Galería / Archivo', onPress: () => pickFromGallery(key) },
      { text: 'Tomar foto', onPress: () => openCameraFor(key) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const pickFromGallery = async (key: DocKey) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setDocs((prev) => ({ ...prev, [key]: result.assets[0].uri }));
    }
  };

  const openCameraFor = async (key: DocKey) => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permiso de cámara requerido', 'Habilitá el acceso a la cámara en la configuración.');
        return;
      }
    }
    setActiveCameraKey(key);
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (!cameraRef || !activeCameraKey) return;
    const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
    if (photo) {
      setDocs((prev) => ({ ...prev, [activeCameraKey]: photo.uri }));
    }
    setShowCamera(false);
    setActiveCameraKey(null);
  };

  const handleSubmit = async () => {
    const missing = slots.filter((s) => !docs[s.key]);
    if (missing.length > 0) {
      setApiError(`Faltan documentos: ${missing.map((s) => s.label).join(', ')}`);
      return;
    }
    setApiError('');
    setLoading(true);
    try {
      const formData = new FormData();
      slots.forEach((slot) => {
        const uri = docs[slot.key];
        if (uri) {
          const filename = uri.split('/').pop() ?? `${slot.key}.jpg`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append(slot.key, { uri, name: filename, type } as unknown as Blob);
        }
      });
      await authService.registerStep3(formData);
      router.replace('/(auth)/pending-approval');
    } catch {
      setApiError('Error al enviar los documentos. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          ref={setCameraRef}
        />
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cancelCameraButton} onPress={() => setShowCamera(false)}>
            <Text style={styles.cancelCameraText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shutterButton} onPress={takePhoto}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Documentos</Text>
        <Text style={styles.subtitle}>
          {isSimple ? 'Subí una foto de tu vehículo para completar el registro' : 'Subí los documentos requeridos para verificar tu cuenta'}
        </Text>

        <ProgressSteps current={3} total={3} />

        {slots.map((slot) => (
          <DocumentSlot
            key={slot.key}
            label={slot.label}
            uri={docs[slot.key] ?? null}
            onPress={() => openSource(slot.key)}
          />
        ))}

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <Button label="Enviar solicitud" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    marginBottom: Spacing.md,
  },
  backText: {
    fontSize: 15,
    color: Colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text2,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  apiError: {
    fontSize: 13,
    color: Colors.error,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  cancelCameraButton: {
    padding: Spacing.md,
  },
  cancelCameraText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
});
