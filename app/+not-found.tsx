import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/hooks/useTheme';

/** Shown for links to routes that don't exist, such as a favorite for a removed demo. */
export default function NotFoundScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState
        icon="compass-outline"
        title="That screen doesn't exist"
        message="The link points to a demo that isn't in this build."
        actionLabel="Back to gallery"
        onAction={() => router.replace('/gallery' as never)}
      />
    </View>
  );
}
