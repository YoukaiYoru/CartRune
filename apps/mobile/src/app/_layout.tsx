import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';

const queryClient = new QueryClient();

export default function RootLayout() {
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a0a' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scanner/results" options={{ presentation: 'modal' }} />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="game/[id]/reviews" />
        <Stack.Screen name="review/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="feed/index" />
      </Stack>
    </QueryClientProvider>
  );
}
