import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import Animated, { FadeInUp, SlideInUp } from 'react-native-reanimated';

type ScanMethod = 'barcode' | 'text' | 'embedding';

export function Scanner() {
  const router = useRouter();
  const [showOptions, setShowOptions] = useState(false);

  const handleMethodSelect = (method: ScanMethod) => {
    setShowOptions(false);
    router.push({ pathname: '/scanner/results', params: { method } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraIcon}>📷</Text>
        <Text style={styles.cameraText}>Camera Preview</Text>
        <Text style={styles.cameraSubtext}>Point at a game cover</Text>
      </View>

      <Animated.View entering={FadeInUp.delay(200).springify()}>
        <Pressable
          style={styles.scanButton}
          onPress={() => setShowOptions(true)}
        >
          <Text style={styles.scanButtonText}>SCAN GAME</Text>
        </Pressable>
      </Animated.View>

      <Modal visible={showOptions} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <Animated.View entering={SlideInUp.springify()} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Scan Method</Text>
            <Text style={styles.modalSubtitle}>How do you want to identify it?</Text>

            <Pressable
              style={styles.optionCard}
              onPress={() => handleMethodSelect('barcode')}
            >
              <Text style={styles.optionIcon}>📊</Text>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Barcode</Text>
                <Text style={styles.optionDesc}>Scan EAN/UPC on the box</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.optionCard}
              onPress={() => handleMethodSelect('text')}
            >
              <Text style={styles.optionIcon}>🔤</Text>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Text / OCR</Text>
                <Text style={styles.optionDesc}>Read title from cover</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.optionCard}
              onPress={() => handleMethodSelect('embedding')}
            >
              <Text style={styles.optionIcon}>🧠</Text>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Visual Match</Text>
                <Text style={styles.optionDesc}>AI-powered recognition</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowOptions(false)}
            >
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
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg.card,
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border.subtle,
    borderStyle: 'dashed',
  },
  cameraIcon: { fontSize: 56, marginBottom: 12, opacity: 0.4 },
  cameraText: { color: theme.text.primary, fontSize: 16, fontWeight: '600' },
  cameraSubtext: { color: theme.text.muted, fontSize: 13, marginTop: 4 },
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
