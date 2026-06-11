import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { useAuth } from '@/context/auth-context';

const PRIMARY = '#1565C0';

export function LearnerBanner() {
  const { isImpersonating, profile, exitLoginAs } = useAuth();
  if (!isImpersonating) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="person-circle-outline" size={16} color="#fff" />
      <ThemedText style={styles.text} numberOfLines={1}>
        Logged in as <ThemedText style={styles.bold}>{profile?.full_name}</ThemedText>
      </ThemedText>
      <Pressable
        onPress={() => { exitLoginAs(); router.replace('/(tabs)/profile'); }}
        style={styles.exitBtn}
        hitSlop={8}>
        <ThemedText style={styles.exitText}>Log out</ThemedText>
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
    paddingVertical: 8,
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
