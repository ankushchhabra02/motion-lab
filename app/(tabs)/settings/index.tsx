import SegmentedControl from '@react-native-segmented-control/segmented-control';
import Constants from 'expo-constants';
import { useEffect, type ComponentType, type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import pkg from '@/package.json';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { useGlass } from '@/hooks/useGlass';
import { useHaptics } from '@/hooks/useHaptics';
import { useSettings, type AnimationSpeed, type ThemeMode } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { spring, springs } from '@/lib/motion';

const THEME_VALUES: ThemeMode[] = ['system', 'light', 'dark'];
const THEME_LABELS = ['System', 'Light', 'Dark'];
const SPEED_VALUES: AnimationSpeed[] = [0.5, 1, 2];
const SPEED_LABELS = ['0.5×', '1×', '2×'];

const clean = (v: string | undefined) => (v ?? '').replace(/^[~^]/, '');

// The package ships pre-React-19 class typings; the native component itself is fine.
type NativeSegmentedProps = {
  values: string[];
  selectedIndex: number;
  onChange: (event: { nativeEvent: { selectedSegmentIndex: number } }) => void;
  appearance?: 'light' | 'dark';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};
const NativeSegmented = SegmentedControl as unknown as ComponentType<NativeSegmentedProps>;

/** Settings use the real iOS switch and segmented control; the custom versions live in the demos. */
export default function SettingsScreen() {
  const t = useTheme();
  const haptics = useHaptics();
  const { settings, update } = useSettings();
  const glass = useGlass();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl * 2 }}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: t.colors.background }}
    >
      <SettingsCard title="Appearance" icon="contrast-outline">
        <NativeSegmented
          values={THEME_LABELS}
          selectedIndex={Math.max(0, THEME_VALUES.indexOf(settings.themeMode))}
          appearance={t.scheme}
          onChange={(e) => {
            haptics.selection();
            update({ themeMode: THEME_VALUES[e.nativeEvent.selectedSegmentIndex] ?? 'system' });
          }}
          accessibilityLabel="Theme"
        />
      </SettingsCard>

      <SettingsCard title="Feedback" icon="pulse-outline">
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="bodyMedium">Haptics</AppText>
            <AppText variant="caption" tone="secondary">
              Tactile feedback on taps and gestures
            </AppText>
          </View>
          <Switch
            value={settings.haptics}
            onValueChange={(haptics) => update({ haptics })}
            trackColor={{ true: t.colors.accent }}
            accessibilityLabel="Haptics"
          />
        </View>
      </SettingsCard>

      <SettingsCard title="Animation speed" icon="speedometer-outline">
        <NativeSegmented
          values={SPEED_LABELS}
          selectedIndex={Math.max(0, SPEED_VALUES.indexOf(settings.speed))}
          appearance={t.scheme}
          onChange={(e) => {
            haptics.selection();
            update({ speed: SPEED_VALUES[e.nativeEvent.selectedSegmentIndex] ?? 1 });
          }}
          accessibilityLabel="Animation speed"
        />
        <AppText variant="caption" tone="secondary" style={{ marginTop: t.spacing.md }}>
          Multiplies the duration of every animation in the app. 2× is slow motion for studying the details.
        </AppText>
        <SpeedPreview speed={settings.speed} />
      </SettingsCard>

      <SettingsCard title="About" icon="information-circle-outline">
        <InfoRow label="Version" value={Constants.expoConfig?.version ?? pkg.version} />
        <InfoRow label="Expo SDK" value={clean(Constants.expoConfig?.sdkVersion ?? pkg.dependencies.expo)} />
        <InfoRow label="Reanimated" value={clean(pkg.dependencies['react-native-reanimated'])} />
        <InfoRow label="Gesture Handler" value={clean(pkg.dependencies['react-native-gesture-handler'])} />
        <InfoRow label="Skia" value={clean(pkg.dependencies['@shopify/react-native-skia'])} />
        <InfoRow
          label="Liquid Glass"
          value={glass.reduceTransparency ? 'Off (Reduce Transparency)' : glass.liquidGlass ? 'On' : 'Unavailable, using blur'}
          last
        />
        <AppText variant="caption" tone="tertiary" style={{ marginTop: t.spacing.lg }}>
          Motion Lab is a gallery of animation experiments built with Expo. Every animation runs on the UI thread.
        </AppText>
      </SettingsCard>
    </ScrollView>
  );
}

function SettingsCard({ title, icon, children }: PropsWithChildren<{ title: string; icon: IconName }>) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.lg,
          padding: t.spacing.lg,
          borderColor: t.colors.border,
          borderWidth: t.isDark ? StyleSheet.hairlineWidth : 0,
        },
        t.isDark ? null : t.shadows.card,
      ]}
    >
      <View style={[styles.cardTitle, { marginBottom: t.spacing.lg }]}>
        <Icon name={icon} size={18} tone="accent" />
        <AppText variant="heading">{title}</AppText>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          paddingVertical: t.spacing.md,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: t.colors.border,
        },
      ]}
    >
      <AppText variant="bodyMedium">{label}</AppText>
      <AppText tone="secondary">{value}</AppText>
    </View>
  );
}

const BALL = 22;

/**
 * Live preview of the speed setting: the ball springs to the other side every
 * time the multiplier changes (and on tap), using the same `spring()` helper
 * the demos use, so what you see is exactly what the setting does.
 */
function SpeedPreview({ speed }: { speed: AnimationSpeed }) {
  const t = useTheme();
  const trackWidth = useSharedValue(0);
  const position = useSharedValue(0);

  const bounce = () => {
    position.value = spring(position.get() > 0.5 ? 0 : 1, springs.bouncy);
  };

  useEffect(() => {
    bounce();
    // Only re-run when the speed changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * Math.max(0, trackWidth.value - BALL) }],
  }));

  return (
    <PressableScale onPress={bounce} scaleTo={0.98} haptic="selection" accessibilityLabel="Preview animation speed">
      <View
        onLayout={(e) => {
          trackWidth.value = e.nativeEvent.layout.width - t.spacing.sm * 2;
        }}
        style={[styles.previewTrack, { marginTop: t.spacing.lg, backgroundColor: t.colors.background, borderRadius: t.radii.pill, padding: t.spacing.sm }]}
      >
        <Animated.View style={[styles.ball, { backgroundColor: t.colors.accent }, ballStyle]} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTrack: {
    justifyContent: 'center',
  },
  ball: {
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
  },
});
