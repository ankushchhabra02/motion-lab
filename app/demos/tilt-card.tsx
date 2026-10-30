import { BlurMask, Canvas, Circle, LinearGradient, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const MAX_TILT = 14;

/**
 * 3D tilt. Finger position maps to rotateX / rotateY around the card center
 * (top edge pressed tips the top away, right edge tips the right away), with
 * `perspective` first in the transform list so the rotation has depth. The
 * glare is a Skia radial gradient centered on the finger with a slight spring
 * lag, and the text layers shift opposite to the tilt for extra parallax.
 */
export default function TiltCardScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - t.spacing.xl * 2, 360);
  const cardH = Math.round(cardW / 1.586);

  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const pressed = useSharedValue(0);
  const glareX = useSharedValue(cardW * 0.3);
  const glareY = useSharedValue(cardH * 0.25);

  const setTilt = (x: number, y: number) => {
    'worklet';
    const nx = Math.max(-1, Math.min(1, (x / cardW) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, (y / cardH) * 2 - 1));
    rotateY.value = nx * MAX_TILT;
    rotateX.value = -ny * MAX_TILT;
    glareX.value = spring(x, springs.stiff);
    glareY.value = spring(y, springs.stiff);
  };

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      pressed.value = spring(1, springs.press);
      setTilt(e.x, e.y);
    },
    onUpdate: (e) => {
      'worklet';
      setTilt(e.x, e.y);
    },
    onFinalize: () => {
      'worklet';
      pressed.value = spring(0, springs.gentle);
      rotateX.value = spring(0, springs.gentle);
      rotateY.value = spring(0, springs.gentle);
      glareX.value = spring(cardW * 0.3, springs.gentle);
      glareY.value = spring(cardH * 0.25, springs.gentle);
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: 1 + pressed.value * 0.04 },
    ],
    shadowOffset: { width: -rotateY.value * 0.9, height: 14 + rotateX.value * 0.9 },
    shadowOpacity: 0.22 + pressed.value * 0.14,
  }));
  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -rotateY.value * 0.7 }, { translateY: rotateX.value * 0.7 }],
  }));

  const glareCenter = useDerivedValue(() => vec(glareX.value, glareY.value));
  const glareRadius = cardW * 0.75;

  return (
    <DemoScreen id="tilt-card">
      <View style={styles.center}>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessible
            accessibilityLabel="Membership card. Touch and move to tilt."
            style={[
              {
                width: cardW,
                height: cardH,
                borderRadius: t.radii.lg,
                backgroundColor: t.colors.accentStrong,
                shadowColor: t.shadows.floating.shadowColor,
                shadowRadius: 28,
              },
              cardStyle,
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { borderRadius: t.radii.lg, overflow: 'hidden' }]}>
              <Canvas style={{ width: cardW, height: cardH }}>
                <Rect x={0} y={0} width={cardW} height={cardH}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(cardW, cardH)}
                    colors={[t.colors.accentStrong, t.colors.accent, t.colors.heart]}
                    positions={[0, 0.55, 1]}
                  />
                </Rect>
                <Circle cx={cardW * 0.85} cy={cardH * 0.15} r={cardW * 0.28} color={t.colors.glare}>
                  <BlurMask blur={36} style="normal" />
                </Circle>
                <Circle cx={cardW * 0.1} cy={cardH * 0.95} r={cardW * 0.22} color={t.colors.accentStrong}>
                  <BlurMask blur={30} style="normal" />
                </Circle>
                <RoundedRect x={24} y={cardH * 0.42} width={44} height={32} r={6}>
                  <LinearGradient start={vec(24, 0)} end={vec(68, 32)} colors={[t.colors.warning, t.colors.heart]} />
                </RoundedRect>
                <Rect x={0} y={0} width={cardW} height={cardH}>
                  <RadialGradient c={glareCenter} r={glareRadius} colors={[t.colors.glare, t.colors.glareClear]} />
                </Rect>
              </Canvas>
              <Animated.View style={[StyleSheet.absoluteFill, { padding: t.spacing.xl }, parallaxStyle]}>
                <View style={styles.topRow}>
                  <AppText variant="label" tone="onAccent" style={{ opacity: 0.85 }}>
                    MOTION LAB
                  </AppText>
                  <Icon name="wifi" size={18} color={t.colors.onAccent} />
                </View>
                <View style={styles.flexEnd}>
                  <AppText variant="heading" tone="onAccent" style={styles.number}>
                    ••••  ••••  ••••  2026
                  </AppText>
                  <View style={styles.bottomRow}>
                    <View>
                      <AppText variant="label" tone="onAccent" style={{ opacity: 0.7 }}>
                        MEMBER
                      </AppText>
                      <AppText variant="bodySemibold" tone="onAccent">
                        Alex Rivera
                      </AppText>
                    </View>
                    <View style={styles.alignEnd}>
                      <AppText variant="label" tone="onAccent" style={{ opacity: 0.7 }}>
                        SINCE
                      </AppText>
                      <AppText variant="bodySemibold" tone="onAccent">
                        10 / 26
                      </AppText>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </View>
          </Animated.View>
        </GestureDetector>
        <AppText variant="caption" tone="tertiary" style={{ marginTop: t.spacing.xxl, textAlign: 'center' }}>
          Touch anywhere on the card and move your finger.
        </AppText>
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  topRow: {
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
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
});
