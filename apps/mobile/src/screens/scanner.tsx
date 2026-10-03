import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import { Image } from 'expo-image';
import { analyzeCover, embedPhoto } from '@/services/embeddings';
import { setEmbedding } from '@/lib/embedding-cache';
import { rememberScanCapture } from '@/lib/scan-capture';
import { matchEmbedding } from '@/services/scanner';
import type { MatchResult } from '@/services/types';
import { theme } from '@/theme';
import { resolveApiUrl } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
type ProcessingStep = 'capture' | 'upload' | 'visual' | 'metadata' | 'catalog';

const LIVE_INTERVAL_MS = 2500;
const LIVE_START_DELAY_MS = 500;

export function Scanner() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const cameraRef = useRef<CameraRef>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    quality: 0.7,
    qualityPrioritization: 'balanced',
  });
  const activeMethod = 'embedding' as const;
  const [isCapturing, setIsCapturing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const handledRef = useRef(false);

  // Continuous preview analysis state.
  const [liveActive, setLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    'idle' | 'analyzing' | 'found' | 'notfound' | 'error'
  >('idle');
  const [liveResult, setLiveResult] = useState<MatchResult | null>(null);
  const [livePhoto, setLivePhoto] = useState<string | null>(null);
  const [cameraEpoch, setCameraEpoch] = useState(0);
  const liveLoopRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Returning from results must provide a fresh camera session. On Android,
  // keeping the previous CameraView mounted can leave capture locked after a
  // successful photo/navigation cycle.
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      handledRef.current = false;
      setIsCapturing(false);
      setProcessingStep(null);
      setLiveActive(false);
      setLiveStatus('idle');
      setLiveResult(null);
      setLivePhoto(null);
      setCameraEpoch((value) => value + 1);
      return () => {
        setIsFocused(false);
        liveLoopRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, [])
  );

  const liveSupported = true;
  // A physical game case is close to a 3:4 portrait rectangle. This guide
  // adapts to the viewport while leaving room for the camera controls.
  const frameWidth = Math.min(viewportWidth * 0.64, 242);
  const frameHeight = Math.min(frameWidth / 0.78, viewportHeight * 0.40);

  // Continuous live scan loop (Google Lens style). Takes a photo, analyzes it
  // and shows the top match on the camera view without leaving the screen.
  useEffect(() => {
    if (!liveActive || !liveSupported || !hasPermission || !device) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || liveLoopRef.current || !cameraRef.current) return;
      liveLoopRef.current = true;
      setLiveStatus('analyzing');
      try {
        const photoUri = await capturePhotoUri();
        if (cancelled) return;
        setLivePhoto(photoUri);

        if (activeMethod === 'embedding') {
          const embedding = await embedPhoto(photoUri);
          setEmbedding(photoUri, embedding);
          const res = await matchEmbedding(embedding);
          if (cancelled) return;
          const top = res.matches[0] ?? null;
          setLiveResult(top);
          setLiveStatus(top ? 'found' : 'notfound');
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
  }, [liveActive, activeMethod, liveSupported, hasPermission, device]);

  const capturePhotoUri = async () => {
    const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
    const path = await photo.saveToTemporaryFileAsync();
    return path.startsWith('file://') ? path : `file://${path}`;
  };

  const stopLive = () => {
    setLiveActive(false);
    setLiveStatus('idle');
    setLiveResult(null);
    setLivePhoto(null);
  };

  const openLiveResults = () => {
    if (livePhoto) {
      const captureKey = rememberScanCapture(livePhoto);
      router.push({
        pathname: '/scanner/results',
        params: { method: activeMethod, capture_key: captureKey },
      });
    }
  };

  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current || liveActive) return;
    setIsCapturing(true);
    setProcessingStep('capture');
    try {
      const photoUri = await capturePhotoUri();
      console.info(`[scanner] cover captured method=${activeMethod}`);
      handledRef.current = true;
      stopLive();
      setProcessingStep('upload');

      const captureKey = rememberScanCapture(photoUri);
      try {
          // MobileCLIP y Qwen son inferencias pesadas en el mismo servidor.
          // Secuenciarlas evita que compitan por CPU/RAM y provoquen timeouts.
          setProcessingStep('visual');
          const embedding = await embedPhoto(photoUri);
          setProcessingStep('metadata');
          const analysis = await analyzeCover(photoUri)
            .then((value) =>
              value.title || value.console || value.region || value.edition || value.publisher
                ? value
                : null
            )
            .catch(() => null);
          setProcessingStep('catalog');
          setEmbedding(photoUri, embedding);
          setProcessingStep(null);
          router.push({
            pathname: '/scanner/results',
            params: {
              method: 'embedding',
              capture_key: captureKey,
              ...(analysis ? { analysis: JSON.stringify(analysis) } : {}),
            },
          });
      } catch (err) {
          setProcessingStep(null);
          router.push({
            pathname: '/scanner/results',
            params: {
              method: 'embedding',
              capture_key: captureKey,
              failed: '1',
              error: err instanceof Error ? err.message : String(err),
            },
          });
      }
    } catch {
      setIsCapturing(false);
      setProcessingStep(null);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.cameraText}>Camera permission needed</Text>
          <Text style={styles.cameraSubtext}>
            CartRune uses the camera and AI to identify game covers.
          </Text>
          <Pressable style={styles.permissionButton} onPress={() => void requestPermission()}>
            <Text style={styles.permissionButtonText}>Grant access</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.cameraText}>Camera unavailable</Text>
          <Text style={styles.cameraSubtext}>
            This device does not expose a usable back camera. Try again on a physical device.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrap}>
        <Camera
          key={`camera-${cameraEpoch}`}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={hasPermission && isFocused}
          outputs={[photoOutput]}
          resizeMode="cover"
        />

        <View style={styles.overlayGlow}>
          <View style={[styles.targetFrame, { width: frameWidth, height: frameHeight }]}>
            <View style={styles.targetCornerTopLeft} />
            <View style={styles.targetCornerTopRight} />
            <View style={styles.targetCornerBottomLeft} />
            <View style={styles.targetCornerBottomRight} />
          </View>
          <Text style={styles.scanModeLabel}>AI COVER SCANNER</Text>
          <Text style={styles.overlayHint}>
            Align the four cover edges inside the frame
          </Text>
          <Text style={styles.overlayDistance}>Move closer until one cover fills the frame</Text>

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
                  <Text style={styles.liveErrorTitle}>Cover analysis unavailable</Text>
                  <Text style={styles.liveErrorText}>
                    Try again or move the cover into better light.
                  </Text>
                </View>
              ) : liveStatus === 'found' && liveResult ? (
                <Pressable style={styles.liveCard} onPress={openLiveResults}>
                  {liveResult.cover_url ? (
                    <Image source={{ uri: resolveApiUrl(liveResult.cover_url) }} style={styles.liveCover} contentFit="contain" />
                  ) : (
                    <View style={styles.liveCoverPlaceholder}>
                      <Ionicons name="game-controller-outline" size={22} color={theme.text.muted} />
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
                      ? 'No match yet. Keep pointing the camera'
                      : 'Looking for a match...'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

      <View style={styles.controls}>
          <Pressable
            style={[styles.shutterButton, (isCapturing || liveActive) && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={isCapturing || liveActive}
            accessibilityRole="button"
            accessibilityLabel="Capture cover"
          >
            <View style={styles.shutterRing}>
              <View style={[styles.shutterCore, (isCapturing || liveActive) && styles.shutterCoreBusy]} />
            </View>
          </Pressable>
          {liveSupported && (
            <Pressable
              style={[styles.liveToggle, liveActive && styles.liveToggleOn]}
              onPress={() => (liveActive ? stopLive() : setLiveActive(true))}
              accessibilityRole="button"
              accessibilityLabel={liveActive ? 'Stop live scan' : 'Start live scan'}
            >
              <Text style={[styles.liveToggleText, liveActive && styles.liveToggleTextOn]}>
                {liveActive ? 'Live on' : 'Live scan'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <Modal
        visible={processingStep !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.processingBackdrop}>
          <View style={styles.processingCard}>
            <View style={styles.processingBadge}>
              <Text style={styles.processingBadgeText}>CARTRUNE SCANNER</Text>
            </View>
            <ActivityIndicator size="large" color={theme.accent.primary} />
            <Text style={styles.processingTitle}>Reading your shelf find</Text>
            <Text style={styles.processingSubtitle}>
              Keep this screen open while we identify the cover.
            </Text>

            <ProcessingRow
              icon="CAM"
              label="Photo captured"
              active={processingStep === 'capture'}
              complete={['upload', 'visual', 'metadata', 'catalog'].includes(processingStep ?? '')}
            />
            <ProcessingRow
              icon="↑"
              label="Sending cover securely"
              active={processingStep === 'upload'}
              complete={['visual', 'metadata', 'catalog'].includes(processingStep ?? '')}
            />
            <ProcessingRow
              icon="◈"
              label="Comparing artwork"
              active={processingStep === 'visual'}
              complete={['metadata', 'catalog'].includes(processingStep ?? '')}
            />
            <ProcessingRow
              icon="✦"
              label="Reading title and console"
              active={processingStep === 'metadata'}
              complete={processingStep === 'catalog'}
            />
            <ProcessingRow
              icon="⌕"
              label="Preparing catalog search"
              active={processingStep === 'catalog'}
              complete={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ProcessingRow({
  icon,
  label,
  active,
  complete,
}: {
  icon: string;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <View style={styles.processingRow}>
      <View style={[styles.processingIcon, complete && styles.processingIconComplete]}>
        <Text style={styles.processingIconText}>{complete ? '✓' : icon}</Text>
      </View>
      <Text style={[styles.processingLabel, active && styles.processingLabelActive]}>{label}</Text>
      {active ? <ActivityIndicator size="small" color={theme.accent.warm} /> : null}
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
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.accent.warm,
    opacity: 0.9,
    shadowColor: theme.accent.warm,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  targetCornerTopLeft: { position: 'absolute', top: -2, left: -2, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: theme.accent.primary, borderTopLeftRadius: 10 },
  targetCornerTopRight: { position: 'absolute', top: -2, right: -2, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: theme.accent.primary, borderTopRightRadius: 10 },
  targetCornerBottomLeft: { position: 'absolute', bottom: -2, left: -2, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: theme.accent.primary, borderBottomLeftRadius: 10 },
  targetCornerBottomRight: { position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: theme.accent.primary, borderBottomRightRadius: 10 },
  overlayHint: {
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  overlayDistance: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  scanModeLabel: {
    color: theme.accent.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  controls: {
    position: 'absolute',
    right: 16,
    left: 16,
    bottom: 88,
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
  processingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 8, 14, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  processingCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: theme.bg.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border.default,
    padding: 24,
    shadowColor: theme.shelf.shadow,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  processingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.bg.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 24,
  },
  processingBadgeText: { color: theme.accent.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  processingTitle: {
    color: theme.text.primary,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },
  processingSubtitle: {
    color: theme.text.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 22,
    textAlign: 'center',
  },
  processingRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border.subtle,
  },
  processingIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  processingIconComplete: { backgroundColor: theme.accent.primary },
  processingIconText: { color: theme.text.primary, fontSize: 14, fontWeight: '800' },
  processingLabel: { color: theme.text.muted, fontSize: 13, flex: 1 },
  processingLabelActive: { color: theme.text.primary, fontWeight: '700' },
});
