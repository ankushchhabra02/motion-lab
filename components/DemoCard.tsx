import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import type { Demo } from '@/data/demos';
import { useFavorites } from '@/hooks/useFavorites';
import { useTheme } from '@/hooks/useTheme';
import { fadeOut, layoutSpring, scaled, staggerIn } from '@/lib/motion';

type Props = {
  demo: Demo;
  index: number;
  width: number;
  onPress: (demo: Demo) => void;
};

export const CARD_HEIGHT = 156;

/**
 * Gallery card. The outer Animated.View owns the entering stagger, the exit
 * fade and the layout transition (so cards glide into new spots when a filter
 * removes their neighbors). The inner PressableScale owns the press squish.
 */
export function DemoCard({ demo, index, width, onPress }: Props) {
  const t = useTheme();
  const { isFavorite } = useFavorites();
  const favorite = isFavorite(demo.id);

  return (
    <Animated.View entering={staggerIn(index)} exiting={fadeOut()} layout={layoutSpring()} style={{ width }}>
      <PressableScale
        onPress={() => onPress(demo)}
        scaleTo={0.96}
        haptic={demo.ready ? 'light' : 'warning'}
        accessibilityLabel={`${demo.title}, ${demo.category}${demo.ready ? '' : ', coming soon'}${favorite ? ', favorite' : ''}`}
        accessibilityHint={demo.ready ? 'Opens the demo' : 'Not available yet'}
        style={[
          styles.card,
          {
            height: CARD_HEIGHT,
            padding: t.spacing.lg,
            borderRadius: t.radii.lg,
            backgroundColor: t.colors.surface,
            borderColor: t.colors.border,
            borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
            opacity: demo.ready ? 1 : 0.72,
          },
          t.isDark ? null : t.shadows.card,
        ]}
      >
        <View style={styles.topRow}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.sm },
            ]}
          >
            <Icon name={demo.icon} size={20} tone="accent" />
          </View>
          <View style={styles.badges}>
            {favorite ? (
              <Animated.View entering={ZoomIn.duration(scaled(220))} exiting={ZoomOut.duration(scaled(160))}>
                <Icon name="heart" size={16} color={t.colors.heart} />
              </Animated.View>
            ) : null}
            {!demo.ready ? (
              <View style={[styles.soon, { backgroundColor: t.colors.background, borderRadius: t.radii.pill }]}>
                <AppText variant="label" tone="tertiary">
                  SOON
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <View>
          <AppText variant="bodySemibold" numberOfLines={2}>
            {demo.title}
          </AppText>
          <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {demo.category}
          </AppText>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soon: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
