import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { useClasses } from '@/context/classes-context';
import { useNotifications } from '@/context/notification-context';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { countdown } from './classes';
import type { Announcement, Quiz } from '@/types/db';

const PRIMARY = '#1565C0';
const PURPLE = '#7C3AED';
const BLUE = '#1565C0';
const AMBER = '#D97706';
const PRIMARY_DARK = '#0D3B8C';
const BG = '#F5F6FA';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const DIFF_COLOR: Record<string, string> = { easy: '#16A34A', medium: '#D97706', hard: '#DC2626' };

const QUICK_ACTIONS_DEFAULT = [
  { label: 'Classes',    icon: 'videocam' as IoniconName,    color: BLUE,   bg: '#EFF6FF', route: '/(tabs)/classes' },
  { label: 'Chat',       icon: 'chatbubbles' as IoniconName, color: PRIMARY, bg: '#F0FDF4', route: '/(tabs)/chat' },
  { label: 'Tasks',      icon: 'trophy' as IoniconName,      color: PURPLE, bg: '#F5F3FF', route: '/(tabs)/tasks' },
  { label: 'Profile',    icon: 'person-circle' as IoniconName, color: AMBER, bg: '#FFFBEB', route: '/(tabs)/profile' },
];
const QUICK_ACTIONS_GUARDIAN = [
  { label: 'Classes',    icon: 'videocam' as IoniconName,    color: BLUE,   bg: '#EFF6FF', route: '/(tabs)/classes' },
  { label: 'Programmes', icon: 'reader' as IoniconName,      color: PRIMARY, bg: '#F0FDF4', route: '/(tabs)/programs' },
  { label: 'Tasks',      icon: 'trophy' as IoniconName,      color: PURPLE, bg: '#F5F3FF', route: '/(tabs)/tasks' },
  { label: 'Profile',    icon: 'person-circle' as IoniconName, color: AMBER, bg: '#FFFBEB', route: '/(tabs)/profile' },
];

// Workaround for TS/RN version mismatch
const Tap = TouchableOpacity as any;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { classes, refetch } = useClasses();

  const isLearner  = profile?.role === 'learner';
  const isTutor    = profile?.role === 'tutor';
  const isGuardian = profile?.role === 'guardian';
  const QUICK_ACTIONS = isGuardian ? QUICK_ACTIONS_GUARDIAN : QUICK_ACTIONS_DEFAULT;

  const learnerGrade = isLearner ? (profile?.grades?.[0] ?? null) : null;

  const { data: allQuizzes, refetch: refetchQuizzes } = useSupabaseQuery<Quiz>('quizzes', {
    select: '*, subject:subjects(name)',
    filter: q => q.eq('is_published', true).order('created_at', { ascending: false }).limit(10),
  });
  const quizzes = (learnerGrade
    ? allQuizzes.filter(q => q.grade === learnerGrade)
    : allQuizzes
  ).slice(0, 3);

  const { data: announcements } = useSupabaseQuery<Announcement>('announcements', {
    filter: q => q.eq('active', true).order('created_at', { ascending: false }).limit(5),
  });
  const latest = announcements.slice(0, 5);

  useFocusEffect(useCallback(() => { refetch(); refetchQuizzes(); }, []));

  const liveClasses = classes.filter(c => c.live);
  const upcomingClasses = classes.filter(c => !c.live).slice(0, 4);

  const displayName = profile?.full_name ?? 'there';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* ── TOP BAR ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topLeft}>
          <LinearGradient colors={[PRIMARY, PRIMARY_DARK]} style={styles.avatarCircle}>
            <ThemedText style={styles.avatarText}>{initials(profile?.full_name ?? null)}</ThemedText>
          </LinearGradient>
          <View>
            <ThemedText style={styles.greetText}>{greeting()},</ThemedText>
            <ThemedText style={styles.nameText} numberOfLines={1}>
              {displayName.split(' ')[0]} 
            </ThemedText>
          </View>
        </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>

        <Tap style={styles.bellBtn} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
          <Ionicons
            name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
            size={22}
            color="#111827"
          />
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



      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentInset={{ bottom: insets.bottom + BottomTabInset + Spacing.three }}
        contentContainerStyle={[styles.content, { paddingTop: Spacing.three }]}>

        <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' }}>

          {/* ── WELCOME BANNER ── */}
          <LinearGradient
            colors={isTutor ? [BLUE, '#0D47A1'] : [PRIMARY, PRIMARY_DARK]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.banner}>
            <View style={styles.bannerLeft}>
              <View style={styles.bannerRolePill}>
                <ThemedText style={styles.bannerRoleText}>
                  {isTutor ? 'Tutor' : profile?.role === 'guardian' ? 'Guardian' : `${learnerGrade ?? '–'}`}
                </ThemedText>
              </View>
              <ThemedText style={styles.bannerTitle}>
                {isTutor
                  ? `${(profile?.subjects ?? []).slice(0, 2).join(' · ')}`
                  : 'Rhavuyani Genius Lab'}
              </ThemedText>
              <ThemedText style={styles.bannerSub}>
                {isTutor
                  ? `${(profile?.grades ?? []).join(', ')} · ${classes.length} class${classes.length !== 1 ? 'es' : ''}`
                  : `${(allQuizzes.length)} quiz${allQuizzes.length !== 1 ? 'zes' : ''} available`}
              </ThemedText>
            </View>
            <View style={styles.bannerRight}>
              <View style={styles.statCircle}>
                <ThemedText style={styles.statNum}>{liveClasses.length > 0 ? liveClasses.length : upcomingClasses.length}</ThemedText>
                <ThemedText style={styles.statLbl}>{liveClasses.length > 0 ? 'Live' : 'Upcoming'}</ThemedText>
              </View>
            </View>
          </LinearGradient>

          {/* ── QUICK ACTIONS ── */}

          {/* //show quick action for guardinas for now
          if (isGuardian) {
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Quick Access</ThemedText>
            <View style={styles.actionsGrid}>
              {QUICK_ACTIONS.map(a => (
                <Tap
                  key={a.label}
                  style={[styles.actionCard, { backgroundColor: a.bg }]}
                  activeOpacity={0.75}
                  onPress={() => router.push(a.route as any)}>
                  <View style={[styles.actionIconWrap, { backgroundColor: a.color + '22' }]}>
                    <Ionicons name={a.icon} size={24} color={a.color} />
                  </View>
                  <ThemedText style={[styles.actionLabel, { color: a.color }]}>{a.label}</ThemedText>
                </Tap>
              ))}
            </View>
          </View>
          } */}

          {liveClasses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <ThemedText style={styles.liveTxt}>LIVE NOW</ThemedText>
                </View>
              </View>
              {liveClasses.map(c => (
                <Tap
                  key={c.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/live-class/[room]', params: { room: c.room, title: c.title } } as any)}>
                  <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.liveCard}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.liveTitle}>{c.title}</ThemedText>
                      <ThemedText style={styles.liveMeta}>{c.subject} · {c.grade}</ThemedText>
                    </View>
                    <View style={styles.liveJoin}>
                      <Ionicons name="videocam" size={18} color="#2563EB" />
                    </View>
                  </LinearGradient>
                </Tap>
              ))}
            </View>
          )}

          {/* ── UPCOMING CLASSES ── */}
          {upcomingClasses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <ThemedText style={styles.sectionTitle}>Upcoming Classes</ThemedText>
                <Tap onPress={() => router.push('/(tabs)/classes' as any)} activeOpacity={0.7}>
                  <ThemedText style={styles.viewAll}>View all →</ThemedText>
                </Tap>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                {upcomingClasses.map((c, i) => {
                  const colors = [
                    ['#7C3AED', '#5B21B6'],
                    [PRIMARY, PRIMARY_DARK],
                    [BLUE, '#0D47A1'],
                    [AMBER, '#92400E'],
                  ];
                  const [c1, c2] = colors[i % colors.length];
                  return (
                    <Tap
                      key={c.id}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/live-class/[room]', params: { room: c.room, title: c.title } } as any)}>
                      <LinearGradient colors={[c1, c2]} style={styles.classCard}>
                        <View style={styles.classIconWrap}>
                          <Ionicons name="videocam-outline" size={20} color="rgba(255,255,255,0.9)" />
                        </View>
                        <ThemedText style={styles.classTitle} numberOfLines={2}>{c.title}</ThemedText>
                        <ThemedText style={styles.classMeta}>{c.grade} · {c.subject}</ThemedText>
                        {c.time ? (
                          <View style={styles.classTimeRow}>
                            <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.7)" />
                            <ThemedText style={styles.classTime}>{c.time}</ThemedText>
                          </View>
                        ) : null}
                        {countdown(c.scheduled_at) ? (
                          <View style={styles.countdownRow}>
                            <Ionicons name="hourglass-outline" size={11} color="rgba(255,255,255,0.9)" />
                            <ThemedText style={styles.countdownTxt}>{countdown(c.scheduled_at)}</ThemedText>
                          </View>
                        ) : null}
                      </LinearGradient>
                    </Tap>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── QUIZZES ── */}
          {quizzes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <ThemedText style={styles.sectionTitle}>Quizzes</ThemedText>
                <Tap onPress={() => router.push('/(tabs)/tasks' as any)} activeOpacity={0.7}>
                  <ThemedText style={styles.viewAll}>View all →</ThemedText>
                </Tap>
              </View>
              <View style={styles.quizList}>
                {quizzes.map(q => {
                  const dc = DIFF_COLOR[q.difficulty ?? 'medium'];
                  const subjectName = (q as any).subject?.name ?? '';
                  return (
                    <Tap
                      key={q.id}
                      activeOpacity={0.85}
                      style={styles.quizCard}
                      onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: q.id, title: q.title, pass_score: String(q.pass_score) } } as any)}>
                      <View style={[styles.quizIconBox, { backgroundColor: dc + '18' }]}>
                        <Ionicons name="help-circle-outline" size={22} color={dc} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.quizTitle} numberOfLines={1}>{q.title}</ThemedText>
                        <ThemedText style={styles.quizMeta}>
                          {subjectName ? `${subjectName} · ` : ''}{q.questions} Qs · {q.duration_minutes} min
                        </ThemedText>
                      </View>
                      <View style={styles.quizRight}>
                        <View style={[styles.diffPill, { backgroundColor: dc + '18' }]}>
                          <ThemedText style={[styles.diffTxt, { color: dc }]}>{q.difficulty ?? 'medium'}</ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#D1D5DB" style={{ marginTop: 4 }} />
                      </View>
                    </Tap>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {latest.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Announcements</ThemedText>
              {latest.map(a => (
                <Tap
                  key={a.id}
                  activeOpacity={0.85}
                  style={[styles.annoCard, { marginBottom: 8 }]}
                  onPress={() => a.cta_route ? router.push(a.cta_route as any) : null}>
                  <LinearGradient colors={[PRIMARY + '14', PRIMARY + '06']} style={styles.annoGrad}>
                    <View style={[styles.annoIcon, { backgroundColor: PRIMARY + '20' }]}>
                      <Ionicons name="megaphone-outline" size={20} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.annoTop}>
                        <ThemedText style={styles.annoTitle} numberOfLines={1}>{a.title}</ThemedText>
                        {a.date_label && (
                          <View style={styles.datePill}>
                            <ThemedText style={styles.dateTxt}>{a.date_label}</ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={styles.annoBody} numberOfLines={2}>{a.body}</ThemedText>
                      {a.cta_label ? <ThemedText style={styles.annoCta}>{a.cta_label} →</ThemedText> : null}
                    </View>
                  </LinearGradient>
                </Tap>
              ))}
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', paddingHorizontal: Spacing.four, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#BFDBFE',
  },
  viewingBannerText: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },

  // TOP BAR
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingBottom: 14,
    backgroundColor: BG,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 25, fontWeight: '800', color: '#fff' },
  greetText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  nameText: { fontSize: 18, fontWeight: '800', color: '#111827' },
  bellBtn: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: BG,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 11 },

  // BANNER
  banner: {
    borderRadius: 8, padding: Spacing.four,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: Spacing.four,
  },
  bannerLeft: { flex: 1, gap: 6 },
  bannerRolePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  bannerRoleText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', lineHeight: 22 },
  bannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  bannerRight: { marginLeft: 16 },
  statCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  statNum: { fontSize: 26, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  // SECTIONS
  section: { marginBottom: Spacing.four },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: Spacing.two },
  viewAll: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  // QUICK ACTIONS
  actionsGrid: { flexDirection: 'row', gap: Spacing.two },
  actionCard: {
    flex: 1, borderRadius: 8, padding: 14,
    alignItems: 'center', gap: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  actionIconWrap: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700' },

  // LIVE
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveTxt: { fontSize: 12, fontWeight: '800', color: '#EF4444', letterSpacing: 1 },
  liveCard: {
    borderRadius: 8, padding: Spacing.three,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
  },
  liveTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  liveMeta: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  liveJoin: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // CLASS CARDS (horizontal scroll)
  hScroll: { marginHorizontal: -Spacing.four, paddingLeft: Spacing.four },
  classCard: {
    width: 160, height: 175, borderRadius: 8, padding: 16, marginRight: 12,
    justifyContent: 'space-between',
  },
  classIconWrap: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  classTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flexShrink: 1 },
  classMeta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  classTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  countdownTxt: { fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: '700' },
  classTime: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },

  // QUIZZES
  quizList: { gap: Spacing.two },
  quizCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
  },
  quizIconBox: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quizTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  quizMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  quizRight: { alignItems: 'flex-end', gap: 2 },
  diffPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  diffTxt: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  // ANNOUNCEMENT
  annoCard: { borderRadius: 8, overflow: 'hidden' },
  annoGrad: { padding: Spacing.three, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  annoIcon: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  annoTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  annoTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  datePill: { backgroundColor: '#E5E7EB', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  dateTxt: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  annoBody: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  annoCta: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginTop: 6 },
});
