import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { useAuth } from '@/context/auth-context';

const PRIMARY = '#5605da';

export function LearnerBanner() {
  const { isImpersonating, profile, exitLoginAs } = useAuth();
  const insets = useSafeAreaInsets();
  if (!isImpersonating) return null;

  function exit() {
    exitLoginAs();
    router.replace('/(tabs)');
  }

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
      <ThemedText style={styles.text} numberOfLines={1}>
         <ThemedText style={styles.bold}>Viewing as {profile?.full_name}</ThemedText>
      </ThemedText>
      <Pressable onPress={exit} style={styles.exitBtn} hitSlop={8}>
        <ThemedText style={styles.exitText}>Exit</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  text: { flex: 1, fontSize: 13, color: '#fff' },
  bold: { fontWeight: '700', color: '#fff' },
  exitBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  exitText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
