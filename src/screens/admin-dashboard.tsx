import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { useAuth } from '@/context/auth-context';
import { useTopInset } from '@/hooks/use-top-inset';

const Tap = TouchableOpacity as any;
import { useNotifications } from '@/context/notification-context';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const BG = '#F5F6FB';
const INDIGO = '#6C5CE7';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Stats = {
  learners: number;
  tutors: number;
  pendingApps: number;
  revenueMtd: number;
  outstanding: number;
  passRate: number;
  classesTotal: number;
  revenueDeltaPct: number;
  sparkline: number[];
};

type RecentApp = { id: string; learner_name: string; grade: string; status: string; submitted_at: string };
type RecentPayment = { id: string; amount: number; status: string; type: string; created_at: string };

const now = new Date();
const MTD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const PREV_MTD = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

// The RPC already returns a running-cumulative revenue series (computed in
// SQL) — this just thins it down to at most 8 points for the sparkline.
function downsampleSparkline(cumulative: number[]): number[] {
  if (cumulative.length === 0) return [0, 0];
  if (cumulative.length === 1) return [0, cumulative[0]];
  if (cumulative.length <= 8) return cumulative;
  const step = (cumulative.length - 1) / 7;
  return Array.from({ length: 8 }, (_, i) => cumulative[Math.round(i * step)]);
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentApps, setRecentApps] = useState<RecentApp[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Deferred via InteractionManager so the fetch never races the native tab
  // bar's touch-handler setup on first landing.
  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => fetchAll());
    return () => task.cancel();
  }, []));

  // Single round trip instead of 11 — all counts/sums/sparkline/recent lists
  // are computed server-side in one SQL function (see supabase-rls-notes.sql,
  // admin_dashboard_stats) rather than pulling raw rows down to reduce here.
  async function fetchAll() {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_dashboard_stats', {
      p_mtd: MTD,
      p_prev_mtd: PREV_MTD,
    });

    if (error) {
      log.error('AdminDashboard', 'fetchAll failed', error);
      setLoading(false);
      return;
    }

    const revenueMtd = Number(data.revenue_mtd ?? 0);
    const prevRevenue = Number(data.prev_revenue ?? 0);
    const outstanding = Number(data.outstanding ?? 0);
    const totalAttempts = Number(data.total_attempts ?? 0);
    const passedAttempts = Number(data.passed_attempts ?? 0);
    const passRate = totalAttempts ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
    const revenueDeltaPct = prevRevenue > 0
      ? Math.round(((revenueMtd - prevRevenue) / prevRevenue) * 100)
      : (revenueMtd > 0 ? 100 : 0);
    const sparkline = downsampleSparkline(((data.sparkline ?? []) as number[]).map(Number));

    setStats({
      learners: Number(data.learners ?? 0),
      tutors: Number(data.tutors ?? 0),
      pendingApps: Number(data.pending_apps ?? 0),
      revenueMtd,
      outstanding,
      passRate,
      classesTotal: Number(data.classes_total ?? 0),
      revenueDeltaPct,
      sparkline,
    });
    setRecentApps((data.recent_apps ?? []) as RecentApp[]);
    setRecentPayments((data.recent_payments ?? []) as RecentPayment[]);
    setLoading(false);
  }

  const paddingTop = topInset + 12;

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
            <LinearGradient colors={['#1B1E3D', '#2C1F4D']} style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroLeft}>
                  <ThemedText style={styles.heroLabel}>Revenue MTD</ThemedText>
                  <ThemedText style={styles.heroValue}>R{stats?.revenueMtd.toLocaleString('en-ZA')}</ThemedText>
                  {(stats?.outstanding ?? 0) > 0 && (
                    <View style={styles.outstandingPill}>
                      <View style={styles.outstandingDot} />
                      <ThemedText style={styles.outstandingText}>outstanding</ThemedText>
                    </View>
                  )}
                </View>
                <PassRateRing percent={stats?.passRate ?? 0} />
              </View>

              <View style={styles.heroBottom}>
                <Sparkline points={stats?.sparkline ?? [0, 0]} />
                <View style={styles.deltaWrap}>
                  <Ionicons name={(stats?.revenueDeltaPct ?? 0) >= 0 ? 'arrow-up' : 'arrow-down'} size={11} color="#fff" />
                  <ThemedText style={styles.deltaText}>{Math.abs(stats?.revenueDeltaPct ?? 0)}%</ThemedText>
                  <ThemedText style={styles.deltaSub}>vs last month</ThemedText>
                </View>
              </View>
            </LinearGradient>

            {/* Stat row */}
            <View style={styles.statRow}>
              {([
                { label: 'Learners', value: stats?.learners,     icon: 'people-outline',        iconColor: '#6366F1', bg: '#EEF2FF' },
                { label: 'Tutors',   value: stats?.tutors,       icon: 'school-outline',        iconColor: '#9333EA', bg: '#F3E8FF' },
                { label: 'Pending',  value: stats?.pendingApps,  icon: 'document-text-outline', iconColor: '#EA580C', bg: '#FFF7ED' },
                { label: 'Classes',  value: stats?.classesTotal, icon: 'videocam-outline',       iconColor: '#059669', bg: '#ECFDF5' },
              ] as { label: string; value: number | undefined; icon: IoniconName; iconColor: string; bg: string }[]).map((s, i) => (
                <View key={s.label} style={[styles.statCol, i > 0 && styles.statColDivider]}>
                  <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon} size={18} color={s.iconColor} />
                  </View>
                  <ThemedText style={styles.statValue}>{s.value ?? 0}</ThemedText>
                  <ThemedText style={styles.statLabel}>{s.label}</ThemedText>
                </View>
              ))}
            </View>

            {/* Quick actions */}
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
                <Tap onPress={() => router.push('/(tabs)/admin-users' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <ThemedText style={styles.viewAll}>Manage</ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={PRIMARY} />
                </Tap>
              </View>

              <View style={styles.circleActionRow}>
                {([
                  { label: 'Enrolments', icon: 'document-text-outline', color: INDIGO,     route: '/(tabs)/admin-enrolments' },
                  { label: 'Payments',   icon: 'card-outline',          color: '#2563EB',  route: '/(tabs)/admin-payments' },
                  { label: 'Users',      icon: 'people-outline',        color: '#16A34A',  route: '/(tabs)/admin-users' },
                  { label: 'Learners',   icon: 'school-outline',        color: '#F59E0B',  route: '/admin/learners' },
                ] as { label: string; icon: IoniconName; color: string; route: string }[]).map(a => (
                  <Tap key={a.label} style={styles.circleAction} onPress={() => router.push(a.route as any)}>
                    <View style={[styles.circleActionIcon, { backgroundColor: a.color }]}>
                      <Ionicons name={a.icon} size={22} color="#fff" />
                    </View>
                    <ThemedText style={styles.circleActionLabel}>{a.label}</ThemedText>
                  </Tap>
                ))}
              </View>
            </View>

            {/* Explore */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Explore</ThemedText>
              <View style={styles.exploreGrid}>
                {([
                  { label: 'Materials',     sub: 'Study resources and files',   icon: 'book-outline',      iconColor: '#2563EB', iconBg: '#DCE7FD', cardBg: '#F1F5FE', route: '/admin/materials' },
                  { label: 'Classes',       sub: 'Manage and view live sessions', icon: 'videocam-outline', iconColor: '#E11D48', iconBg: '#FBDCE1', cardBg: '#FDF1F2', route: '/admin/classes' },
                  { label: 'Gallery',       sub: 'Photos and downloads',        icon: 'image-outline',      iconColor: '#059669', iconBg: '#D8F5E6', cardBg: '#EFFBF3', route: '/admin/gallery' },
                  { label: 'Announcements', sub: 'School updates and news',     icon: 'megaphone-outline',  iconColor: '#6C5CE7', iconBg: '#E2DEFB', cardBg: '#F1EFFC', route: '/(tabs)/admin-announcements' },
                ] as { label: string; sub: string; icon: IoniconName; iconColor: string; iconBg: string; cardBg: string; route: string }[]).map(a => (
                  <Tap key={a.label} style={[styles.exploreCard, { backgroundColor: a.cardBg }]} onPress={() => router.push(a.route as any)}>
                    <View style={[styles.exploreIcon, { backgroundColor: a.iconBg }]}>
                      <Ionicons name={a.icon} size={18} color={a.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.exploreLabel}>{a.label}</ThemedText>
                      <ThemedText style={styles.exploreSub}>{a.sub}</ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
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
                {recentPayments.map(p => {
                  const isCash = ['tuition', 'assessment', 'registration'].includes(p.type);
                  const iconColor = isCash ? '#0D9488' : '#4F46E5';
                  const iconBg = isCash ? '#CCFBF1' : '#E0E7FF';
                  const payChip = PAY_CHIP[p.status] ?? PAY_CHIP.pending;
                  return (
                    <View key={p.id} style={styles.row}>
                      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
                        <Ionicons name={isCash ? 'cash-outline' : 'card-outline'} size={16} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.rowTitle}>R{Number(p.amount).toLocaleString('en-ZA')} · {p.type}</ThemedText>
                        <ThemedText style={styles.rowSub}>{fmtDateTime(p.created_at)}</ThemedText>
                      </View>
                      <View style={[styles.chip, { backgroundColor: payChip.bg }]}>
                        <ThemedText style={[styles.chipText, { color: payChip.text }]}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="#D1D5DB" style={{ marginLeft: 6 }} />
                    </View>
                  );
                })}
              </View>
            )}

          </View>
        </ScrollView>
      )}
    </View>
  );
}

function PassRateRing({ percent }: { percent: number }) {
  const SIZE = 72, STROKE = 5, RADIUS = (SIZE - STROKE) / 2, CENTER = SIZE / 2;
  const circumference = 2 * Math.PI * RADIUS;
  const pct = Math.min(100, Math.max(0, percent));
  const dashOffset = circumference * (1 - pct / 100);
  const angle = (pct / 100) * 360 - 90;
  const dotX = CENTER + RADIUS * Math.cos((angle * Math.PI) / 180);
  const dotY = CENTER + RADIUS * Math.sin((angle * Math.PI) / 180);

  return (
    <View style={styles.ringWrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke="rgba(255,255,255,0.22)" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={CENTER} cy={CENTER} r={RADIUS}
          stroke="#fff" strokeWidth={STROKE} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
        <Circle cx={dotX} cy={dotY} r={4} fill="#B9A6FF" />
      </Svg>
      <View style={styles.ringCenter}>
        <ThemedText style={styles.ringValue}>{pct}%</ThemedText>
        <ThemedText style={styles.ringLabel}>Pass Rate</ThemedText>
      </View>
    </View>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const W = 168, H = 40;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = W / (points.length - 1 || 1);
  const coords = points.map((v, i) => ({ x: i * stepX, y: H - ((v - min) / range) * (H - 6) - 3 }));
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const last = coords[coords.length - 1];

  return (
    <Svg width={W} height={H}>
      <Path d={d} stroke="#8B7EF0" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={4} fill="#fff" stroke="#8B7EF0" strokeWidth={2} />
    </Svg>
  );
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  reviewing: { bg: '#DBEAFE', text: '#1E40AF' },
  approved:  { bg: '#D1FAE5', text: '#065F46' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
};

const PAY_CHIP: Record<string, { bg: string; text: string }> = {
  paid:     { bg: '#EDE9FE', text: '#6D28D9' },
  pending:  { bg: '#DCFCE7', text: '#15803D' },
  overdue:  { bg: '#FEE2E2', text: '#991B1B' },
  failed:   { bg: '#FEE2E2', text: '#991B1B' },
  waived:   { bg: '#F3F4F6', text: '#6B7280' },
  refunded: { bg: '#F3F4F6', text: '#6B7280' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: 0 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingBottom: 14 },
  topGreet: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  topName: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 2 },
  bellBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', position: 'relative', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 11 },

  hero: { borderRadius: 20, padding: Spacing.four, marginBottom: Spacing.three, gap: Spacing.two },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLeft: { flex: 1, gap: 6 },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  heroValue: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  outstandingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,126,240,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  outstandingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B9A6FF' },
  outstandingText: { fontSize: 11, color: '#D7D0FF', fontWeight: '600' },

  ringWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  ringLabel: { fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deltaWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaText: { fontSize: 13, color: '#fff', fontWeight: '800' },
  deltaSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 2 },

  statRow: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16,
    marginBottom: Spacing.four, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  statCol: { flex: 1, alignItems: 'center', gap: 6 },
  statColDivider: { borderLeftWidth: 1, borderLeftColor: '#F0F1F5' },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 10.5, color: '#9CA3AF', fontWeight: '600' },

  section: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: Spacing.two },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  viewAll: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  circleActionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  circleAction: { alignItems: 'center', gap: 8, width: 72 },
  circleActionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  circleActionLabel: { fontSize: 11.5, fontWeight: '600', color: '#374151', textAlign: 'center' },

  exploreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  exploreCard: {
    width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14,
  },
  exploreIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  exploreLabel: { fontSize: 13.5, fontWeight: '700', color: '#111827' },
  exploreSub: { fontSize: 11, color: '#6B7280', marginTop: 1, lineHeight: 14 },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: Spacing.three, marginBottom: Spacing.two, gap: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  rowSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700' },
});
