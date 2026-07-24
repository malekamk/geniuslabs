import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import type { QuizQuestion } from '@/types/db';

import ExamsIllustration from '@/assets/illustrations/exams.svg';

const PRIMARY = '#1A6B3C';
const BLUE = '#1565C0';
const BG = '#F7F9F8';

export default function QuizScreen() {
  const { id, title, pass_score } = useLocalSearchParams<{ id: string; title?: string; pass_score?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: questions, loading } = useSupabaseQuery<QuizQuestion>('quiz_questions', {
    filter: q => q.eq('quiz_id', id).order('sort_order', { ascending: true }),
  });

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <Ionicons name="sync-outline" size={28} color="#9CA3AF" />
        <ThemedText style={styles.hint}>Loading quiz…</ThemedText>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.center}>
        <ExamsIllustration width={140} height={140} />
        <ThemedText style={styles.emptyTitle}>Quiz Coming Soon</ThemedText>
        <ThemedText style={styles.hint}>The tutor hasn&apos;t added questions yet.</ThemedText>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ThemedText style={styles.backBtnText}>Go Back</ThemedText>
        </Pressable>
      </View>
    );
  }

  const passScore = Number(pass_score ?? 50);
  const q = questions[current];
  const selected = answers[q?.id] ?? null;
  const isLast = current === questions.length - 1;

  function selectAnswer(label: string) {
    setAnswers(prev => ({ ...prev, [q.id]: label }));
  }

  async function handleSubmit() {
    const correct = questions.filter(q => {
      const given = answers[q.id];
      return given === q.correct_answer;
    }).length;
    const pct = Math.round((correct / questions.length) * 100);
    const passed = pct >= passScore;

    setSaving(true);
    log.info('Quiz', 'Submitting attempt…', { quiz_id: id, score: pct, passed });
    const { error } = await supabase.from('quiz_attempts').insert({
      profile_id:   user!.id,
      quiz_id:      id,
      score:        pct,
      passed,
      status:       'completed',
      answers,
      completed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) log.warn('Quiz', 'Attempt save failed', error);
    else log.ok('Quiz', 'Attempt saved', { score: pct, passed });
    setScore(pct);
    setSubmitted(true);
  }

  // Results screen
  if (submitted) {
    const passed = score >= passScore;
    const correct = questions.filter(q => answers[q.id] === q.correct_answer).length;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={styles.resultContainer}>
        <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', gap: Spacing.three }}>

          <View style={[styles.scoreCard, { borderColor: passed ? PRIMARY : '#EF4444' }]}>
            <View style={[styles.scoreCircle, { backgroundColor: passed ? PRIMARY : '#EF4444' }]}>
              <ThemedText style={styles.scoreNum}>{score}%</ThemedText>
            </View>
            <ThemedText style={styles.scoreLabel}>{passed ? 'Well done!' : 'Keep practising'}</ThemedText>
            <View style={[styles.passBadge, { backgroundColor: passed ? '#D1FAE5' : '#FEE2E2' }]}>
              <Ionicons name={passed ? 'checkmark-circle' : 'close-circle'} size={14} color={passed ? '#065F46' : '#991B1B'} />
              <ThemedText style={[styles.passBadgeText, { color: passed ? '#065F46' : '#991B1B' }]}>
                {passed ? 'Passed' : `Failed — need ${passScore}% to pass`}
              </ThemedText>
            </View>
            <ThemedText style={styles.statText}>{correct} of {questions.length} correct</ThemedText>
          </View>

          {/* Answer review */}
          {questions.map((q, i) => {
            const given = answers[q.id];
            const isRight = given === q.correct_answer;
            const opts: any[] = Array.isArray(q.options) ? q.options : [];
            return (
              <View key={q.id} style={[styles.reviewCard, { borderLeftColor: isRight ? PRIMARY : '#EF4444' }]}>
                <View style={styles.reviewTop}>
                  <Ionicons name={isRight ? 'checkmark-circle' : 'close-circle'} size={16} color={isRight ? PRIMARY : '#EF4444'} />
                  <ThemedText style={styles.reviewQ}>{i + 1}. {q.question_text}</ThemedText>
                </View>
                {opts.map((opt: any) => (
                  <View key={opt.label} style={[
                    styles.reviewOpt,
                    opt.label === q.correct_answer && styles.reviewOptCorrect,
                    opt.label === given && opt.label !== q.correct_answer && styles.reviewOptWrong,
                  ]}>
                    <ThemedText style={styles.reviewOptLabel}>{opt.label}</ThemedText>
                    <ThemedText style={styles.reviewOptText}>{opt.text}</ThemedText>
                  </View>
                ))}
                {q.explanation ? (
                  <View style={styles.explanationRow}>
                    <Ionicons name="bulb-outline" size={13} color="#D97706" />
                    <ThemedText style={styles.explanationText}>{q.explanation}</ThemedText>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <ThemedText style={styles.doneBtnText}>Back to Tasks</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // Quiz taking
  const opts: any[] = Array.isArray(q?.options) ? q.options : [];
  const answered = Object.keys(answers).length;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(current / questions.length) * 100}%` as any }]} />
      </View>

      <ScrollView contentContainerStyle={[styles.quizContainer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', gap: Spacing.three }}>

          <View style={styles.qMeta}>
            <ThemedText style={styles.qCounter}>Question {current + 1} of {questions.length}</ThemedText>
            <ThemedText style={styles.qAnswered}>{answered} answered</ThemedText>
          </View>

          <View style={styles.questionCard}>
            <ThemedText style={styles.questionText}>{q?.question_text}</ThemedText>
          </View>

          <View style={{ gap: 10 }}>
            {opts.map(opt => {
              const isSel = selected === opt.label;
              return (
                <Pressable
                  key={opt.label}
                  style={[styles.optBtn, isSel && styles.optBtnSelected]}
                  onPress={() => selectAnswer(opt.label)}>
                  <View style={[styles.optLabelCircle, isSel && styles.optLabelCircleSelected]}>
                    <ThemedText style={[styles.optLabelText, isSel && { color: '#fff' }]}>{opt.label}</ThemedText>
                  </View>
                  <ThemedText style={[styles.optBtnText, isSel && { color: BLUE, fontWeight: '700' }]}>
                    {opt.text}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.navRow}>
            {current > 0 && (
              <Pressable style={styles.prevBtn} onPress={() => setCurrent(c => c - 1)}>
                <Ionicons name="chevron-back" size={16} color="#6B7280" />
                <ThemedText style={styles.prevBtnText}>Back</ThemedText>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {isLast ? (
              <Pressable
                style={[styles.nextBtn, { backgroundColor: PRIMARY }, (!selected || saving) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!selected || saving}>
                <ThemedText style={styles.nextBtnText}>{saving ? 'Submitting…' : 'Submit Quiz'}</ThemedText>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.nextBtn, !selected && { opacity: 0.5 }]}
                onPress={() => setCurrent(c => c + 1)}
                disabled={!selected}>
                <ThemedText style={styles.nextBtnText}>Next</ThemedText>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </Pressable>
            )}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, gap: Spacing.two, padding: Spacing.four },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  hint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  backBtn: { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: Spacing.two },
  backBtnText: { color: '#fff', fontWeight: '700' },

  progressBar: { height: 4, backgroundColor: '#E5E7EB' },
  progressFill: { height: '100%', backgroundColor: BLUE },

  quizContainer: { padding: Spacing.four },
  qMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  qCounter: { fontSize: 13, fontWeight: '700', color: '#374151' },
  qAnswered: { fontSize: 13, color: '#9CA3AF' },

  questionCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.four,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  questionText: { fontSize: 16, fontWeight: '600', color: '#111827', lineHeight: 24 },

  optBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  optBtnSelected: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  optLabelCircle: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  optLabelCircleSelected: { backgroundColor: BLUE, borderColor: BLUE },
  optLabelText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  optBtnText: { flex: 1, fontSize: 14, color: '#374151' },

  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.two },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 8 },
  prevBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BLUE, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Results
  resultContainer: { padding: Spacing.four, paddingBottom: Spacing.six },
  scoreCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.four,
    alignItems: 'center', gap: Spacing.two,
    borderWidth: 2,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  scoreCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum: { fontSize: 28, fontWeight: '900', color: '#fff' },
  scoreLabel: { fontSize: 18, fontWeight: '800', color: '#111827' },
  passBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  passBadgeText: { fontSize: 13, fontWeight: '700' },
  statText: { fontSize: 13, color: '#6B7280' },

  reviewCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: 8,
    borderLeftWidth: 3,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  reviewTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reviewQ: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  reviewOpt: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  reviewOptCorrect: { backgroundColor: '#D1FAE5' },
  reviewOptWrong: { backgroundColor: '#FEE2E2' },
  reviewOptLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', width: 18 },
  reviewOptText: { flex: 1, fontSize: 13, color: '#374151' },
  explanationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8 },
  explanationText: { flex: 1, fontSize: 12, color: '#92400E' },

  doneBtn: {
    backgroundColor: PRIMARY, paddingVertical: Spacing.three, borderRadius: 8,
    alignItems: 'center', marginTop: Spacing.two,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
