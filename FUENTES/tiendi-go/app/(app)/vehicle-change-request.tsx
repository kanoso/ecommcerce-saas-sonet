import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { uploadPhoto } from '@/services/cloudinary';
import { ridersService } from '@/services/riders.service';
import type { VehicleChangeRequestPayload } from '@/types/rider.types';
import { Colors, Radius, Spacing } from '@/constants/theme';

type VehicleType = VehicleChangeRequestPayload['vehicleType'];

interface VehicleTypeOption {
  key: VehicleType;
  label: string;
}

const VEHICLE_TYPES: VehicleTypeOption[] = [
  { key: 'Motocicleta', label: 'Moto' },
  { key: 'Automovil', label: 'Auto' },
  { key: 'Bicicleta', label: 'Bicicleta' },
  { key: 'APie', label: 'A pie' },
];

const MAX_PHOTOS = 3;

export default function VehicleChangeRequestScreen() {
  const router = useRouter();

  const [vehicleType, setVehicleType] = useState<VehicleType>('Motocicleta');
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const canSubmit =
    !uploading && plate.trim().length > 0 && photoUris.length > 0;

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.show({
          type: 'error',
          text1: 'Permiso de cámara requerido',
          text2: 'Habilitá el acceso a la cámara en la configuración.',
        });
        return;
      }
    }
    setCameraVisible(true);
  };

  const takePhoto = async () => {
    if (!cameraRef) return;
    const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      setPhotoUris((prev) => [...prev, photo.uri].slice(0, MAX_PHOTOS));
      setCameraVisible(false);
    }
  };

  const pickFromGallery = async () => {
    setCameraVisible(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    try {
      const documentUrls: string[] = [];
      for (const uri of photoUris) {
        const url = await uploadPhoto(uri);
        documentUrls.push(url);
      }
      await ridersService.createVehicleChangeRequest({
        vehicleType,
        plate: plate.trim(),
        brand: brand.trim() || undefined,
        color: color.trim() || undefined,
        documentUrls,
      });
      Toast.show({
        type: 'success',
        text1: 'Solicitud enviada',
        text2: 'Revisaremos tu solicitud y te avisaremos.',
      });
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar la solicitud.';
      if (msg === 'Ya tenés una solicitud pendiente.') {
        Toast.show({
          type: 'info',
          text1: 'Solicitud pendiente',
          text2: msg,
        });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: msg });
      }
      setUploading(false);
    }
  };

  if (cameraVisible) {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setCameraVisible(false)}>
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing="back" ref={setCameraRef} />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelCameraButton}
              onPress={() => setCameraVisible(false)}
            >
              <Text style={styles.cancelCameraText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButton} onPress={takePhoto}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
              <Text style={styles.galleryText}>Galería</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.uploadingText}>Subiendo fotos…</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Solicitar cambio de vehículo</Text>
        </View>

        {/* Vehicle type picker */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Tipo de vehículo</Text>
          <View style={styles.pillRow}>
            {VEHICLE_TYPES.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.pill, vehicleType === opt.key && styles.pillActive]}
                onPress={() => setVehicleType(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: vehicleType === opt.key }}
              >
                <Text style={[styles.pillText, vehicleType === opt.key && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Fields */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Datos del vehículo</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Patente / Placa *</Text>
            <TextInput
              style={styles.input}
              value={plate}
              onChangeText={setPlate}
              placeholder="Ej: ABC-123"
              placeholderTextColor={Colors.text2}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Marca</Text>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="Ej: Honda"
              placeholderTextColor={Colors.text2}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Color</Text>
            <TextInput
              style={styles.input}
              value={color}
              onChangeText={setColor}
              placeholder="Ej: Rojo"
              placeholderTextColor={Colors.text2}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Photos */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Fotos del documento *</Text>
          <Text style={styles.sectionHint}>
            Adjuntá foto de la cédula verde o tarjeta de circulación (mín. 1, máx. 3).
          </Text>

          <View style={styles.photoGrid}>
            {photoUris.map((uri, index) => (
              <View key={uri + index} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                <Pressable
                  style={styles.removePhotoBtn}
                  onPress={() => removePhoto(index)}
                  accessibilityLabel="Eliminar foto"
                >
                  <Text style={styles.removePhotoBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
            {photoUris.length < MAX_PHOTOS && (
              <Pressable style={styles.addPhotoBtn} onPress={openCamera}>
                <Text style={styles.addPhotoBtnIcon}>+</Text>
                <Text style={styles.addPhotoBtnLabel}>Agregar foto</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
        >
          <Text style={styles.submitBtnText}>Enviar solicitud</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  uploadingText: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: '500',
  },
  header: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionBlock: {
    backgroundColor: Colors.card,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHint: {
    fontSize: 13,
    color: Colors.text2,
    lineHeight: 18,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pill: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text2,
  },
  pillTextActive: {
    color: Colors.white,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.text2,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: 88,
    height: 88,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBtnText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '700',
  },
  addPhotoBtn: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoBtnIcon: {
    fontSize: 24,
    color: Colors.text2,
    fontWeight: '300',
  },
  addPhotoBtnLabel: {
    fontSize: 11,
    color: Colors.text2,
    fontWeight: '500',
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  // Camera
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
  galleryButton: {
    padding: Spacing.md,
  },
  galleryText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
});
