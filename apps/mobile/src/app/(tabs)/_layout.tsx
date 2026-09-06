import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme';

const AnimatedView = Animated.createAnimatedComponent(View);

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const scale = useSharedValue(focused ? 1.1 : 1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (focused) scale.value = withSpring(1.1, { damping: 12, stiffness: 300 });
  else scale.value = withSpring(1, { damping: 12, stiffness: 300 });

  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    Home: 'home',
    Library: 'library',
    Scanner: 'scan',
    Discover: 'search',
    Profile: 'person',
  };

  return (
    <AnimatedView style={[styles.iconWrap, animatedStyle]}>
      <Ionicons
        name={iconMap[name] || 'ellipse'}
        size={20}
        color={focused ? theme.accent.warm : theme.text.muted}
      />
    </AnimatedView>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.bg.card,
          borderTopColor: theme.border.subtle,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.accent.warm,
        tabBarInactiveTintColor: theme.text.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Shelf',
          tabBarIcon: ({ focused }) => <TabIcon name="Library" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => <TabIcon name="Scanner" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabIcon name="Discover" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 28,
  },
});
