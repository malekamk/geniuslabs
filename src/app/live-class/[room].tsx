import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useClasses } from '@/context/classes-context';

const PRIMARY = '#1A6B3C';
const BG = '#F7F9F8';
const JITSI_BASE = 'https://meet.jit.si/';

export default function LiveClassScreen() {
  const { room, title } = useLocalSearchParams<{ room: string; title: string }>();
  const insets = useSafeAreaInsets();
  const { classes } = useClasses();

  const classItem = classes.find((c) => c.room === room);
  const url = `${JITSI_BASE}${room}`;

  async function handleJoin() {
    try {
      await openBrowserAsync(url, {
        presentationStyle: 'fullScreen' as any,
        toolbarColor: PRIMARY,
      });
    } catch {
      Alert.alert('Could not open classroom', 'Please try again or use a browser.');
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + Spacing.four }]}>
      {/* Icon banner */}
      <View style={styles.iconBanner}>
        <View style={styles.iconCircle}>
          <Ionicons name="videocam" size={36} color="#fff" />
        </View>
        <ThemedText style={styles.bannerTitle}>
          {title ?? classItem?.title ?? 'Class'}
        </ThemedText>
        {classItem && (
          <ThemedText style={styles.bannerSub}>
            {classItem.grade} · {classItem.subject}
          </ThemedText>
        )}
      </View>

      {/* Info card */}
      {classItem && (
        <View style={styles.infoCard}>
          <Row icon="person-outline" label="Tutor" value={classItem.tutor} />
          <View style={styles.divider} />
          <Row icon="time-outline" label="Schedule" value={classItem.time} />
          <View style={styles.divider} />
          <Row icon="globe-outline" label="Platform" value="Jitsi Meet (opens in browser)" />
        </View>
      )}

      {/* Notice */}
      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={18} color="#1565C0" />
        <ThemedText style={styles.noticeText}>
          The classroom opens in your browser. Allow camera and microphone access when prompted.
        </ThemedText>
      </View>

      <View style={{ flex: 1 }} />

      {/* Join CTA */}
      <Pressable
        style={({ pressed }) => [styles.joinBtn, { opacity: pressed ? 0.88 : 1 }]}
        onPress={handleJoin}>
        <Ionicons name="videocam" size={18} color="#fff" />
        <ThemedText style={styles.joinBtnText}>Join Classroom</ThemedText>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Back to Classes</ThemedText>
      </Pressable>
    </View>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={16} color="#9CA3AF" />
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, padding: Spacing.four, gap: Spacing.three },

  iconBanner: { alignItems: 'center', paddingVertical: Spacing.four, gap: Spacing.two },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#1565C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  bannerSub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowLabel: { fontSize: 13, color: '#9CA3AF', width: 72 },
  rowValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: Spacing.three,
  },
  noticeText: { flex: 1, fontSize: 13, color: '#1565C0', lineHeight: 19 },

  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: PRIMARY,
    paddingVertical: Spacing.three,
    borderRadius: 8,
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  backBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  backText: { fontSize: 14, color: '#6B7280' },
});
