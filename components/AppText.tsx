import { Text, type TextProps } from 'react-native';

import type { TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger' | 'success';

type Props = TextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
};

/** Themed text. Picks a type-scale variant and a semantic color. */
const HEADING_VARIANTS: TypographyVariant[] = ['display', 'title', 'heading'];

export function AppText({ variant = 'body', tone = 'primary', style, accessibilityRole, ...rest }: Props) {
  const t = useTheme();
  // Headings announce as headers to VoiceOver unless the caller says otherwise.
  const role = accessibilityRole ?? (HEADING_VARIANTS.includes(variant) ? 'header' : undefined);
  const color = {
    primary: t.colors.text,
    secondary: t.colors.textSecondary,
    tertiary: t.colors.textTertiary,
    accent: t.colors.accent,
    onAccent: t.colors.onAccent,
    danger: t.colors.danger,
    success: t.colors.success,
  }[tone];
  return <Text {...rest} accessibilityRole={role} style={[t.typography[variant], { color }, style]} />;
}
