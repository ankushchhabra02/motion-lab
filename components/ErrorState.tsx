import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  error?: Error;
  onRetry: () => void;
  title?: string;
};

/** Friendly crash screen with a retry, plus the message for debugging. */
export function ErrorState({ error, onRetry, title = 'Something went wrong' }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      <EmptyState
        icon="alert-circle-outline"
        title={title}
        message="The animation hit an error. Try again, and if it keeps happening, replay the demo from the gallery."
        actionLabel="Try again"
        onAction={onRetry}
      />
      {error ? (
        <AppText
          variant="caption"
          tone="tertiary"
          numberOfLines={8}
          selectable
          style={[styles.detail, { marginHorizontal: t.spacing.xl, marginBottom: t.spacing.xxl }]}
        >
          {error.message}
          {error.stack ? `\n${error.stack.split('\n').slice(1, 4).join('\n')}` : ''}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  detail: {
    textAlign: 'center',
  },
});
