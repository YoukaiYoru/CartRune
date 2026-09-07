import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeType } from 'expo-camera';
import { Image } from 'expo-image';
import { embedPhoto } from '@/services/embeddings';
import { setEmbedding } from '@/lib/embedding-cache';
import { matchEmbedding, scanText } from '@/services/scanner';
import type { MatchResult } from '@/services/types';
import { isOcrAvailable, recognizeTextSafe } from '@/lib/mlkit';
import { theme } from '@/theme';
import Animated, { FadeInUp, SlideInUp } from 'react-native-reanimated';

type ScanMethod = 'barcode' | 'text' | 'embedding';

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];
const LIVE_INTERVAL_MS = 2500;
const LIVE_START_DELAY_MS = 500;

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
  const [ocrUnavailable, setOcrUnavailable] = useState(false);
  const handledRef = useRef(false);

  // Live Google Lens-style analysis state.
  const [liveActive, setLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    'idle' | 'analyzing' | 'found' | 'notfound' | 'error'
  >('idle');
  const [liveResult, setLiveResult] = useState<MatchResult | null>(null);
  const [livePhoto, setLivePhoto] = useState<string | null>(null);
  const liveLoopRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const liveSupported =
    activeMethod === 'embedding' ||
    (activeMethod === 'text' && isOcrAvailable());

  // Continuous live scan loop (Google Lens style). Takes a photo, analyzes it
  // and shows the top match on the camera view without leaving the screen.
  useEffect(() => {
    if (!liveActive || !liveSupported || !permission?.granted) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || liveLoopRef.current || !cameraRef.current) return;
      liveLoopRef.current = true;
      setLiveStatus('analyzing');
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        if (cancelled) return;
        setLivePhoto(photo.uri);

        if (activeMethod === 'embedding') {
          const embedding = await embedPhoto(photo.uri);
          setEmbedding(photo.uri, embedding);
          const res = await matchEmbedding(embedding);
          if (cancelled) return;
          const top = res.matches[0] ?? null;
          setLiveResult(top);
          setLiveStatus(top ? 'found' : 'notfound');
        } else if (activeMethod === 'text') {
          const text = await recognizeTextSafe(photo.uri);
          if (!cancelled && text) {
            const firstLine = text
              .split('\n')
              .map((l) => l.trim())
              .find((l) => l.length > 0);
            if (firstLine) {
              const res = await scanText(firstLine);
              const top = res.matches[0] ?? null;
              setLiveResult(top);
              setLiveStatus(top ? 'found' : 'notfound');
            } else {
              setLiveStatus('notfound');
            }
          } else if (!cancelled) {
            setLiveStatus('notfound');
          }
        }
      } catch {
        if (!cancelled) setLiveStatus('error');
      } finally {
        liveLoopRef.current = false;
        if (!cancelled) {
          timeoutRef.current = setTimeout(tick, LIVE_INTERVAL_MS);
        }
      }
    };

    timeoutRef.current = setTimeout(tick, LIVE_START_DELAY_MS);
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      liveLoopRef.current = false;
    };
  }, [liveActive, activeMethod, liveSupported, permission?.granted]);

  const stopLive = () => {
    setLiveActive(false);
    setLiveStatus('idle');
    setLiveResult(null);
    setLivePhoto(null);
  };

  const resetScan = (method: ScanMethod) => {
    handledRef.current = false;
    stopLive();
    setActiveMethod(method);
    setShowOptions(false);
    setOcrUnavailable(false);
  };

  const openLiveResults = () => {
    if (activeMethod && livePhoto) {
      router.push({
        pathname: '/scanner/results',
        params: { method: activeMethod, photo: livePhoto },
      });
    }
  };

  const handleBarcodeScanned = (result: { type: string; data: string }) => {
    if (activeMethod !== 'barcode' || handledRef.current) return;
    handledRef.current = true;
    stopLive();
    router.push({
      pathname: '/scanner/results',
      params: { method: 'barcode', value: result.data, type: result.type },
    });
  };

  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current || liveActive) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      handledRef.current = true;
      stopLive();

      if (activeMethod === 'text') {
        if (!isOcrAvailable()) {
          setOcrUnavailable(true);
          return;
        }
        try {
          const text = await recognizeTextSafe(photo.uri);
          if (text === null) {
            setOcrUnavailable(true);
            return;
          }
          const firstLine = text
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
        } catch (err) {
          router.push({
            pathname: '/scanner/results',
            params: {
              method: 'embedding',
              photo: photo.uri,
              failed: '1',
              error: err instanceof Error ? err.message : String(err),
            },
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

          {/* Live Lens result overlay */}
          {liveActive && (
            <View style={styles.liveOverlay}>
              <View style={styles.liveHeader}>
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveChipText}>
                    {liveStatus === 'analyzing' ? 'ANALYZING' : 'LIVE'}
                  </Text>
                </View>
                <Pressable style={styles.liveStop} onPress={stopLive}>
                  <Text style={styles.liveStopText}>Stop</Text>
                </Pressable>
              </View>

              {liveStatus === 'error' ? (
                <View style={styles.liveError}>
                  <Text style={styles.liveErrorTitle}>Embedding service offline</Text>
                  <Text style={styles.liveErrorText}>
                    Keep trying automatically, or scan in barcode mode.
                  </Text>
                </View>
              ) : liveStatus === 'found' && liveResult ? (
                <Pressable style={styles.liveCard} onPress={openLiveResults}>
                  {liveResult.cover_url ? (
                    <Image source={{ uri: liveResult.cover_url }} style={styles.liveCover} />
                  ) : (
                    <View style={styles.liveCoverPlaceholder}>
                      <Text style={styles.liveCoverEmoji}>🎮</Text>
                    </View>
                  )}
                  <View style={styles.liveInfo}>
                    <Text style={styles.liveTitle} numberOfLines={1}>
                      {liveResult.title}
                    </Text>
                    {liveResult.platform ? (
                      <Text style={styles.livePlatform}>{liveResult.platform}</Text>
                    ) : null}
                    {typeof liveResult.similarity === 'number' && liveResult.similarity > 0 ? (
                      <Text style={styles.liveScore}>
                        {Math.round(liveResult.similarity * 100)}% match
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.liveArrow}>›</Text>
                </Pressable>
              ) : (
                <View style={styles.liveSearching}>
                  <ActivityIndicator size="small" color={theme.accent.warm} />
                  <Text style={styles.liveSearchingText}>
                    {liveStatus === 'notfound'
                      ? 'No match yet — keep pointing the camera'
                      : 'Looking for a match...'}
                  </Text>
                </View>
              )}
            </View>
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

      {activeMethod && activeMethod !== 'barcode' && (
        <View style={styles.controls}>
          <Pressable
            style={[styles.shutterButton, (isCapturing || ocrUnavailable || liveActive) && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={isCapturing || ocrUnavailable || liveActive}
          >
            <View style={styles.shutterRing}>
              <View style={[styles.shutterCore, (isCapturing || ocrUnavailable || liveActive) && styles.shutterCoreBusy]} />
            </View>
          </Pressable>
          {liveSupported && (
            <Pressable
              style={[styles.liveToggle, liveActive && styles.liveToggleOn]}
              onPress={() => (liveActive ? stopLive() : setLiveActive(true))}
            >
              <Text style={[styles.liveToggleText, liveActive && styles.liveToggleTextOn]}>
                {liveActive ? 'Live on' : '🔴 Live'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {ocrUnavailable && (
        <View style={styles.ocrWarning}>
          <Text style={styles.ocrWarningText}>
            No text was detected. Make sure the embeddings service (port 8700)
            is reachable from your phone and cover is well-lit, then try again.
          </Text>
        </View>
      )}

      {activeMethod && (
        <Pressable style={styles.openModalButton} onPress={() => setShowOptions(true)}>
          <Text style={styles.openModalText}>Switch method</Text>
        </Pressable>
      )}

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
                <Text style={styles.optionDesc}>
                  {isOcrAvailable() ? 'Read title from cover' : 'Requires a native build (not in Expo Go)'}
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.optionCard} onPress={() => resetScan('embedding')}>
              <Text style={styles.optionIcon}>🧠</Text>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Visual Match</Text>
                <Text style={styles.optionDesc}>AI-powered live recognition</Text>
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
    width: 210,
    height: 280,
    borderRadius: 10,
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
  controls: {
    position: 'absolute',
    right: 16,
    left: 16,
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  shutterButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
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
  liveToggle: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border.default,
  },
  liveToggleOn: { backgroundColor: theme.accent.warm, borderColor: theme.accent.warm },
  liveToggleText: { color: theme.text.primary, fontSize: 13, fontWeight: '700' },
  liveToggleTextOn: { color: theme.bg.deep },
  liveOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingBottom: 16,
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff5252',
    marginRight: 8,
  },
  liveChipText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  liveStop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  liveStopText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border.default,
    padding: 10,
  },
  liveCover: { width: 46, height: 62, borderRadius: 6, backgroundColor: theme.bg.surface },
  liveCoverPlaceholder: {
    width: 46,
    height: 62,
    borderRadius: 6,
    backgroundColor: theme.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCoverEmoji: { fontSize: 22, opacity: 0.4 },
  liveInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  liveTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '700' },
  livePlatform: { color: theme.text.secondary, fontSize: 12, marginTop: 2 },
  liveScore: { color: theme.accent.warm, fontSize: 12, fontWeight: '700', marginTop: 3 },
  liveArrow: { color: theme.text.muted, fontSize: 24 },
  liveError: {
    backgroundColor: theme.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.accent.warm,
    padding: 14,
  },
  liveErrorTitle: { color: theme.accent.warm, fontSize: 14, fontWeight: '700' },
  liveErrorText: { color: theme.text.muted, fontSize: 12, marginTop: 4 },
  liveSearching: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
  },
  liveSearchingText: { color: theme.text.secondary, fontSize: 13, marginLeft: 10 },
  ocrWarning: {
    position: 'absolute',
    bottom: 132,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 300,
  },
  ocrWarningText: { color: theme.accent.warm, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  openModalButton: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 8,
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