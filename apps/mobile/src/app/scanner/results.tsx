import { useLocalSearchParams } from 'expo-router';
import { ScannerResults } from '@/screens/scanner-results';

export default function ScannerResultsScreen() {
  const { method } = useLocalSearchParams<{ method: string }>();
  return <ScannerResults method={method || 'embedding'} />;
}
