import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useClasses } from '@/context/classes-context';
import { useAuth } from '@/context/auth-context';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { supabase } from '@/utils/supabase';
import { ClassItem } from '@/data/classes';
import type { Learner, EnrolmentApplication } from '@/types/db';

const PRIMARY = '#1565C0';
const BLUE = '#1565C0';
const BG = '#F7F9F8';
// Postgres rejects '' for a uuid column (22P02) — use this instead of ?? '' so an
// unresolved id just filters to zero rows rather than throwing.
const NULL_UUID = '00000000-0000-0000-0000-000000000000';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SUBJECT_ICONS: Record<string, IoniconName> = {
  Mathematics: 'calculator-outline',
  'Natural Sciences': 'leaf-outline',
  'Physical Sciences': 'flask-outline',
  'Life Sciences': 'bug-outline',
  Accounting: 'cash-outline',
  'Business Studies': 'briefcase-outline',
  Geography: 'map-outline',
  History: 'timer-outline',
  English: 'book-outline',
  Afrikaans: 'chatbubble-outline',
  'Mathematical Literacy': 'trending-up-outline',
};

/** Two-letter initials from a full name */
function initials(name: string | null | undefined) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic pastel from a string */
const AVATAR_PALETTES = [
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FCE7F3', fg: '#831843' },
];
function avatarColor(name: string | null | undefined) {
  if (!name) return AVATAR_PALETTES[0];
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}


export function countdown(iso: string | null): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '';
  const totalMins = Math.floor(diff / 60_000);
  if (totalMins < 60) return `${totalMins}m left`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m left` : `${hrs}h left`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h left` : `${days}d left`;
}

function ClassCard({ item, learnerIds, onDelete }: { item: ClassItem; learnerIds: string[]; onDelete?: () => void }) {
  const iconName = SUBJECT_ICONS[item.subject] ?? 'school-outline';
  const isPast = item.isPast;
  const accentColor = isPast ? '#9CA3AF' : item.live ? PRIMARY : BLUE;
  const av = avatarColor(item.tutor);
  const ins = initials(item.tutor);

  // Tick every 30s so countdown stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isPast || item.live) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [isPast, item.live]);

  const timeLeft = !isPast && !item.live ? countdown(item.scheduled_at) : '';

  async function handleJoin() {
    if (learnerIds.length > 0) {
      await supabase.from('class_enrolments').upsert(
        learnerIds.map(learner_id => ({ class_id: item.id, learner_id, joined_at: new Date().toISOString() })),
        { onConflict: 'class_id,learner_id' }
      );
    }
    router.push({ pathname: '/live-class/[room]', params: { room: item.room, title: item.title } });
  }

  return (
    <View style={[styles.card, item.live && styles.cardLiveBorder, isPast && styles.cardPast]}>

      {/* HEADER */}
      <View style={styles.cardTop}>
        <View style={[styles.subjectIcon, { backgroundColor: accentColor + '15' }]}>
          <Ionicons name={iconName} size={22} color={accentColor} />
        </View>
        <View style={styles.cardMeta}>
          <ThemedText style={[styles.cardTitle, isPast && styles.textMuted]} numberOfLines={1}>{item.title}</ThemedText>
          <View style={styles.cardTagRow}>
            <ThemedText style={[styles.gradeTagText, { color: accentColor }]}>{item.grade}</ThemedText>
            <ThemedText style={[styles.gradeTagText, { color: accentColor }]}>{item.subject}</ThemedText>
          </View>
        </View>
        {isPast ? (
          <View style={styles.pastBadge}>
            <Ionicons name="checkmark-done-outline" size={10} color="#9CA3AF" />
            <ThemedText style={styles.pastBadgeText}>Ended</ThemedText>
          </View>
        ) : item.live ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveBadgeText}>LIVE</ThemedText>
          </View>
        ) : (
          <View style={styles.scheduledBadge}>
            <Ionicons name="calendar-outline" size={10} color="#1D4ED8" />
            <ThemedText style={styles.scheduledBadgeText}>Upcoming</ThemedText>
          </View>
        )}
      </View>

      {/* DIVIDER */}
      <View style={styles.divider} />

      {/* TUTOR + TIME + COUNTDOWN */}
      <View style={styles.infoRow}>
        <View style={styles.tutorChip}>
          <View style={[styles.avatar, { backgroundColor: isPast ? '#F3F4F6' : av.bg }]}>
            <ThemedText style={[styles.avatarText, { color: isPast ? '#9CA3AF' : av.fg }]}>{ins}</ThemedText>
          </View>
          <ThemedText style={[styles.tutorName, isPast && styles.textMuted]} numberOfLines={1}>{item.tutor ?? 'Tutor'}</ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <View style={styles.timeChip}>
            <Ionicons name="time-outline" size={13} color="#9CA3AF" />
            <ThemedText style={[styles.timeText, isPast && styles.textMuted]} numberOfLines={1}>{item.time}</ThemedText>
          </View>
          {timeLeft ? (
            <View style={styles.countdownChip}>
              <Ionicons name="hourglass-outline" size={11} color={PRIMARY} />
              <ThemedText style={styles.countdownText}>{timeLeft}</ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {/* ACTIONS */}
      {!isPast && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={({ pressed }) => [styles.joinBtn, { flex: 1, backgroundColor: item.live ? PRIMARY : '#000', opacity: pressed ? 0.85 : 1 }]}
            onPress={handleJoin}>
            <Ionicons name={item.live ? 'videocam' : 'calendar-outline'} size={16} color="#fff" />
            <ThemedText style={styles.joinBtnText}>
              {item.live ? 'Join Live Class' : 'View Details'}
            </ThemedText>
            <Ionicons name="arrow-forward-circle-outline" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
          {onDelete && (
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={onDelete}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </Pressable>
          )}
        </View>
      )}
      {isPast && onDelete && (
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, { alignSelf: 'flex-end', opacity: pressed ? 0.7 : 1 }]}
          onPress={onDelete}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </Pressable>
      )}

    </View>
  );
}

function SectionLabel({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionLabel}>
      <ThemedText style={styles.sectionLabelText}>{title}</ThemedText>
      <View style={styles.sectionCount}>
        <ThemedText style={styles.sectionCountText}>{count}</ThemedText>
      </View>
    </View>
  );
}

export default function ClassesScreen() {
  const insets = useSafeAreaInsets();
  const { classes, loading, error, refetch, deleteClass } = useClasses();
  useFocusEffect(useCallback(() => { refetch(); }, []));
  const { profile, user } = useAuth();

  const isGuardian = profile?.role === 'guardian';
  const isLearner  = profile?.role === 'learner';
  const learnerGrade = isLearner ? (profile?.grades?.[0] ?? null) : null;

  const { data: guardianLearners } = useSupabaseQuery<Learner>('learners', {
    filter: q => q.eq('guardian_id', user?.id ?? NULL_UUID),
  });
  const { data: ownLearnerRow } = useSupabaseQuery<Learner>('learners', {
    filter: q => q.eq('profile_id', isLearner ? (user?.id ?? NULL_UUID) : NULL_UUID),
  });
  const { data: myApps, refetch: refetchMyApps } = useSupabaseQuery<EnrolmentApplication>('enrolment_applications', {
    select: 'subjects',
    filter: q => q.eq('learner_id', isLearner ? (ownLearnerRow[0]?.id ?? NULL_UUID) : NULL_UUID),
  });
  // useSupabaseQuery captures its filter once on mount — refetch once the learner id is known.
  useEffect(() => { if (ownLearnerRow[0]?.id) refetchMyApps(); }, [ownLearnerRow[0]?.id]);
  const enrolledSubjects: string[] = myApps[0]?.subjects ?? [];

  const learnerGrades = [...new Set(guardianLearners.map(l => l.grade))];
  const hasLearners = learnerGrades.length > 0;

  const gradeFiltered = learnerGrade
    ? classes.filter(c =>
        c.grade === learnerGrade &&
        (enrolledSubjects.length === 0 || enrolledSubjects.includes(c.subject))
      )
    : isGuardian && hasLearners
      ? classes.filter(c => learnerGrades.includes(c.grade))
      : classes;

  const liveClasses      = gradeFiltered.filter(c => c.live);
  const upcomingClasses  = gradeFiltered.filter(c => !c.live && !c.isPast);
  const pastClasses      = gradeFiltered.filter(c => c.isPast);

  function learnerIdsForClass(c: ClassItem): string[] {
    if (isLearner) return ownLearnerRow[0] ? [ownLearnerRow[0].id] : [];
    if (isGuardian) return guardianLearners.filter(l => l.grade === c.grade).map(l => l.id);
    return [];
  }

  const canManage = (p: typeof profile) => p?.role === 'tutor' || p?.role === 'admin';
  const deleteHandler = (c: ClassItem) => () =>
    Alert.alert('Delete Class', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteClass(c.id) },
    ]);

  const platformPaddingTop = Platform.select({
    web: Spacing.six,
    default: insets.top,
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentInset={{ bottom: insets.bottom + BottomTabInset + Spacing.three }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop: platformPaddingTop }]}>

      <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '103%' }}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.headerTitle}>Classes</ThemedText>
            <ThemedText style={styles.headerSub}>
              {upcomingClasses.length} upcoming · {liveClasses.length} live{pastClasses.length > 0 ? ` · ${pastClasses.length} past` : ''}
            </ThemedText>
          </View>
          {(profile?.role === 'tutor' || profile?.role === 'admin') && (
            <Pressable
              style={({ pressed }) => [styles.createBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.push('/create-class')}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <ThemedText style={styles.createBtnText}>Create</ThemedText>
            </Pressable>
          )}
        </View>

        {/* LIVE BANNER */}
        {liveClasses.length > 0 && (
          <LinearGradient colors={[PRIMARY, '#0D3B23']} style={styles.liveBanner}>
            <View style={styles.liveBannerInner}>
              <View style={styles.liveIconWrap}>
                <Ionicons name="radio-outline" size={20} color="#4ADE80" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.liveBannerTitle}>
                  {liveClasses.length} class{liveClasses.length > 1 ? 'es' : ''} live right now
                </ThemedText>
                <ThemedText style={styles.liveBannerSub}>Tap a card below to join</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            </View>
          </LinearGradient>
        )}

        {/* FILTER PILLS
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const count = f === 'All' ? classes.length : f === 'Live' ? liveClasses.length : scheduledClasses.length;
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterPill, active && styles.filterPillActive]}>
                {f === 'Live' && (
                  <View style={[styles.filterDot, active ? styles.filterDotActive : styles.filterDotInactive]} />
                )}
                <ThemedText style={[styles.filterText, active && styles.filterTextActive]}>{f}</ThemedText>
                <View style={[styles.countBubble, active && styles.countBubbleActive]}>
                  <ThemedText style={[styles.countBubbleText, active && styles.countBubbleTextActive]}>
                    {count}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View> */}

        {/* LOADING / ERROR STATES */}
        {loading && (
          <View style={styles.stateContainer}>
            <Ionicons name="sync-outline" size={28} color="#9CA3AF" />
            <ThemedText style={styles.stateText}>Loading classes…</ThemedText>
          </View>
        )}
        {!loading && error && (
          <View style={styles.stateContainer}>
            <Ionicons name="cloud-offline-outline" size={32} color="#EF4444" />
            <ThemedText style={styles.stateText}>Could not load classes</ThemedText>
            <Pressable style={styles.retryBtn} onPress={refetch}>
              <ThemedText style={styles.retryText}>Retry</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Grade filter banner */}
        {isGuardian && !hasLearners && !loading && (
          <View style={styles.gradeBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#1565C0" />
            <ThemedText style={styles.gradeBannerText}>
              Enrol a learner to see classes for their grade
            </ThemedText>
            <Pressable onPress={() => router.push('/enroll')}>
              <ThemedText style={styles.gradeBannerLink}>Enrol →</ThemedText>
            </Pressable>
          </View>
        )}

        {/* CARDS */}
        {!loading && !error && (
          <>
            {liveClasses.length > 0 && (
              <>
                <SectionLabel title="Live Now" count={liveClasses.length} />
                <View style={styles.list}>
                  {liveClasses.map(c => <ClassCard key={c.id} item={c} learnerIds={learnerIdsForClass(c)}
                    onDelete={canManage(profile) ? deleteHandler(c) : undefined} />)}
                </View>
              </>
            )}
            {upcomingClasses.length > 0 && (
              <>
                <SectionLabel title="Upcoming" count={upcomingClasses.length} />
                <View style={styles.list}>
                  {upcomingClasses.map(c => <ClassCard key={c.id} item={c} learnerIds={learnerIdsForClass(c)}
                    onDelete={canManage(profile) ? deleteHandler(c) : undefined} />)}
                </View>
              </>
            )}
            {pastClasses.length > 0 && (
              <>
                <SectionLabel title="History" count={pastClasses.length} />
                <View style={styles.list}>
                  {pastClasses.map(c => <ClassCard key={c.id} item={c} learnerIds={learnerIdsForClass(c)}
                    onDelete={canManage(profile) ? deleteHandler(c) : undefined} />)}
                </View>
              </>
            )}
            {liveClasses.length === 0 && upcomingClasses.length === 0 && pastClasses.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="calendar-outline" size={32} color="#9CA3AF" />
                </View>
                <ThemedText style={styles.emptyTitle}>No classes yet</ThemedText>
                <ThemedText style={styles.emptyDesc}>Check back later.</ThemedText>
              </View>
            )}
          </>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: Spacing.five },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  liveBanner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    borderRadius: 8,
    padding: Spacing.three,
  },
  liveBannerInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  liveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  liveBannerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  filterPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  filterDot: { width: 7, height: 7, borderRadius: 999 },
  filterDotActive: { backgroundColor: '#4ADE80' },
  filterDotInactive: { backgroundColor: '#EF4444' },
  countBubble: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 20,
    alignItems: 'center',
  },
  countBubbleActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countBubbleText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  countBubbleTextActive: { color: '#fff' },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionLabelText: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sectionCountText: { fontSize: 11, fontWeight: '700', color: '#374151' },

  list: { paddingHorizontal: Spacing.four, gap: Spacing.three, marginBottom: Spacing.two },

  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardLiveBorder: { borderWidth: 1, borderColor: PRIMARY + '35' },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardMeta: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardTagRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  gradeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  gradeTagText: { fontSize: 10, fontWeight: '700' },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
 
  },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#e60808' },
  liveBadgeText: { color: '#dd0c0c', fontSize: 11, fontWeight: '700' },

  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    
  },
  scheduledBadgeText: { color: '#101011', fontSize: 11, fontWeight: '700' },

  pastBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pastBadgeText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },

  cardPast: { opacity: 0.65 },
  textMuted: { color: '#9CA3AF' },

  countdownChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: PRIMARY + '12', borderRadius: 6,
    paddingVertical: 3, paddingHorizontal: 7,
  },
  countdownText: { fontSize: 11, color: PRIMARY, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#e0e2e6' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tutorChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 10, fontWeight: '800' },
  tutorName: { fontSize: 12, color: '#374151', fontWeight: '600', flex: 1 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  timeText: { fontSize: 12, color: '#6B7280' },

  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
  },
  deleteBtn: {
    width: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2', borderRadius: 8,
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: Spacing.two,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  stateContainer: { alignItems: 'center', paddingVertical: 48, gap: Spacing.two },
  stateText: { fontSize: 14, color: '#9CA3AF' },
  retryBtn: { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: Spacing.one },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  gradeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.four, marginBottom: Spacing.two,
    backgroundColor: '#EFF6FF', borderRadius: 8, padding: Spacing.two + 4,
  },
  gradeBannerText: { flex: 1, fontSize: 13, color: '#1E40AF' },
  gradeBannerLink: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
});
