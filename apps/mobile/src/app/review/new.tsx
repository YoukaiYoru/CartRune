import { useLocalSearchParams } from 'expo-router';
import { ReviewForm } from '@/screens/review-form';

export default function ReviewFormScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  return <ReviewForm gameId={gameId} />;
}