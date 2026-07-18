import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { useAuth } from '@/context/auth-context';

const Tap = TouchableOpacity as any;
import { useNotifications } from '@/context/notification-context';
import { supabase } from '@/utils/supabase';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Stats = {
  learners: number;
  tutors: number;
  pendingApps: number;
  revenueMtd: number;
  outstanding: number;
  passRate: number;
  classesTotal: number;
};

type RecentApp = { id: string; learner_name: string; grade: string; status: string; submitted_at: string };
type RecentPayment = { id: string; amount: number; status: string; type: string; created_at: string };

const now = new Date();
const MTD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentApps, setRecentApps] = useState<RecentApp[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    const [
      { count: learners },
      { count: tutors },
      { count: pendingApps },
      { data: paidData },
      { data: outData },
      { count: totalAttempts },
      { count: passedAttempts },
      { count: classesTotal },
      { data: apps },
      { data: payments },
    ] = await Promise.all([
      supabase.from('learners').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tutor').eq('is_active', true),
      supabase.from('enrolment_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('payments').select('amount').eq('status', 'paid').eq('period_month', MTD),
      supabase.from('payments').select('amount').in('status', ['pending', 'overdue']),
      supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('passed', true),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('enrolment_applications').select('id, learner_name, grade, status, submitted_at, updated_at').order('updated_at', { ascending: false }).limit(5),
      supabase.from('payments').select('id, amount, status, type, created_at, updated_at').order('updated_at', { ascending: false }).limit(5),
    ]);

    const revenueMtd = (paidData ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const outstanding = (outData ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const passRate = totalAttempts ? Math.round(((passedAttempts ?? 0) / totalAttempts) * 100) : 0;

    setStats({ learners: learners ?? 0, tutors: tutors ?? 0, pendingApps: pendingApps ?? 0, revenueMtd, outstanding, passRate, classesTotal: classesTotal ?? 0 });
    setRecentApps((apps ?? []) as RecentApp[]);
    setRecentPayments((payments ?? []) as RecentPayment[]);
    setLoading(false);
  }

  const paddingTop = insets.top + 12;

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <ThemedText style={styles.topGreet}>Admin Panel</ThemedText>
          <ThemedText style={styles.topName}>{profile?.full_name ?? 'Administrator'}</ThemedText>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tap style={styles.bellBtn} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
            <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={22} color="#111827" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
              </View>
            )}
          </Tap>
          <Tap style={styles.bellBtn} onPress={() => { signOut(); router.replace('/auth/login'); }} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </Tap>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><LoadingDots /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInset={{ bottom: insets.bottom + BottomTabInset + Spacing.three }}
          contentContainerStyle={styles.scroll}>
          <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' }}>

            {/* Hero stat */}
            <LinearGradient colors={[PRIMARY, '#0D3B23']} style={styles.hero}>
              <View style={styles.heroLeft}>
                <ThemedText style={styles.heroLabel}>Revenue MTD</ThemedText>
                <ThemedText style={styles.heroValue}>R {stats?.revenueMtd.toLocaleString('en-ZA')}</ThemedText>
                <ThemedText style={styles.heroSub}>R {stats?.outstanding.toLocaleString('en-ZA')} outstanding</ThemedText>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.heroStat}>
                  <ThemedText style={styles.heroStatNum}>{stats?.passRate}%</ThemedText>
                  <ThemedText style={styles.heroStatLbl}>Pass Rate</ThemedText>
                </View>
              </View>
            </LinearGradient>

            {/* Stat grid */}
            <View style={styles.statGrid}>
              {([
                { label: 'Learners',   value: stats?.learners,    icon: 'people-outline',        color: '#1565C0' },
                { label: 'Tutors',     value: stats?.tutors,      icon: 'school-outline',        color: '#7C3AED' },
                { label: 'Pending',    value: stats?.pendingApps, icon: 'document-text-outline', color: '#D97706' },
                { label: 'Classes',    value: stats?.classesTotal,icon: 'videocam-outline',       color: PRIMARY  },
              ] as { label: string; value: number | undefined; icon: IoniconName; color: string }[]).map(s => (
                <View key={s.label} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                    <Ionicons name={s.icon} size={20} color={s.color} />
                  </View>
                  <ThemedText style={styles.statValue}>{s.value ?? 0}</ThemedText>
                  <ThemedText style={styles.statLabel}>{s.label}</ThemedText>
                </View>
              ))}
            </View>

            {/* Quick actions */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
              <View style={styles.actionRow}>
                {([
                  { label: 'Enrolments', icon: 'document-text-outline', color: '#D97706', bg: '#FFFBEB', route: '/(tabs)/admin-enrolments' },
                  { label: 'Payments',   icon: 'card-outline',           color: PRIMARY,   bg: '#F0FDF4', route: '/(tabs)/admin-payments' },
                  { label: 'Users',      icon: 'people-outline',          color: '#1565C0', bg: '#EFF6FF', route: '/(tabs)/admin-users' },
                  { label: 'Learners',   icon: 'school-outline',          color: '#059669', bg: '#F0FDF4', route: '/admin/learners' },
                ] as { label: string; icon: IoniconName; color: string; bg: string; route: string }[]).map(a => (
                  <Tap key={a.label} style={[styles.actionCard, { backgroundColor: a.bg }]}
                    onPress={() => router.push(a.route as any)}>
                    <View style={[styles.actionIcon, { backgroundColor: a.color + '22' }]}>
                      <Ionicons name={a.icon} size={22} color={a.color} />
                    </View>
                    <ThemedText style={[styles.actionLabel, { color: a.color }]}>{a.label}</ThemedText>
                  </Tap>
                ))}
              </View>

              {/* Content management */}
              <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.three }]}>Content</ThemedText>
              <View style={styles.actionRow}>
                {([
                  { label: 'Materials',      icon: 'book-outline',      color: '#1565C0', bg: '#EFF6FF', route: '/admin/materials' },
                  { label: 'Classes',        icon: 'videocam-outline',  color: '#7C3AED', bg: '#F5F3FF', route: '/admin/classes' },
                  { label: 'Gallery',        icon: 'images-outline',    color: '#059669', bg: '#F0FDF4', route: '/admin/gallery' },
                  { label: 'Announcements',  icon: 'megaphone-outline',  color: '#D97706', bg: '#FFFBEB', route: '/(tabs)/admin-announcements' },
                ] as { label: string; icon: IoniconName; color: string; bg: string; route: string }[]).map(a => (
                  <Tap key={a.label} style={[styles.actionCard, { backgroundColor: a.bg }]}
                    onPress={() => router.push(a.route as any)}>
                    <View style={[styles.actionIcon, { backgroundColor: a.color + '22' }]}>
                      <Ionicons name={a.icon} size={22} color={a.color} />
                    </View>
                    <ThemedText style={[styles.actionLabel, { color: a.color }]}>{a.label}</ThemedText>
                  </Tap>
                ))}
              </View>
            </View>

            {/* Recent applications */}
            {recentApps.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <ThemedText style={styles.sectionTitle}>Recent Applications</ThemedText>
                  <Tap onPress={() => router.push('/(tabs)/admin-enrolments' as any)}>
                    <ThemedText style={styles.viewAll}>View all →</ThemedText>
                  </Tap>
                </View>
                {recentApps.map(a => (
                  <Tap key={a.id} style={styles.row}
                    onPress={() => router.push({ pathname: '/admin/application-detail', params: { id: a.id } } as any)}>
                    <View style={[styles.rowIcon, { backgroundColor: STATUS_COLOR[a.status]?.bg ?? '#F3F4F6' }]}>
                      <Ionicons name="person-outline" size={16} color={STATUS_COLOR[a.status]?.text ?? '#6B7280'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.rowTitle}>{a.learner_name}</ThemedText>
                      <ThemedText style={styles.rowSub}>Grade {a.grade} · {fmtDate(a.submitted_at)}</ThemedText>
                    </View>
                    <View style={[styles.chip, { backgroundColor: STATUS_COLOR[a.status]?.bg ?? '#F3F4F6' }]}>
                      <ThemedText style={[styles.chipText, { color: STATUS_COLOR[a.status]?.text ?? '#6B7280' }]}>
                        {a.status}
                      </ThemedText>
                    </View>
                  </Tap>
                ))}
              </View>
            )}

            {/* Recent payments */}
            {recentPayments.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <ThemedText style={styles.sectionTitle}>Recent Payments</ThemedText>
                  <Tap onPress={() => router.push('/(tabs)/admin-payments' as any)}>
                    <ThemedText style={styles.viewAll}>View all →</ThemedText>
                  </Tap>
                </View>
                {recentPayments.map(p => (
                  <View key={p.id} style={styles.row}>
                    <View style={[styles.rowIcon, { backgroundColor: PAY_COLOR[p.status]?.bg ?? '#F3F4F6' }]}>
                      <Ionicons name="cash-outline" size={16} color={PAY_COLOR[p.status]?.text ?? '#6B7280'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.rowTitle}>R{Number(p.amount).toLocaleString('en-ZA')} · {p.type}</ThemedText>
                      <ThemedText style={styles.rowSub}>{fmtDate(p.created_at)}</ThemedText>
                    </View>
                    <View style={[styles.chip, { backgroundColor: PAY_COLOR[p.status]?.bg ?? '#F3F4F6' }]}>
                      <ThemedText style={[styles.chipText, { color: PAY_COLOR[p.status]?.text ?? '#6B7280' }]}>
                        {p.status}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}

          </View>
        </ScrollView>
      )}
    </View>
  );
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  reviewing: { bg: '#DBEAFE', text: '#1E40AF' },
  approved:  { bg: '#D1FAE5', text: '#065F46' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
};

const PAY_COLOR: Record<string, { bg: string; text: string }> = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  pending: { bg: '#FEF3C7', text: '#92400E' },
  overdue: { bg: '#FEE2E2', text: '#991B1B' },
  failed:  { bg: '#FEE2E2', text: '#991B1B' },
  waived:  { bg: '#F3F4F6', text: '#6B7280' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: 0 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingBottom: 14 },
  topGreet: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  topName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  bellBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', position: 'relative', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 11 },

  hero: { borderRadius: 8, padding: Spacing.four, flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.three },
  heroLeft: { flex: 1, gap: 4 },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroValue: { fontSize: 28, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  heroRight: { marginLeft: 16 },
  heroStat: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', gap: 2 },
  heroStatNum: { fontSize: 22, fontWeight: '900', color: '#fff' },
  heroStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  statGrid: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center', gap: 6, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  statIcon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },

  section: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: Spacing.two },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  viewAll: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  actionRow: { flexDirection: 'row', gap: Spacing.two },
  actionCard: { flex: 1, borderRadius: 8, padding: 14, alignItems: 'center', gap: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  actionIcon: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, marginBottom: Spacing.two, gap: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  rowIcon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
