import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CategoryChips } from '@/components/CategoryChips';
import { DemoCard } from '@/components/DemoCard';
import { EmptyState } from '@/components/EmptyState';
import { CATEGORIES, DEMOS, type Demo } from '@/data/demos';
import { useSplash } from '@/hooks/useSplash';
import { useTheme } from '@/hooks/useTheme';

export default function GalleryScreen() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { revealed } = useSplash();
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const category = CATEGORIES[selected];
    const byCategory = category === 'All' || category === undefined ? DEMOS : DEMOS.filter((d) => d.category === category);
    const q = query.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.libraries.some((lib) => lib.toLowerCase().includes(q)),
    );
  }, [selected, query]);

  const gap = t.spacing.md;
  const cardWidth = (width - t.spacing.lg * 2 - gap) / 2;

  const openDemo = (demo: Demo) => {
    if (!demo.ready) return;
    router.push(demo.route as never);
  };

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }]}>
      {/* Native search bar in the large-title header. */}
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Search demos',
            hideWhenScrolling: true,
            autoCapitalize: 'none',
            onChangeText: (e) => setQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setQuery(''),
          },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: t.spacing.xxxl * 2 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* Chips scroll away with the content, like the App Store, so nothing slides behind them. */}
        <View style={{ paddingTop: t.spacing.xs, paddingBottom: t.spacing.sm }}>
          <CategoryChips items={CATEGORIES} selected={selected} onSelect={setSelected} />
        </View>
        {revealed ? (
          visible.length === 0 ? (
            <EmptyState icon="search-outline" title="No matches" message={`Nothing in ${CATEGORIES[selected] ?? 'All'} matches "${query}".`} />
          ) : (
            <View style={[styles.grid, { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm, gap }]}>
              {visible.map((demo, index) => (
                <DemoCard key={demo.id} demo={demo} index={index} width={cardWidth} onPress={openDemo} />
              ))}
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
