import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  illustration: ComponentType<SvgProps>;
  title: string;
  sub: string;
  size?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ illustration: Illustration, title, sub, size = 132, actionLabel, onAction }: Props) {
  return (
    <View style={styles.card}>
      <Illustration width={size} height={size} />
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText style={styles.sub}>{sub}</ThemedText>
      {actionLabel && onAction && (
        <Pressable style={styles.actionBtn} onPress={onAction}>
          <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.four,
    alignItems: 'center', gap: 6,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  title: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4 },
  sub: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 17 },
  actionBtn: {
    marginTop: 8, backgroundColor: '#1565C0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  actionText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
