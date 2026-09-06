import { useLocalSearchParams } from 'expo-router';
import { GameDetail } from '@/screens/game-detail';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GameDetail id={id} />;
}
