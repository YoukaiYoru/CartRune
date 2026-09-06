import { useLocalSearchParams } from 'expo-router';
import { GameReviews } from '@/screens/game-reviews';

export default function GameReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GameReviews id={id} />;
}
