import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/hooks/useTheme';
import { easings, staggerIn, timing } from '@/lib/motion';

type Props = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Animated empty state: the icon floats up and down while a ring pulses out
 * behind it. Both loops are skipped when Reduce Motion is on.
 */
export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    float.value = withRepeat(
      withSequence(timing(1, 1400, easings.inOut), timing(0, 1400, easings.inOut)),
      -1,
      false,
    );
    pulse.value = withRepeat(timing(1, 2000, easings.out), -1, false);
    return () => {
      cancelAnimation(float);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, float, pulse]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * float.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.6,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  return (
    <View style={[styles.container, { padding: t.spacing.xxl }]}>
      <Animated.View entering={staggerIn(0)} style={styles.iconArea}>
        <Animated.View style={[styles.ring, { borderColor: t.colors.accent }, ringStyle]} />
        <Animated.View style={[styles.iconCircle, { backgroundColor: t.colors.accentSoft }, iconStyle]}>
          <Icon name={icon} size={36} tone="accent" />
        </Animated.View>
      </Animated.View>
      <Animated.View entering={staggerIn(1)}>
        <AppText variant="heading" style={styles.centerText}>
          {title}
        </AppText>
      </Animated.View>
      <Animated.View entering={staggerIn(2)}>
        <AppText tone="secondary" style={[styles.centerText, { marginTop: t.spacing.sm }]}>
          {message}
        </AppText>
      </Animated.View>
      {actionLabel && onAction ? (
        <Animated.View entering={staggerIn(3)}>
          <PressableScale
            onPress={onAction}
            scaleTo={0.95}
            style={{
              marginTop: t.spacing.xl,
              backgroundColor: t.colors.accent,
              borderRadius: t.radii.pill,
              paddingHorizontal: t.spacing.xl,
              paddingVertical: t.spacing.md,
            }}
          >
            <AppText variant="bodySemibold" tone="onAccent">
              {actionLabel}
            </AppText>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
});
