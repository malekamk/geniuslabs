import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import type { QuizQuestion } from '@/types/db';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

const QUESTION_TYPES = ['multiple_choice', 'true_false'] as const;
type QType = typeof QUESTION_TYPES[number];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function QuizQuestionsScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();

  const { data: questions, loading, refetch } = useSupabaseQuery<QuizQuestion>('quiz_questions', {
    filter: q => q.eq('quiz_id', id).order('sort_order', { ascending: true }),
  });

  const [qType, setQType] = useState<QType>('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function resetForm() {
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectAnswer('');
    setExplanation('');
    setQType('multiple_choice');
    setShowForm(false);
  }

  async function handleSave() {
    if (!questionText.trim()) return Alert.alert('Required', 'Enter the question text.');
    if (qType === 'multiple_choice') {
      const filled = options.filter(o => o.trim());
      if (filled.length < 2) return Alert.alert('Required', 'Add at least 2 options.');
      if (!correctAnswer) return Alert.alert('Required', 'Select the correct answer.');
    }
    if (qType === 'true_false' && !correctAnswer) return Alert.alert('Required', 'Select True or False as correct answer.');

    const optionObjects = qType === 'multiple_choice'
      ? options.filter(o => o.trim()).map((text, i) => ({ label: OPTION_LABELS[i], text }))
      : [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }];

    setSaving(true);
    log.info('QuizQuestions', 'Adding question…', { quiz_id: id, type: qType });
    const { error } = await supabase.from('quiz_questions').insert({
      quiz_id:       id,
      question_text: questionText.trim(),
      type:          qType,
      options:       optionObjects,
      correct_answer: correctAnswer,
      explanation:   explanation.trim() || null,
      sort_order:    questions.length,
    });
    setSaving(false);

    if (error) {
      log.error('QuizQuestions', 'Insert failed', error);
      Alert.alert('Error', 'Could not save question.');
      return;
    }
    log.ok('QuizQuestions', 'Question added');
    // Update quiz question count
    await supabase.from('quizzes').update({ questions: questions.length + 1 }).eq('id', id);
    resetForm();
    refetch();
  }

  async function handleDelete(qId: string) {
    const { error } = await supabase.from('quiz_questions').delete().eq('id', qId);
    if (!error) refetch();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', gap: Spacing.three }}>

          {/* Existing questions */}
          {loading ? (
            <ThemedText style={styles.hint}>Loading…</ThemedText>
          ) : questions.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="help-circle-outline" size={36} color="#D1D5DB" />
              <ThemedText style={styles.hint}>No questions yet. Add your first one below.</ThemedText>
            </View>
          ) : (
            questions.map((q, i) => (
              <View key={q.id} style={styles.qCard}>
                <View style={styles.qCardTop}>
                  <View style={styles.qNum}>
                    <ThemedText style={styles.qNumText}>{i + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.qText}>{q.question_text}</ThemedText>
                  <Pressable onPress={() => handleDelete(q.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                </View>
                {Array.isArray(q.options) && q.options.map((opt: any) => (
                  <View key={opt.label} style={[styles.optRow, opt.label === q.correct_answer && styles.optCorrect]}>
                    <ThemedText style={[styles.optLabel, opt.label === q.correct_answer && { color: '#065F46' }]}>
                      {opt.label}
                    </ThemedText>
                    <ThemedText style={[styles.optText, opt.label === q.correct_answer && { color: '#065F46' }]}>
                      {opt.text}
                    </ThemedText>
                    {opt.label === q.correct_answer && <Ionicons name="checkmark-circle" size={14} color="#16A34A" />}
                  </View>
                ))}
              </View>
            ))
          )}

          {/* Add question */}
          {!showForm ? (
            <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
              <ThemedText style={styles.addBtnText}>Add Question</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.form}>
              {/* Type */}
              <View style={styles.row}>
                {QUESTION_TYPES.map(t => (
                  <Pressable key={t} onPress={() => { setQType(t); setCorrectAnswer(''); }}
                    style={[styles.typePill, qType === t && styles.typePillActive]}>
                    <ThemedText style={[styles.typePillText, qType === t && { color: '#fff' }]}>
                      {t === 'multiple_choice' ? 'Multiple Choice' : 'True / False'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.input}
                value={questionText}
                onChangeText={setQuestionText}
                placeholder="Question text…"
                placeholderTextColor="#9CA3AF"
                multiline
              />

              {qType === 'multiple_choice' && (
                <>
                  {options.map((opt, i) => (
                    <View key={i} style={styles.optInput}>
                      <Pressable
                        onPress={() => setCorrectAnswer(OPTION_LABELS[i])}
                        style={[styles.optCircle, correctAnswer === OPTION_LABELS[i] && styles.optCircleActive]}>
                        <ThemedText style={[styles.optCircleText, correctAnswer === OPTION_LABELS[i] && { color: '#fff' }]}>
                          {OPTION_LABELS[i]}
                        </ThemedText>
                      </Pressable>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        value={opt}
                        onChangeText={v => { const o = [...options]; o[i] = v; setOptions(o); }}
                        placeholder={`Option ${OPTION_LABELS[i]}`}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  ))}
                  <ThemedText style={styles.hint}>Tap a letter to mark the correct answer</ThemedText>
                </>
              )}

              {qType === 'true_false' && (
                <View style={styles.row}>
                  {['True', 'False'].map(v => (
                    <Pressable key={v} onPress={() => setCorrectAnswer(v === 'True' ? 'A' : 'B')}
                      style={[styles.typePill, correctAnswer === (v === 'True' ? 'A' : 'B') && styles.typePillActive]}>
                      <ThemedText style={[styles.typePillText, correctAnswer === (v === 'True' ? 'A' : 'B') && { color: '#fff' }]}>
                        {v}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}

              <TextInput
                style={styles.input}
                value={explanation}
                onChangeText={setExplanation}
                placeholder="Explanation (shown after answer) — optional"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.row}>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#F3F4F6', flex: 1 }]} onPress={resetForm}>
                  <ThemedText style={[styles.actionBtnText, { color: '#6B7280' }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: PRIMARY, flex: 1 }, saving && { opacity: 0.6 }]}
                  onPress={handleSave} disabled={saving}>
                  <ThemedText style={[styles.actionBtnText, { color: '#fff' }]}>
                    {saving ? 'Saving…' : 'Save Question'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
  empty: { alignItems: 'center', gap: 8, paddingVertical: Spacing.five },
  hint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  qCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  qCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qNum: { width: 26, height: 26, borderRadius: 8, backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center' },
  qNumText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  qText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  deleteBtn: { padding: 4 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8 },
  optCorrect: { backgroundColor: '#D1FAE5' },
  optLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', width: 18 },
  optText: { flex: 1, fontSize: 13, color: '#374151' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three,
    borderWidth: 1.5, borderColor: PRIMARY + '40', borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },

  form: {
    backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: Spacing.two,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', gap: 8 },
  typePill: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  typePillActive: { backgroundColor: PRIMARY },
  typePillText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
    marginBottom: 0,
  },
  optInput: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optCircle: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },
  optCircleActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  optCircleText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  actionBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
});
