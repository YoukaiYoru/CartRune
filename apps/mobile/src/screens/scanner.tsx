import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeType } from 'expo-camera';
import { recognizeText } from 'expo-mlkit-ocr';
import { embedPhoto } from '@/services/embeddings';
import { setEmbedding } from '@/lib/embedding-cache';
import { theme } from '@/theme';
import Animated, { FadeInUp, SlideInUp } from 'react-native-reanimated';

type ScanMethod = 'barcode' | 'text' | 'embedding';

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

export function Scanner({ preset }: { preset?: string }) {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [activeMethod, setActiveMethod] = useState<ScanMethod | null>(
    preset && (preset === 'barcode' || preset === 'text' || preset === 'embedding')
      ? preset
      : null
  );
  const [showOptions, setShowOptions] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!preset) return;
    if (preset === activeMethod) return;
    handledRef.current = false;
    setActiveMethod(
      preset === 'barcode' || preset === 'text' || preset === 'embedding'
        ? (preset as ScanMethod)
        : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const resetScan = (method: ScanMethod) => {
    handledRef.current = false;
    setActiveMethod(method);
    setShowOptions(false);
  };

  const handleBarcodeScanned = (result: { type: string; data: string }) => {
    if (activeMethod !== 'barcode' || handledRef.current) return;
    handledRef.current = true;
    router.push({
      pathname: '/scanner/results',
      params: { method: 'barcode', value: result.data, type: result.type },
    });
  };

  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      handledRef.current = true;

      if (activeMethod === 'text') {
        try {
          const result = await recognizeText(photo.uri);
          const firstLine = result.text
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0);
          router.push({
            pathname: '/scanner/results',
            params: {
              method: 'text',
              photo: photo.uri,
              ...(firstLine ? { value: firstLine } : {}),
            },
          });
          return;
        } catch {
          router.push({
            pathname: '/scanner/results',
            params: { method: 'text', photo: photo.uri },
          });
          return;
        }
      }

      if (activeMethod === 'embedding') {
        try {
          const embedding = await embedPhoto(photo.uri);
          setEmbedding(photo.uri, embedding);
          router.push({
            pathname: '/scanner/results',
            params: { method: 'embedding', photo: photo.uri },
          });
        } catch {
          router.push({
            pathname: '/scanner/results',
            params: { method: 'embedding', photo: photo.uri, failed: '1' },
          });
        }
        return;
      }

      router.push({
        pathname: '/scanner/results',
        params: { method: activeMethod!, photo: photo.uri },
      });
    } catch {
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.cameraText}>Camera</Text>
          <Text style={styles.cameraSubtext}>Requesting camera access...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.cameraText}>Camera permission needed</Text>
          <Text style={styles.cameraSubtext}>
            CartRune uses the camera to scan barcodes and game covers.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant access</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={handleBarcodeScanned}
        />

        <View style={styles.overlayGlow}>
          <View style={styles.targetFrame} />
          <Text style={styles.overlayHint}>
            {activeMethod === 'barcode'
              ? 'Point at the barcode on the box'
              : activeMethod === 'text'
                ? 'Center the cover title in the frame'
                : 'Center the game cover in the frame'}
          </Text>
          {activeMethod &&
            activeMethod !== 'barcode' && (
              <Pressable
                style={styles.shutterButton}
                onPress={handleCapture}
                disabled={isCapturing}
              >
                <View style={styles.shutterRing}>
                  <View style={[styles.shutterCore, isCapturing && styles.shutterCoreBusy]} />
                </View>
              </Pressable>
            )}
          {activeMethod && (
            <Pressable
              style={styles.openModalButton}
              onPress={() => setShowOptions(true)}
            >
              <Text style={styles.openModalText}>Switch method</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!activeMethod ? (
        <Animated.View entering={FadeInUp.delay(200).springify()}>
          <Pressable style={styles.scanButton} onPress={() => setShowOptions(true)}>
            <Text style={styles.scanButtonText}>SCAN GAME</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal visible={showOptions} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <Animated.View entering={SlideInUp.springify()} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Scan Method</Text>
            <Text style={styles.modalSubtitle}>How do you want to identify it?</Text>

            <Pressable style={styles.optionCard} onPress={() => resetScan('barcode')}>
              <Text style={styles.optionIcon}>📊</Text>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Barcode</Text>
                <Text style={styles.optionDesc}>Scan EAN/UPC on the box</Text>
              </View>
            </Pressable>

            <Pressable style={styles.optionCard} onPress={() => resetScan('text')}>
              <Text style={styles.optionIcon}>🔤</Text>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Text / OCR</Text>
                <Text style={styles.optionDesc}>Read title from cover</Text>
              </View>
            </Pressable>

            <Pressable style={styles.optionCard} onPress={() => resetScan('embedding')}>
              <Text style={styles.optionIcon}>🧠</Text>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Visual Match</Text>
                <Text style={styles.optionDesc}>AI-powered recognition</Text>
              </View>
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => setShowOptions(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  overlayGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetFrame: {
    width: 240,
    height: 240,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.accent.warm,
    opacity: 0.9,
    shadowColor: theme.accent.warm,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  overlayHint: {
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  shutterButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
  },
  shutterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  shutterCoreBusy: { backgroundColor: theme.accent.warm },
  openModalButton: {
    position: 'absolute',
    bottom: 48,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  openModalText: { color: theme.text.primary, fontSize: 13, fontWeight: '600' },
  cameraText: { color: theme.text.primary, fontSize: 16, fontWeight: '600' },
  cameraSubtext: {
    color: theme.text.muted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  permissionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg.card,
    margin: 16,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: theme.accent.warm,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: { color: theme.bg.deep, fontWeight: '700', fontSize: 14 },
  scanButton: {
    backgroundColor: theme.accent.warm,
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanButtonText: { color: theme.bg.deep, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.bg.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 3,
    backgroundColor: theme.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: theme.text.primary, fontSize: 20, fontWeight: '700' },
  modalSubtitle: { color: theme.text.muted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  optionIcon: { fontSize: 24, marginRight: 12 },
  optionInfo: { flex: 1 },
  optionTitle: { color: theme.text.primary, fontSize: 15, fontWeight: '600' },
  optionDesc: { color: theme.text.muted, fontSize: 12, marginTop: 2 },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: theme.accent.warm, fontSize: 15, fontWeight: '600' },
});