import { BlurMask, Canvas, Circle, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const COVER_H = 150;
const HEADER_MAX = 312;
const HEADER_MIN = 56;
const TABS_H = 44;
const RANGE = HEADER_MAX - HEADER_MIN;
const AVATAR_MAX = 88;
const AVATAR_MIN = 36;
const TABS = ['Posts', 'Media', 'Likes'] as const;

const POSTS: { id: string; icon: IconName; title: string; body: string; likes: number }[] = [
  { id: 'p1', icon: 'color-wand', title: 'Spring presets I keep reusing', body: 'Snappy for UI moves, gentle for layout, jelly for squash and stretch.', likes: 214 },
  { id: 'p2', icon: 'speedometer', title: 'Profiling on a real device', body: 'The simulator lies about frame times. Always test on the phone.', likes: 168 },
  { id: 'p3', icon: 'layers', title: 'One shared value, many styles', body: 'Derive everything from a single scroll offset and the pieces stay in sync.', likes: 302 },
  { id: 'p4', icon: 'hand-left', title: 'Velocity makes it feel alive', body: 'Pass the release velocity into the spring and the motion never stutters.', likes: 97 },
  { id: 'p5', icon: 'color-palette', title: 'Skia for the parts Views cannot do', body: 'Gradients, glare, particles. Keep layout in Views, drawing in Skia.', likes: 251 },
  { id: 'p6', icon: 'eye', title: 'Respect Reduce Motion', body: 'Loops become still frames, transitions become fades. Nobody loses anything.', likes: 143 },
  { id: 'p7', icon: 'timer', title: 'Slow motion is a debugging tool', body: 'A 2x multiplier shows every overshoot you would otherwise miss.', likes: 88 },
  { id: 'p8', icon: 'cube', title: 'Perspective first', body: 'Put perspective before rotateX and rotateY or the tilt looks flat.', likes: 176 },
];

/**
 * Collapsing header. One `scrollY` shared value drives everything through
 * clamped interpolations: the header height, the cover parallax and stretch,
 * the avatar's translate+scale from its big spot to the compact bar, and the
 * fade of everything that doesn't fit in the compact state. The tabs row is
 * pinned to the header's bottom edge so it ends up docked under the bar.
 */
export default function CollapsingHeaderScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const [tab, setTab] = useState(0);
  const tabIndex = useSharedValue(0);
  const haptics = useHaptics();

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, RANGE], [HEADER_MAX, HEADER_MIN], Extrapolation.CLAMP) + TABS_H,
  }));

  // Pull down stretches the cover from its top edge; scrolling up slides it away a bit slower than the content.
  const coverStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const stretch = y < 0 ? (COVER_H - y) / COVER_H : 1;
    return {
      opacity: interpolate(y, [0, RANGE * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: y < 0 ? y / 2 : interpolate(y, [0, RANGE], [0, -RANGE * 0.4], Extrapolation.CLAMP) },
        { scale: stretch },
      ],
    };
  });

  const compactBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [RANGE * 0.6, RANGE], [0, 1], Extrapolation.CLAMP),
  }));

  // Avatar: big, overlapping the cover -> small, in the compact bar.
  const avatarStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE], [0, 1], Extrapolation.CLAMP);
    const startX = t.spacing.lg + AVATAR_MAX / 2;
    const startY = COVER_H;
    const endX = t.spacing.lg + AVATAR_MIN / 2;
    const endY = HEADER_MIN / 2;
    return {
      transform: [
        { translateX: (endX - startX) * p },
        { translateY: (endY - startY) * p },
        { scale: 1 - (1 - AVATAR_MIN / AVATAR_MAX) * p },
      ],
    };
  });

  const nameStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE], [0, 1], Extrapolation.CLAMP);
    const startX = t.spacing.lg;
    const startY = COVER_H + AVATAR_MAX / 2 + t.spacing.md;
    const endX = t.spacing.lg + AVATAR_MIN + t.spacing.md;
    const endY = HEADER_MIN / 2 - 11;
    return {
      transform: [{ translateX: (endX - startX) * p }, { translateY: (endY - startY) * p }, { scale: 1 - 0.3 * p }],
    };
  });

  const detailsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGE * 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, RANGE], [0, -RANGE * 0.6], Extrapolation.CLAMP) }],
  }));

  const followStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, RANGE], [COVER_H + t.spacing.md, (HEADER_MIN - 36) / 2], Extrapolation.CLAMP) },
    ],
  }));

  const tabWidth = (width - t.spacing.lg * 2) / TABS.length;
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndex.value * tabWidth }],
  }));

  return (
    <DemoScreen id="collapsing-header">
      <View style={styles.flex}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: HEADER_MAX + TABS_H + t.spacing.md,
            paddingHorizontal: t.spacing.lg,
            paddingBottom: t.spacing.xxxl,
            gap: t.spacing.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {POSTS.map((post) => (
            <View
              key={post.id}
              style={[
                styles.post,
                {
                  backgroundColor: t.colors.surface,
                  borderRadius: t.radii.lg,
                  padding: t.spacing.lg,
                  gap: t.spacing.md,
                  borderColor: t.colors.border,
                  borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
                },
                t.isDark ? null : t.shadows.card,
              ]}
            >
              <View style={[styles.postIcon, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.sm }]}>
                <Icon name={post.icon} size={18} tone="accent" />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodySemibold">{post.title}</AppText>
                <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                  {post.body}
                </AppText>
                <View style={[styles.likes, { marginTop: t.spacing.sm }]}>
                  <Icon name="heart" size={14} color={t.colors.heart} />
                  <AppText variant="caption" tone="tertiary">
                    {post.likes}
                  </AppText>
                </View>
              </View>
            </View>
          ))}
        </Animated.ScrollView>

        <Animated.View
          pointerEvents="box-none"
          style={[styles.header, { backgroundColor: t.colors.background }, headerStyle]}
        >
          <Animated.View style={[styles.cover, { width }, coverStyle]}>
            <Canvas style={{ width, height: COVER_H }}>
              <Rect x={0} y={0} width={width} height={COVER_H}>
                <LinearGradient start={vec(0, 0)} end={vec(width, COVER_H)} colors={[t.colors.accentStrong, t.colors.accent, t.colors.heart]} />
              </Rect>
              <Circle cx={width * 0.8} cy={COVER_H * 0.3} r={70} color={t.colors.glare}>
                <BlurMask blur={30} style="normal" />
              </Circle>
              <Circle cx={width * 0.25} cy={COVER_H * 1.1} r={90} color={t.colors.info}>
                <BlurMask blur={40} style="normal" />
              </Circle>
            </Canvas>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.compactBar,
              { height: HEADER_MIN, backgroundColor: t.colors.background, borderBottomColor: t.colors.border },
              compactBarStyle,
            ]}
          />

          <Animated.View style={[styles.details, { paddingHorizontal: t.spacing.lg }, detailsStyle]}>
            <AppText variant="caption" tone="secondary">
              @alex.motion · Lisbon
            </AppText>
            <AppText tone="secondary" style={{ marginTop: t.spacing.xs }}>
              Designing interfaces that move the way things do.
            </AppText>
            <View style={[styles.stats, { marginTop: t.spacing.md, gap: t.spacing.xl }]}>
              <Stat value="128" label="Posts" />
              <Stat value="24.1k" label="Followers" />
              <Stat value="412" label="Following" />
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.avatar,
              {
                left: t.spacing.lg,
                top: COVER_H - AVATAR_MAX / 2,
                borderColor: t.colors.background,
                backgroundColor: t.colors.accent,
              },
              avatarStyle,
            ]}
          >
            <AppText variant="title" tone="onAccent">
              A
            </AppText>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.name,
              { left: t.spacing.lg, top: COVER_H + AVATAR_MAX / 2 + t.spacing.md, transformOrigin: 'left center' },
              nameStyle,
            ]}
          >
            <AppText variant="title">Alex Rivera</AppText>
          </Animated.View>

          <Animated.View style={[styles.follow, { right: t.spacing.lg }, followStyle]}>
            <FollowButton />
          </Animated.View>

          <View style={[styles.tabs, { height: TABS_H, paddingHorizontal: t.spacing.lg, borderBottomColor: t.colors.border }]}>
            <Animated.View
              style={[
                styles.tabIndicator,
                { width: tabWidth, left: t.spacing.lg, backgroundColor: t.colors.accent },
                indicatorStyle,
              ]}
            />
            {TABS.map((label, i) => (
              <PressableScale
                key={label}
                haptic="none"
                scaleTo={0.95}
                onPress={() => {
                  if (i === tab) return;
                  haptics.selection();
                  setTab(i);
                  tabIndex.value = spring(i, springs.snappy);
                }}
                style={styles.tab}
                accessibilityLabel={`${label} tab`}
              >
                <AppText variant="caption" tone={i === tab ? 'primary' : 'tertiary'}>
                  {label}
                </AppText>
              </PressableScale>
            ))}
          </View>
        </Animated.View>
      </View>
    </DemoScreen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <AppText variant="bodySemibold">{value}</AppText>
      <AppText variant="caption" tone="tertiary">
        {label}
      </AppText>
    </View>
  );
}

function FollowButton() {
  const t = useTheme();
  const [following, setFollowing] = useState(false);
  return (
    <PressableScale
      onPress={() => setFollowing((f) => !f)}
      scaleTo={0.92}
      haptic={following ? 'light' : 'success'}
      accessibilityLabel={following ? 'Unfollow' : 'Follow'}
      style={[
        styles.followButton,
        {
          backgroundColor: following ? t.colors.surface : t.colors.accent,
          borderColor: t.colors.border,
          borderWidth: following ? StyleSheet.hairlineWidth : 0,
          borderRadius: t.radii.pill,
          paddingHorizontal: t.spacing.lg,
        },
      ]}
    >
      <AppText variant="caption" tone={following ? 'primary' : 'onAccent'}>
        {following ? 'Following' : 'Follow'}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: COVER_H,
    transformOrigin: 'top',
  },
  compactBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  details: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: COVER_H + AVATAR_MAX / 2 + 12 + 34,
  },
  avatar: {
    position: 'absolute',
    width: AVATAR_MAX,
    height: AVATAR_MAX,
    borderRadius: AVATAR_MAX / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    position: 'absolute',
  },
  follow: {
    position: 'absolute',
    top: 0,
  },
  followButton: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  stats: {
    flexDirection: 'row',
  },
  post: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  postIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
