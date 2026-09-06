import { useLocalSearchParams } from 'expo-router';
import { Scanner } from '@/screens/scanner';

export default function ScannerScreen() {
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  return <Scanner preset={preset} />;
}