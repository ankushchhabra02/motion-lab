import { BlurMask, Canvas, Circle, LinearGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { EmptyState } from '@/components/EmptyState';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

type Card = { id: string; bank: string; last4: string; holder: string; expiry: string; icon: IconName; palette: number };

const CARDS: Card[] = [
  { id: 'c1', bank: 'Motion Bank', last4: '4821', holder: 'Alex Rivera', expiry: '09/29', icon: 'flash', palette: 0 },
  { id: 'c2', bank: 'Northwind', last4: '1177', holder: 'Alex Rivera', expiry: '02/28', icon: 'leaf', palette: 1 },
  { id: 'c3', bank: 'Aurora Credit', last4: '9034', holder: 'Alex Rivera', expiry: '11/30', icon: 'sparkles', palette: 2 },
  { id: 'c4', bank: 'Tidal', last4: '6652', holder: 'Alex Rivera', expiry: '06/27', icon: 'water', palette: 3 },
];

const STACK_OFFSET = 52;
const GAP = 14;

/**
 * Wallet. `expand` (0..1) morphs the stack (each card offset by 52pt, scaled
 * down a touch) into a list (each card offset by its full height). Each card's
 * list position is a spring-animated index, so removing one glides the others
 * up. Tapping a card flips it: two faces with backfaceVisibility hidden rotate
 * around Y, 180° apart, so exactly one is visible at any angle.
 */
export default function WalletScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const cardW = width - t.spacing.lg * 2;
  const cardH = Math.round(cardW / 1.586);

  const [cards, setCards] = useState(CARDS);
  const [expanded, setExpanded] = useState(false);
  const expand = useSharedValue(0);

  const setExpansion = (next: boolean) => {
    setExpanded(next);
    expand.value = spring(next ? 1 : 0, springs.gentle);
    haptics.light();
  };

  const palettes: [string, string][] = [
    [t.colors.accentStrong, t.colors.accent],
    [t.colors.success, t.colors.info],
    [t.colors.heart, t.colors.warning],
    [t.colors.info, t.colors.accentStrong],
  ];

  const containerHeight = cards.length === 0 ? 0 : Math.max(cardH + (cards.length - 1) * STACK_OFFSET, cards.length * (cardH + GAP) - GAP);

  return (
    <DemoScreen id="wallet">
      <View style={[styles.flex, { padding: t.spacing.lg }]}>
        <View style={styles.topRow}>
          <View>
            <AppText variant="heading">Cards</AppText>
            <AppText variant="caption" tone="secondary">
              {cards.length === 0 ? 'No cards' : expanded ? 'Tap to flip · swipe to remove' : 'Tap the stack to fan out'}
            </AppText>
          </View>
          {cards.length > 0 ? (
            <PressableScale
              onPress={() => setExpansion(!expanded)}
              scaleTo={0.92}
              haptic="none"
              accessibilityLabel={expanded ? 'Stack cards' : 'Fan out cards'}
              style={[styles.toggle, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.pill, paddingHorizontal: t.spacing.md }]}
            >
              <Icon name={expanded ? 'albums-outline' : 'list-outline'} size={16} tone="accent" />
              <AppText variant="caption" tone="accent">
                {expanded ? 'Stack' : 'Fan out'}
              </AppText>
            </PressableScale>
          ) : null}
        </View>

        {cards.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="Wallet is empty"
            message="You swiped every card away. Restore them to keep playing."
            actionLabel="Restore cards"
            onAction={() => {
              setCards(CARDS);
              setExpansion(false);
            }}
          />
        ) : (
          <View style={{ height: containerHeight, marginTop: t.spacing.xl }}>
            {cards.map((card, index) => (
              <WalletCard
                key={card.id}
                card={card}
                colors={palettes[card.palette % palettes.length] ?? palettes[0]!}
                index={index}
                width={cardW}
                height={cardH}
                expand={expand}
                expanded={expanded}
                onExpand={() => setExpansion(true)}
                onDismiss={() => setCards((current) => current.filter((c) => c.id !== card.id))}
              />
            ))}
          </View>
        )}

        {cards.length > 0 && cards.length < CARDS.length ? (
          <PressableScale
            onPress={() => setCards(CARDS)}
            scaleTo={0.96}
            accessibilityLabel="Restore removed cards"
            style={[styles.restore, { marginTop: t.spacing.xl }]}
          >
            <Icon name="refresh" size={16} tone="accent" />
            <AppText variant="caption" tone="accent">
              Restore removed cards
            </AppText>
          </PressableScale>
        ) : null}
      </View>
    </DemoScreen>
  );
}

type CardProps = {
  card: Card;
  colors: [string, string];
  index: number;
  width: number;
  height: number;
  expand: SharedValue<number>;
  expanded: boolean;
  onExpand: () => void;
  onDismiss: () => void;
};

function WalletCard({ card, colors, index, width, height, expand, expanded, onExpand, onDismiss }: CardProps) {
  const t = useTheme();
  const haptics = useHaptics();
  const onFlip = haptics.medium;
  const onCross = haptics.light;
  const onGone = haptics.medium;

  const animIndex = useDerivedValue(() => spring(index, springs.gentle));
  const flip = useSharedValue(0);
  const tx = useSharedValue(0);
  const passed = useSharedValue(0);
  const leaving = useSharedValue(0);
  const threshold = width * 0.4;

  const tap = useTapGesture({
    maxDistance: 16,
    onActivate: () => {
      'worklet';
      if (!expanded) {
        scheduleOnRN(onExpand);
        return;
      }
      flip.value = spring(flip.value > 0.5 ? 0 : 1, springs.gentle);
      scheduleOnRN(onFlip);
    },
  });

  const pan = usePanGesture({
    enabled: expanded,
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      if (leaving.value === 1) return;
      tx.value = e.translationX;
      const past = Math.abs(e.translationX) > threshold ? 1 : 0;
      if (past !== passed.value) {
        passed.value = past;
        if (past === 1) scheduleOnRN(onCross);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (leaving.value === 1) return;
      const flick = Math.abs(e.velocityX) > 900;
      if (!e.canceled && (Math.abs(e.translationX) > threshold || flick)) {
        leaving.value = 1;
        const direction = Math.sign(e.translationX || e.velocityX) || 1;
        tx.value = spring(direction * width * 1.4, springs.stiff, e.velocityX, (finished) => {
          if (finished) scheduleOnRN(onDismiss);
        });
        scheduleOnRN(onGone);
      } else {
        passed.value = 0;
        tx.value = spring(0, springs.snappy, e.velocityX);
      }
    },
  });

  const containerStyle = useAnimatedStyle(() => {
    const stackedY = animIndex.value * STACK_OFFSET;
    const listY = animIndex.value * (height + GAP);
    const flipLift = Math.sin(flip.value * Math.PI) * 0.05;
    return {
      opacity: interpolate(Math.abs(tx.value), [0, width], [1, 0.4], Extrapolation.CLAMP),
      transform: [
        { translateX: tx.value },
        { translateY: interpolate(expand.value, [0, 1], [stackedY, listY]) },
        { scale: interpolate(expand.value, [0, 1], [1 - animIndex.value * 0.035, 1]) + flipLift },
        { rotate: `${(tx.value / width) * 6}deg` },
      ],
    };
  });
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${180 + flip.value * 180}deg` }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { width, height, borderRadius: t.radii.lg }, t.isDark ? null : t.shadows.floating, containerStyle]}>
        <GestureDetector gesture={tap}>
          <View
            accessible
            accessibilityLabel={`${card.bank} ending in ${card.last4}`}
            accessibilityHint={expanded ? 'Tap to flip, swipe to remove' : 'Tap to fan out'}
            style={styles.flex}
          >
            <Animated.View style={[styles.face, { borderRadius: t.radii.lg }, frontStyle]}>
              <Canvas style={{ width, height }}>
                <Rect x={0} y={0} width={width} height={height}>
                  <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={colors} />
                </Rect>
                <Circle cx={width * 0.85} cy={height * 0.2} r={width * 0.3} color={t.colors.glare}>
                  <BlurMask blur={40} style="normal" />
                </Circle>
                <Circle cx={width * 0.15} cy={height} r={width * 0.25} color={colors[0]}>
                  <BlurMask blur={30} style="normal" />
                </Circle>
                <RoundedRect x={24} y={height * 0.4} width={42} height={30} r={6}>
                  <LinearGradient start={vec(24, 0)} end={vec(66, 30)} colors={[t.colors.warning, t.colors.heart]} />
                </RoundedRect>
              </Canvas>
              <View style={[StyleSheet.absoluteFill, { padding: t.spacing.xl }]}>
                <View style={styles.rowBetween}>
                  <AppText variant="label" tone="onAccent" style={{ opacity: 0.9 }}>
                    {card.bank.toUpperCase()}
                  </AppText>
                  <Icon name={card.icon} size={20} color={t.colors.onAccent} />
                </View>
                <View style={styles.flexEnd}>
                  <AppText variant="heading" tone="onAccent" style={styles.number}>
                    ••••  ••••  ••••  {card.last4}
                  </AppText>
                  <View style={[styles.rowBetween, { marginTop: 6 }]}>
                    <AppText variant="caption" tone="onAccent">
                      {card.holder}
                    </AppText>
                    <AppText variant="caption" tone="onAccent">
                      {card.expiry}
                    </AppText>
                  </View>
                </View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.face, { borderRadius: t.radii.lg, backgroundColor: t.colors.surfaceElevated }, backStyle]}>
              <Canvas style={{ width, height }}>
                <Rect x={0} y={0} width={width} height={height}>
                  <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[colors[1], colors[0]]} />
                </Rect>
                <Rect x={0} y={height * 0.18} width={width} height={height * 0.2} color={t.colors.text} />
                <RoundedRect x={24} y={height * 0.5} width={width - 48} height={34} r={6} color={t.colors.surface} />
              </Canvas>
              <View style={[StyleSheet.absoluteFill, { paddingHorizontal: t.spacing.xl }]}>
                <View style={[styles.cvvRow, { top: height * 0.5 + 8 }]}>
                  <AppText variant="caption" tone="tertiary" style={styles.signature}>
                    Authorized signature
                  </AppText>
                  <AppText variant="bodySemibold" style={{ color: t.colors.text }}>
                    CVV {card.last4.slice(1)}
                  </AppText>
                </View>
                <AppText variant="label" tone="onAccent" style={[styles.backFooter, { opacity: 0.8 }]}>
                  TAP TO FLIP BACK
                </AppText>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
  },
  restore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flexEnd: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  number: {
    letterSpacing: 1.5,
  },
  cvvRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 18,
  },
  signature: {
    fontStyle: 'italic',
  },
  backFooter: {
    position: 'absolute',
    bottom: 16,
    left: 24,
  },
});
