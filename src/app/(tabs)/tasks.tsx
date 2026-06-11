import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useNotifications } from '@/context/notification-context';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { Alert, Linking } from 'react-native';
import { supabase } from '@/utils/supabase';
import type { Material as DBMaterial, Quiz as DBQuiz, Learner, EnrolmentApplication, UserMaterialProgress } from '@/types/db';

const PRIMARY = '#1565C0';
const BLUE = '#1565C0';
const BG = '#F7F9F8';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Status = 'new' | 'in-progress' | 'done';
type Filter = 'All' | 'Materials' | 'Quizzes';

// App-level enriched types (DB row + local status overlay)
type Material = DBMaterial & { localStatus: Status };
type Quiz = DBQuiz & { localStatus: Status; localScore?: number };

const SUBJECT_ICONS: Record<string, IoniconName> = {
  Mathematics: 'calculator-outline',
  'Physical Sciences': 'flask-outline',
  'Life Sciences': 'bug-outline',
  Accounting: 'cash-outline',
  English: 'reader-outline',
  'Business Studies': 'briefcase-outline',
  Geography: 'map-outline',
  History: 'time-outline',
};

const STATUS_CONFIG = {
  new: { label: 'New', color: BLUE, bg: '#EFF6FF', icon: 'sparkles-outline' as IoniconName },
  'in-progress': { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', icon: 'time-outline' as IoniconName },
  done: { label: 'Done', color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle-outline' as IoniconName },
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <ThemedText style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</ThemedText>
    </View>
  );
}

const TYPE_CONFIG: Record<string, {
  label: string; icon: IoniconName; actionLabel: string; actionIcon: IoniconName;
  grad: [string, string];
}> = {
  pdf:        { label: 'PDF',        icon: 'document-text',    actionLabel: 'Open PDF', actionIcon: 'document-outline',  grad: ['#DC2626', '#991B1B'] },
  video:      { label: 'Video',      icon: 'play-circle',      actionLabel: 'Watch',    actionIcon: 'play',               grad: ['#7C3AED', '#4C1D95'] },
  notes:      { label: 'Notes',      icon: 'create',           actionLabel: 'View',     actionIcon: 'eye-outline',        grad: ['#0891B2', '#0E7490'] },
  worksheet:  { label: 'Worksheet',  icon: 'clipboard',        actionLabel: 'Open',     actionIcon: 'download-outline',   grad: ['#D97706', '#92400E'] },
  exam_paper: { label: 'Exam Paper', icon: 'reader',           actionLabel: 'Open',     actionIcon: 'download-outline',   grad: ['#16A34A', '#14532D'] },
};



function MaterialCard({ item, onAction, onDelete }: { item: Material; onAction: (id: string, next: Status) => void; onDelete?: () => void }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.notes;
  const subjectName = item.subject?.name ?? '';
  const next: Status = item.localStatus === 'new' ? 'in-progress' : item.localStatus === 'in-progress' ? 'done' : 'new';
  const isDone = item.localStatus === 'done';

  const accentColor = isDone ? '#16A34A' : cfg.grad[0];
  const meta = [subjectName, item.grade?.replace('Grade ', 'Gr ')].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [mc.card, pressed && { opacity: 0.93 }]}
      onPress={() => {
        onAction(item.id, next);
        const url = item.external_url ?? item.file_url;
        if (!isDone && url) Linking.openURL(url).catch(() => {});
      }}>
      <View style={[mc.accent, { backgroundColor: accentColor }]} />
      <View style={mc.inner}>
        <View style={[mc.iconBox, { backgroundColor: accentColor + '18' }]}>
          <Ionicons name={isDone ? 'checkmark-circle' : cfg.icon} size={22} color={accentColor} />
        </View>
        <View style={mc.textCol}>
          <ThemedText style={mc.title} numberOfLines={2}>{item.title}</ThemedText>
          <ThemedText style={mc.meta}>{cfg.label}{meta ? ` · ${meta}` : ''}</ThemedText>
        </View>
        <View style={mc.actions}>
          <Pressable style={[mc.ctaBtn, isDone && mc.ctaBtnDone]} onPress={() => onAction(item.id, next)} hitSlop={6}>
            <ThemedText style={[mc.ctaLabel, isDone && mc.ctaLabelDone]}>
              {isDone ? 'Done' : cfg.actionLabel}
            </ThemedText>
          </Pressable>
          {onDelete && (
            <Pressable onPress={onDelete} hitSlop={8} style={mc.trashBtn}>
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function QuizCard({ item, isTutor, onStart, onDelete }: { item: Quiz; isTutor: boolean; onStart: () => void; onDelete: () => void }) {
  const subjectName = item.subject?.name ?? '';
  const icon = SUBJECT_ICONS[subjectName] ?? 'help-circle-outline';
  const accentColor = item.localStatus === 'done' ? '#16A34A' : BLUE;
  return (
    <View style={[styles.card, item.localStatus === 'in-progress' && styles.cardHighlight]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIconWrap, { backgroundColor: accentColor + '12' }]}>
          <Ionicons name="help-circle-outline" size={22} color={accentColor} />
        </View>
        <View style={styles.cardMeta}>
          <ThemedText style={styles.cardTitle} numberOfLines={2}>{item.title}</ThemedText>
          <View style={styles.cardTagRow}>
            {subjectName ? (
              <View style={[styles.tag, { backgroundColor: accentColor + '12' }]}>
                <Ionicons name={icon} size={10} color={accentColor} />
                <ThemedText style={[styles.tagText, { color: accentColor }]}>{subjectName}</ThemedText>
              </View>
            ) : null}
            <View style={styles.tag}>
              <Ionicons name="school-outline" size={10} color="#9CA3AF" />
              <ThemedText style={styles.tagText}>{item.grade}</ThemedText>
            </View>
          </View>
        </View>
        {item.localStatus === 'done' && item.localScore !== undefined ? (
          <View style={[styles.scoreBadge, { backgroundColor: item.localScore >= 80 ? '#DCFCE7' : '#FEF9C3' }]}>
            <ThemedText style={[styles.scoreText, { color: item.localScore >= 80 ? '#15803D' : '#92400E' }]}>
              {item.localScore}%
            </ThemedText>
          </View>
        ) : (
          <StatusBadge status={item.localStatus} />
        )}
        {isTutor && !item.is_published && (
          <View style={styles.draftBadge}>
            <ThemedText style={styles.draftBadgeText}>Draft</ThemedText>
          </View>
        )}
        {isTutor && (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteIconBtn}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </Pressable>
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.cardBottom}>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="list-outline" size={13} color="#9CA3AF" />
            <ThemedText style={styles.metaText}>{item.questions} questions</ThemedText>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="timer-outline" size={13} color="#9CA3AF" />
            <ThemedText style={styles.metaText}>{item.duration_minutes} min</ThemedText>
          </View>
        </View>
        {isTutor ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#7C3AED', opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push({ pathname: '/quiz-questions/[id]', params: { id: item.id, title: item.title } })}>
            <Ionicons name="create-outline" size={14} color="#fff" />
            <ThemedText style={[styles.actionBtnText, { color: '#fff' }]}>Manage Questions</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: item.localStatus === 'done' ? '#F3F4F6' : accentColor, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={onStart}>
            <Ionicons
              name={item.localStatus === 'done' ? 'refresh-outline' : item.localStatus === 'in-progress' ? 'play' : 'arrow-forward-circle-outline'}
              size={14}
              color={item.localStatus === 'done' ? '#6B7280' : '#fff'}
            />
            <ThemedText style={[styles.actionBtnText, { color: item.localStatus === 'done' ? '#6B7280' : '#fff' }]}>
              {item.localStatus === 'done' ? 'Retry' : item.localStatus === 'in-progress' ? 'Resume' : 'Start Quiz'}
            </ThemedText>
          </Pressable>
        )}
      </View>
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

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
      <ThemedText style={styles.errorText}>{message}</ThemedText>
      <Pressable onPress={onRetry} style={styles.retryBtn}>
        <ThemedText style={styles.retryText}>Retry</ThemedText>
      </Pressable>
    </View>
  );
}

const FILTERS: Filter[] = ['All', 'Materials', 'Quizzes'];

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { markTasksRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>('All');
  const [localStatus, setLocalStatus] = useState<Record<string, Status>>({});

  const { data: progressRows, refetch: progressRefetch } = useSupabaseQuery<UserMaterialProgress>(
    'user_material_progress',
    { filter: q => q.eq('profile_id', user?.id ?? '') }
  );
  const statusMap: Record<string, Status> = Object.fromEntries(
    progressRows.map(p => [p.material_id, p.status as Status])
  );

  async function deleteMaterial(matId: string, matTitle: string) {
    Alert.alert('Delete Material', `Delete "${matTitle}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('materials').delete().eq('id', matId);
        matRefetch();
      }},
    ]);
  }

  async function deleteQuiz(quizId: string, quizTitle: string) {
    Alert.alert('Delete Quiz', `Delete "${quizTitle}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('quizzes').delete().eq('id', quizId);
        quizRefetch();
      }},
    ]);
  }

  async function updateProgress(materialId: string, status: Status) {
    setLocalStatus(prev => ({ ...prev, [materialId]: status }));
    await supabase.from('user_material_progress').upsert(
      { profile_id: user!.id, material_id: materialId, status },
      { onConflict: 'profile_id,material_id' }
    );
  }

  const isGuardian = profile?.role === 'guardian';
  const isLearner  = profile?.role === 'learner';
  const isTutor    = profile?.role === 'tutor' || profile?.role === 'admin';
  const learnerGrade = isLearner ? (profile?.grades?.[0] ?? null) : null;

  const { data: guardianLearners } = useSupabaseQuery<Learner>('learners', {
    filter: q => q.eq('guardian_id', user?.id ?? ''),
  });
  const { data: myApps } = useSupabaseQuery<EnrolmentApplication>('enrolment_applications', {
    select: 'subjects',
    filter: q => q.eq('learner_name', isLearner ? (profile?.full_name ?? '') : ''),
  });
  const enrolledSubjects: string[] = myApps[0]?.subjects ?? [];

  const learnerGrades = [...new Set(guardianLearners.map(l => l.grade))];
  const hasLearners = learnerGrades.length > 0;

  const {
    data: rawMaterials,
    loading: matLoading,
    error: matError,
    refetch: matRefetch,
  } = useSupabaseQuery<DBMaterial>('materials', {
    select: '*, subject:subjects(name, icon_name)',
    filter: (q) => q.eq('is_published', true),
  });

  const {
    data: rawQuizzes,
    loading: quizLoading,
    error: quizError,
    refetch: quizRefetch,
  } = useSupabaseQuery<DBQuiz>('quizzes', {
    select: '*, subject:subjects(name, icon_name)',
    filter: (q) => (isTutor && user?.id)
      ? q.or(`is_published.eq.true,created_by.eq.${user.id}`)
      : q.eq('is_published', true),
  });

  const allMaterials: Material[] = rawMaterials.map(m => ({ ...m, localStatus: localStatus[m.id] ?? statusMap[m.id] ?? 'new' }));
  const allQuizzes: Quiz[]       = rawQuizzes.map(q => ({ ...q, localStatus: localStatus[q.id] ?? 'new' }));

  useFocusEffect(useCallback(() => { markTasksRead(); matRefetch(); quizRefetch(); progressRefetch(); }, []));

  const materials = learnerGrade
    ? allMaterials.filter(m =>
        m.grade === learnerGrade &&
        (enrolledSubjects.length === 0 || enrolledSubjects.includes(m.subject?.name ?? ''))
      )
    : isGuardian && hasLearners
      ? allMaterials.filter(m => learnerGrades.includes(m.grade))
      : allMaterials;
  const quizzes = learnerGrade
    ? allQuizzes.filter(q =>
        q.grade === learnerGrade &&
        (enrolledSubjects.length === 0 || enrolledSubjects.includes(q.subject?.name ?? ''))
      )
    : isGuardian && hasLearners
      ? allQuizzes.filter(q => learnerGrades.includes(q.grade))
      : allQuizzes;

  const platformPaddingTop = Platform.select({ web: Spacing.six, default: insets.top });

  const doneCount = [
    ...materials.filter((m) => m.localStatus === 'done'),
    ...quizzes.filter((q) => q.localStatus === 'done'),
  ].length;
  const totalCount = materials.length + quizzes.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentInset={{ bottom: insets.bottom + BottomTabInset + Spacing.three }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop: platformPaddingTop }]}>

      <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' }}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.headerTitle}>Tasks</ThemedText>
            <ThemedText style={styles.headerSub}>
              {doneCount} of {totalCount} completed
            </ThemedText>
          </View>
          {isTutor ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={({ pressed }) => [styles.createBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() => router.push('/create-material')}>
                <Ionicons name="document-attach-outline" size={16} color="#fff" />
                <ThemedText style={styles.createBtnText}>Material</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.createBtn, { backgroundColor: '#1565C0', opacity: pressed ? 0.85 : 1 }]}
                onPress={() => router.push('/create-quiz')}>
                <Ionicons name="help-circle-outline" size={16} color="#fff" />
                <ThemedText style={styles.createBtnText}>Quiz</ThemedText>
              </Pressable>
            </View>
          ) : !isLearner && (
            <Pressable
              style={({ pressed }) => [styles.enrollBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.push('/enroll')}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <ThemedText style={styles.enrollBtnText}>Enrol</ThemedText>
            </Pressable>
          )}
        </View>

        {/* Grade filter banner */}
        {isGuardian && !hasLearners && (
          <View style={styles.gradeBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#1565C0" />
            <ThemedText style={styles.gradeBannerText}>Enrol a learner to see tasks for their grade</ThemedText>
            <Pressable onPress={() => router.push('/enroll')}>
              <ThemedText style={styles.gradeBannerLink}>Enrol →</ThemedText>
            </Pressable>
          </View>
        )}

        {/* PROGRESS BAR */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <ThemedText style={styles.progressText}>{progressPct}% complete</ThemedText>
        </View>

        {/* FILTER PILLS */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const count = f === 'All' ? totalCount : f === 'Materials' ? materials.length : quizzes.length;
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterPill, active && styles.filterPillActive]}>
                <ThemedText style={[styles.filterText, active && styles.filterTextActive]}>{f}</ThemedText>
                <View style={[styles.countBubble, active && styles.countBubbleActive]}>
                  <ThemedText style={[styles.countBubbleText, active && styles.countBubbleTextActive]}>{count}</ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* MATERIALS */}
        {(filter === 'All' || filter === 'Materials') && (
          <>
            <SectionLabel title="Study Materials" count={materials.length} />
            {matError ? (
              <InlineError message="Could not load materials" onRetry={matRefetch} />
            ) : matLoading ? (
              <View style={styles.loadingRow}>
                <Ionicons name="sync-outline" size={16} color="#9CA3AF" />
                <ThemedText style={styles.loadingText}>Loading…</ThemedText>
              </View>
            ) : (
              <View style={styles.list}>
                {materials.map(m => <MaterialCard key={m.id} item={m} onAction={updateProgress} onDelete={isTutor ? () => deleteMaterial(m.id, m.title) : undefined} />)}
              </View>
            )}
          </>
        )}

        {/* QUIZZES */}
        {(filter === 'All' || filter === 'Quizzes') && (
          <>
            <SectionLabel title="Quizzes" count={quizzes.length} />
            {quizError ? (
              <InlineError message="Could not load quizzes" onRetry={quizRefetch} />
            ) : quizLoading ? (
              <View style={styles.loadingRow}>
                <Ionicons name="sync-outline" size={16} color="#9CA3AF" />
                <ThemedText style={styles.loadingText}>Loading…</ThemedText>
              </View>
            ) : (
              <View style={styles.list}>
                {quizzes.map(q => (
                  <QuizCard
                    key={q.id}
                    item={q}
                    isTutor={isTutor}
                    onStart={() => router.push({ pathname: '/quiz/[id]', params: { id: q.id, title: q.title, pass_score: String(q.pass_score) } })}
                    onDelete={() => deleteQuiz(q.id, q.title)}
                  />
                ))}
              </View>
            )}
          </>
        )}

      </View>
    </ScrollView>
  );
}

const mc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  accent: { width: 4 },
  inner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 14, gap: 12,
  },
  iconBox: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textCol: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  meta: { fontSize: 12, color: '#9CA3AF', fontWeight: '400' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  ctaBtn: {
    backgroundColor: PRIMARY, borderRadius: 7,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  ctaBtnDone: { backgroundColor: '#F3F4F6' },
  ctaLabel: { fontSize: 12, color: '#fff', fontWeight: '700' },
  ctaLabelDone: { color: '#9CA3AF' },
  trashBtn: { padding: 4 },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: Spacing.five },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  gradeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.four, marginBottom: Spacing.two,
    backgroundColor: '#EFF6FF', borderRadius: 8, padding: Spacing.two + 4,
  },
  gradeBannerText: { flex: 1, fontSize: 13, color: '#1E40AF' },
  gradeBannerLink: { fontSize: 13, fontWeight: '700', color: '#1565C0' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#000', paddingHorizontal: Spacing.two + 4,
    paddingVertical: 9, borderRadius: 5,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#000',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 5,
  },
  enrollBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  progressSection: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: 6 },
  progressBar: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 999 },
  progressText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },

  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.four, gap: Spacing.two},
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 19, paddingVertical: 2, borderRadius: 4,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  filterPillActive: { backgroundColor: '#000', borderColor: '#000' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  countBubble: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, minWidth: 20, alignItems: 'center' },
  countBubbleActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countBubbleText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  countBubbleTextActive: { color: '#fff' },

  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.four, marginTop: Spacing.three, marginBottom: Spacing.two,
  },
  sectionLabelText: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  sectionCountText: { fontSize: 11, fontWeight: '700', color: '#374151' },

  list: { paddingHorizontal: Spacing.four, gap: Spacing.two },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  loadingText: { fontSize: 13, color: '#9CA3AF' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444' },
  retryBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  retryText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },

  card: {
    backgroundColor: '#fff', borderRadius: 4, padding: Spacing.three, gap: Spacing.two,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  cardHighlight: { borderWidth: 1.5, borderColor: BLUE + '30' },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  cardIconWrap: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardMeta: { flex: 1, gap: 5 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  cardTagRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '700' },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 14, fontWeight: '800' },

  divider: { height: 1, backgroundColor: '#F3F4F6' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', gap: Spacing.two },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#9CA3AF' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  deleteIconBtn: { padding: 4, marginLeft: 4 },
  draftBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  draftBadgeText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
});
