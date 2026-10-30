import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/AppText';
import { DemoScreen } from '@/components/DemoScreen';
import { GlassSurface } from '@/components/GlassSurface';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { ReText } from '@/components/ReText';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { easings, motionScale, spring, springs, timing } from '@/lib/motion';

type Dish = { id: string; name: string; detail: string; price: number; icon: IconName; palette: number };

const MENU: Dish[] = [
  { id: 'pizza', name: 'Margherita', detail: 'San Marzano, basil, fior di latte', price: 14, icon: 'pizza', palette: 0 },
  { id: 'burger', name: 'Smash burger', detail: 'Double patty, pickles, secret sauce', price: 12.5, icon: 'fast-food', palette: 1 },
  { id: 'coffee', name: 'Flat white', detail: 'Single origin, oat milk', price: 4.5, icon: 'cafe', palette: 2 },
  { id: 'icecream', name: 'Gelato', detail: 'Pistachio and dark chocolate', price: 6, icon: 'ice-cream', palette: 3 },
  { id: 'salad', name: 'Garden bowl', detail: 'Quinoa, avocado, citrus dressing', price: 11, icon: 'nutrition', palette: 4 },
];

type Flyer = { id: number; icon: IconName; color: string; from: { x: number; y: number }; to: { x: number; y: number } };

const FLY_MS = 620;
const FLYER_SIZE = 44;

/**
 * Add to cart. When "+" is tapped, the handler (on the UI thread) measures the
 * dish icon, the cart button and the overlay root, then spawns a flyer with
 * window-relative start and end points. The flyer moves along a quadratic
 * Bezier whose control point is lifted above both ends, so it arcs up and
 * drops into the cart. On arrival the cart bounces and the count pops.
 */
export default function FoodOrderingScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  const overlayRef = useAnimatedRef<View>();
  const cartRef = useAnimatedRef<View>();
  const cartScale = useSharedValue(1);
  const cartWiggle = useSharedValue(0);
  const badgePop = useSharedValue(1);
  const total = useSharedValue(0);

  const palettes = [t.colors.heart, t.colors.warning, t.colors.accent, t.colors.info, t.colors.success];
  const count = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const totalPrice = MENU.reduce((sum, dish) => sum + (cart[dish.id] ?? 0) * dish.price, 0);

  useEffect(() => {
    total.value = timing(totalPrice, 500);
  }, [totalPrice, total]);

  const totalText = useDerivedValue(() => `$${total.value.toFixed(2)}`);

  const spawn = (flyer: Flyer) => setFlyers((f) => [...f, flyer]);

  const landed = (flyer: Flyer, dishId: string) => {
    setFlyers((f) => f.filter((x) => x.id !== flyer.id));
    setCart((c) => ({ ...c, [dishId]: (c[dishId] ?? 0) + 1 }));
    haptics.medium();
    cartScale.value = withSequence(timing(0.85, 70), spring(1.15, springs.bouncy), spring(1, springs.snappy));
    cartWiggle.value = withSequence(timing(-10, 60), spring(0, springs.jelly));
    badgePop.value = withSequence(timing(1.5, 80, easings.out), spring(1, springs.bouncy));
  };

  const cartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cartScale.value }, { rotate: `${cartWiggle.value}deg` }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgePop.value }] }));

  return (
    <DemoScreen id="food-ordering">
      <View ref={overlayRef} style={styles.flex} collapsable={false}>
        <View style={[styles.topBar, { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm }]}>
          <View>
            <AppText variant="heading">Lunch menu</AppText>
            <AppText variant="caption" tone="secondary">
              Tap + to add. Watch it fly.
            </AppText>
          </View>
          <Animated.View style={cartStyle}>
            <View
              ref={cartRef}
              collapsable={false}
              accessible
              accessibilityLabel={`Cart, ${count} items`}
              style={[
                styles.cart,
                { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0 },
                t.isDark ? null : t.shadows.card,
              ]}
            >
              <Icon name="cart" size={22} tone={count > 0 ? 'accent' : 'secondary'} />
              {count > 0 ? (
                <Animated.View style={[styles.badge, { backgroundColor: t.colors.heart, borderColor: t.colors.background }, badgeStyle]}>
                  <AppText variant="label" tone="onAccent" style={styles.badgeText}>
                    {count}
                  </AppText>
                </Animated.View>
              ) : null}
            </View>
          </Animated.View>
        </View>

        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {MENU.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              color={palettes[dish.palette % palettes.length] ?? palettes[0]!}
              quantity={cart[dish.id] ?? 0}
              overlayRef={overlayRef}
              cartRef={cartRef}
              onSpawn={spawn}
            />
          ))}
        </ScrollView>

        <View style={[styles.checkout, { padding: t.spacing.lg, paddingBottom: t.spacing.xl }]} pointerEvents="box-none">
          <PressableScale
            onPress={() => {
              if (count === 0) return;
              haptics.success();
              setCart({});
            }}
            scaleTo={0.97}
            haptic="none"
            accessibilityLabel="Checkout"
          >
            <GlassSurface
              radius={t.radii.lg}
              tint={count > 0 ? 'accent' : 'none'}
              interactive
              style={[styles.checkoutButton, { paddingHorizontal: t.spacing.xl }]}
            >
              <AppText variant="bodySemibold" tone={count > 0 ? 'onAccent' : 'tertiary'}>
                {count > 0 ? `Checkout · ${count} item${count === 1 ? '' : 's'}` : 'Your cart is empty'}
              </AppText>
              <ReText text={totalText} style={[t.typography.bodySemibold, { color: count > 0 ? t.colors.onAccent : t.colors.textTertiary, minWidth: 70, textAlign: 'right' }]} />
            </GlassSurface>
          </PressableScale>
        </View>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {flyers.map((flyer) => (
            <FlyingItem key={flyer.id} flyer={flyer} onLanded={() => landed(flyer, flyerDish(flyer))} />
          ))}
        </View>
      </View>
    </DemoScreen>
  );
}

const flyerDish = (flyer: Flyer) => MENU.find((d) => d.icon === flyer.icon)?.id ?? MENU[0]!.id;
let flyerId = 0;

function DishRow({
  dish,
  color,
  quantity,
  overlayRef,
  cartRef,
  onSpawn,
}: {
  dish: Dish;
  color: string;
  quantity: number;
  overlayRef: ReturnType<typeof useAnimatedRef<View>>;
  cartRef: ReturnType<typeof useAnimatedRef<View>>;
  onSpawn: (flyer: Flyer) => void;
}) {
  const t = useTheme();
  const haptics = useHaptics();
  const onTap = haptics.light;
  const iconRef = useAnimatedRef<View>();
  const buttonScale = useSharedValue(1);

  const spawnFlyer = (fromX: number, fromY: number, toX: number, toY: number) => {
    onSpawn({ id: ++flyerId, icon: dish.icon, color, from: { x: fromX, y: fromY }, to: { x: toX, y: toY } });
  };

  const add = useTapGesture({
    maxDuration: 6000,
    maxDistance: 24,
    onBegin: () => {
      'worklet';
      buttonScale.value = spring(0.85, springs.press);
    },
    onActivate: () => {
      'worklet';
      const from = measure(iconRef);
      const to = measure(cartRef);
      const root = measure(overlayRef);
      if (from && to && root) {
        scheduleOnRN(
          spawnFlyer,
          from.pageX - root.pageX + from.width / 2,
          from.pageY - root.pageY + from.height / 2,
          to.pageX - root.pageX + to.width / 2,
          to.pageY - root.pageY + to.height / 2,
        );
      }
      scheduleOnRN(onTap);
    },
    onFinalize: () => {
      'worklet';
      buttonScale.value = spring(1, springs.bouncy);
    },
  });

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));

  return (
    <View
      style={[
        styles.dish,
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.lg,
          padding: t.spacing.md,
          gap: t.spacing.md,
          borderColor: t.colors.border,
          borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
        },
        t.isDark ? null : t.shadows.card,
      ]}
    >
      <View ref={iconRef} collapsable={false} style={[styles.dishIcon, { backgroundColor: color, borderRadius: t.radii.md }]}>
        <Icon name={dish.icon} size={26} tone="onAccent" />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodySemibold">{dish.name}</AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {dish.detail}
        </AppText>
        <AppText variant="caption" tone="accent" style={{ marginTop: 2 }}>
          ${dish.price.toFixed(2)}
          {quantity > 0 ? `  ·  ×${quantity}` : ''}
        </AppText>
      </View>
      <GestureDetector gesture={add}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Add ${dish.name} to cart`}
          style={[styles.addButton, { backgroundColor: t.colors.accent }, buttonStyle]}
        >
          <Icon name="add" size={22} tone="onAccent" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** One flying copy of a dish icon. Progress 0..1 along a quadratic Bezier. */
function FlyingItem({ flyer, onLanded }: { flyer: Flyer; onLanded: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: FLY_MS * motionScale.get(), easing: easings.inOut }, (finished) => {
      if (finished) scheduleOnRN(onLanded);
    });
    // Runs once per flyer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const u = progress.value;
    const { from, to } = flyer;
    // Control point: horizontally between the ends, lifted well above both.
    const cx = (from.x + to.x) / 2;
    const cy = Math.min(from.y, to.y) - 140;
    const oneMinus = 1 - u;
    const x = oneMinus * oneMinus * from.x + 2 * oneMinus * u * cx + u * u * to.x;
    const y = oneMinus * oneMinus * from.y + 2 * oneMinus * u * cy + u * u * to.y;
    return {
      opacity: interpolate(u, [0, 0.85, 1], [1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: x - FLYER_SIZE / 2 },
        { translateY: y - FLYER_SIZE / 2 },
        { scale: interpolate(u, [0, 0.5, 1], [1, 0.9, 0.35], Extrapolation.CLAMP) },
        { rotate: `${u * 180}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.flyer, { backgroundColor: flyer.color }, style]}>
      <Icon name={flyer.icon} size={22} tone="onAccent" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cart: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 13,
  },
  dish: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dishIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkout: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  checkoutButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flyer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FLYER_SIZE,
    height: FLYER_SIZE,
    borderRadius: FLYER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
