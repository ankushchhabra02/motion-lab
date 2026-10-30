import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/hooks/useTheme';
import type { TextTone } from '@/components/AppText';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: number;
  tone?: TextTone;
  color?: string;
};

/** Thin typed wrapper around Ionicons that defaults to theme colors. */
export function Icon({ name, size = 22, tone = 'primary', color }: Props) {
  const t = useTheme();
  const toneColor = {
    primary: t.colors.text,
    secondary: t.colors.textSecondary,
    tertiary: t.colors.textTertiary,
    accent: t.colors.accent,
    onAccent: t.colors.onAccent,
    danger: t.colors.danger,
    success: t.colors.success,
  }[tone];
  return <Ionicons name={name} size={size} color={color ?? toneColor} />;
}
