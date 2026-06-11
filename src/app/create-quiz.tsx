import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ALL_GRADES, subjectsForGrade } from '@/constants/curriculum';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';

const PRIMARY = '#1565C0';
const BLUE = '#1565C0';
const BG = '#F7F9F8';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
type Diff = typeof DIFFICULTIES[number];
const DIFF_COLOR: Record<Diff, string> = { easy: '#16A34A', medium: '#D97706', hard: '#DC2626' };

const DURATIONS = [15, 30, 45, 60];

export default function CreateQuizScreen() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<Diff>('medium');
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState('10');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const availableSubjects = grade ? subjectsForGrade(grade) : [];

  function selectGrade(g: string) { setGrade(g); setSubject(''); }

  async function handleDraft() {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    if (!grade) return Alert.alert('Required', 'Select a grade.');
    if (!subject) return Alert.alert('Required', 'Select a subject.');
    const qCount = parseInt(questions, 10);
    if (!qCount || qCount < 1) return Alert.alert('Required', 'Enter number of questions.');
    setSaving(true);
    const { error } = await supabase.from('quizzes').insert({
      title: title.trim(), grade, difficulty,
      duration_minutes: duration, questions: qCount,
      description: description.trim() || null,
      is_published: false,
      created_by: user!.id,
    });
    setSaving(false);
    if (error) return Alert.alert('Error', 'Could not save draft.');
    router.back();
  }

  async function handlePublish() {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    if (!grade) return Alert.alert('Required', 'Select a grade.');
    if (!subject) return Alert.alert('Required', 'Select a subject.');
    const qCount = parseInt(questions, 10);
    if (!qCount || qCount < 1) return Alert.alert('Required', 'Enter number of questions.');

    log.info('Quiz', 'Publishing quiz…', { title, grade, subject, difficulty });
    setSaving(true);
    const { data: newQuiz, error } = await supabase.from('quizzes').insert({
      title:            title.trim(),
      grade,
      difficulty,
      duration_minutes: duration,
      questions:        qCount,
      description:      description.trim() || null,
      is_published:     true,
      created_by:       user!.id,
    }).select('id').single();
    setSaving(false);

    if (error || !newQuiz) {
      log.error('Quiz', 'Insert failed', error);
      Alert.alert('Error', 'Could not publish quiz. Try again.');
      return;
    }
    log.ok('Quiz', 'Published — going to questions editor', { id: newQuiz.id });
    router.replace({ pathname: '/quiz-questions/[id]', params: { id: newQuiz.id, title: title.trim() } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={[styles.container, Platform.OS === 'android' && { paddingBottom: Spacing.five }]}
        keyboardShouldPersistTaps="handled">

        <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', gap: Spacing.three }}>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Quiz Title *</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Chapter 3 Revision"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Grade */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Grade *</ThemedText>
            <View style={styles.pillRow}>
              {ALL_GRADES.map(g => (
                <Pressable key={g} onPress={() => selectGrade(g)}
                  style={[styles.pill, grade === g && styles.pillActive]}>
                  <ThemedText style={[styles.pillText, { color: grade === g ? '#fff' : '#374151' }]}>{g}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Subject */}
          {grade ? (
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Subject *</ThemedText>
              <View style={styles.pillRow}>
                {availableSubjects.map(s => (
                  <Pressable key={s} onPress={() => setSubject(s)}
                    style={[styles.pill, subject === s && styles.pillActive]}>
                    <ThemedText style={[styles.pillText, { color: subject === s ? '#fff' : '#374151' }]}>{s}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.hint}>
              <Ionicons name="arrow-up-circle-outline" size={15} color="#9CA3AF" />
              <ThemedText style={styles.hintText}>Select a grade to pick subject</ThemedText>
            </View>
          )}

          {/* Difficulty */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Difficulty</ThemedText>
            <View style={styles.pillRow}>
              {DIFFICULTIES.map(d => (
                <Pressable key={d} onPress={() => setDifficulty(d)}
                  style={[styles.pill, difficulty === d && { backgroundColor: DIFF_COLOR[d] }]}>
                  <ThemedText style={[styles.pillText, { color: difficulty === d ? '#fff' : '#374151', textTransform: 'capitalize' }]}>
                    {d}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Duration */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Duration (minutes)</ThemedText>
            <View style={styles.pillRow}>
              {DURATIONS.map(d => (
                <Pressable key={d} onPress={() => setDuration(d)}
                  style={[styles.pill, duration === d && { backgroundColor: BLUE }]}>
                  <ThemedText style={[styles.pillText, { color: duration === d ? '#fff' : '#374151' }]}>{d} min</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Questions */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Number of Questions *</ThemedText>
            <TextInput
              style={styles.input}
              value={questions}
              onChangeText={setQuestions}
              placeholder="e.g. 10"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
            />
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="What topics does this quiz cover?"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              style={[styles.draftBtn, saving && { opacity: 0.6 }]}
              onPress={handleDraft}
              disabled={saving}>
              <ThemedText style={styles.draftBtnText}>Save as Draft</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.publishBtn, { flex: 1 }, saving && { opacity: 0.6 }]}
              onPress={handlePublish}
              disabled={saving}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <ThemedText style={styles.publishBtnText}>
                {saving ? 'Saving…' : 'Publish Quiz'}
              </ThemedText>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: Spacing.three, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  pillActive: { backgroundColor: PRIMARY },
  pillText: { fontSize: 13, fontWeight: '600' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontSize: 13, color: '#9CA3AF' },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1565C0', paddingVertical: Spacing.three,
    borderRadius: 8, marginTop: Spacing.two,
  },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  draftBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6', paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three, borderRadius: 8, marginTop: Spacing.two,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  draftBtnText: { color: '#374151', fontSize: 14, fontWeight: '700' },
});
