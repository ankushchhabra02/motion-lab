import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { CATEGORY_ICONS, findDemo } from '@/data/demos';
import { useTheme } from '@/hooks/useTheme';

/**
 * Native form sheet (sized to its content) describing a demo. Content must
 * have intrinsic height for `fitToContents`, so nothing here uses flex: 1.
 */
export default function DemoInfoSheet() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const demo = findDemo(typeof id === 'string' ? id : '');

  return (
    <View style={{ padding: t.spacing.xl, paddingTop: t.spacing.xl + t.spacing.sm, paddingBottom: t.spacing.xl + insets.bottom }}>
      {demo ? (
        <>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.md }]}>
              <Icon name={demo.icon} size={24} tone="accent" />
            </View>
            <View style={styles.flexShrink}>
              <AppText variant="title">{demo.title}</AppText>
              <View style={styles.categoryRow}>
                <Icon name={CATEGORY_ICONS[demo.category]} size={14} tone="accent" />
                <AppText variant="label" tone="accent">
                  {demo.category.toUpperCase()}
                </AppText>
              </View>
            </View>
          </View>
          <AppText tone="secondary" style={{ marginTop: t.spacing.lg }}>
            {demo.description}
          </AppText>
          <AppText variant="label" tone="tertiary" style={{ marginTop: t.spacing.xl }}>
            BUILT WITH
          </AppText>
          <View style={[styles.pills, { marginTop: t.spacing.sm, gap: t.spacing.sm }]}>
            {demo.libraries.map((lib) => (
              <View key={lib} style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radii.pill, paddingHorizontal: t.spacing.md, paddingVertical: 6 }}>
                <AppText variant="caption" tone="accent">
                  {lib}
                </AppText>
              </View>
            ))}
          </View>
        </>
      ) : (
        <AppText tone="secondary">Unknown demo.</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  flexShrink: {
    flexShrink: 1,
  },
  iconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
