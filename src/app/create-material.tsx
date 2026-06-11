import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { ALL_GRADES, subjectsForGrade } from '@/constants/curriculum';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { uploadToStorage } from '@/utils/upload';
import { log } from '@/utils/logger';

const PRIMARY = '#1565C0';
const BG = '#F7F9F8';

const MATERIAL_TYPES = ['pdf', 'video', 'notes', 'worksheet', 'exam_paper'] as const;
type MatType = typeof MATERIAL_TYPES[number];

const TYPE_LABELS: Record<MatType, string> = {
  pdf: 'PDF Document',
  video: 'Video Lesson',
  notes: 'Notes',
  worksheet: 'Worksheet',
  exam_paper: 'Exam Paper',
};

function Dropdown({
  label, value, placeholder, options, onSelect,
}: {
  label: string; value: string; placeholder: string;
  options: string[]; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={dd.group}>
      <ThemedText style={dd.label}>{label}</ThemedText>
      <Pressable style={dd.trigger} onPress={() => setOpen(true)}>
        <ThemedText style={[dd.triggerText, !value && { color: '#9CA3AF' }]}>
          {value || placeholder}
        </ThemedText>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={dd.backdrop} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <ThemedText style={dd.sheetTitle}>{label}</ThemedText>
            <ScrollView bounces={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[dd.option, value === opt && dd.optionActive]}
                  onPress={() => { onSelect(opt); setOpen(false); }}>
                  <ThemedText style={[dd.optionText, value === opt && { color: PRIMARY, fontWeight: '700' }]}>
                    {opt}
                  </ThemedText>
                  {value === opt && <Ionicons name="checkmark" size={16} color={PRIMARY} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function CreateMaterialScreen() {
  const { user } = useAuth();

  const [title, setTitle]             = useState('');
  const [grade, setGrade]             = useState('');
  const [subject, setSubject]         = useState('');
  const [type, setType]               = useState<MatType>('notes');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [localUri, setLocalUri]       = useState('');
  const [localMime, setLocalMime]     = useState('');
  const [fileName, setFileName]       = useState('');
  const [saving, setSaving]           = useState(false);

  const availableSubjects = grade ? subjectsForGrade(grade) : [];

  function handleGradeSelect(g: string) { setGrade(g); setSubject(''); }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'video/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setLocalUri(asset.uri);
      setLocalMime(asset.mimeType ?? 'application/octet-stream');
      setFileName(asset.name);
      const mime = asset.mimeType ?? '';
      if (mime === 'application/pdf') setType('pdf');
      else if (mime.startsWith('video/')) setType('video');
      else if (mime.startsWith('image/')) setType('notes');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not pick file.');
    }
  }

  async function handlePublish() {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    if (!grade) return Alert.alert('Required', 'Select a grade.');
    if (!subject) return Alert.alert('Required', 'Select a subject.');
    if (!localUri && !externalUrl.trim()) return Alert.alert('Required', 'Pick a file or add a link.');

    setSaving(true);
    try {
      let fileUrl: string | null = null;
      if (localUri) {
        const ext = (fileName.split('.').pop() ?? 'pdf').toLowerCase();
        const path = `${user!.id}/${Date.now()}.${ext}`;
        fileUrl = await uploadToStorage('materials', path, localUri, localMime);
        log.ok('Material', 'Uploaded', { path });
      }

      const { error } = await supabase.from('materials').insert({
        title:        title.trim(),
        grade,
        subject,
        type,
        description:  description.trim() || null,
        file_url:     fileUrl,
        external_url: externalUrl.trim() || null,
        is_published: true,
        created_by:   user!.id,
      });

      if (error) {
        log.error('Material', 'Insert failed', error);
        Alert.alert('Error', 'Could not publish material. Try again.');
        return;
      }
      log.ok('Material', 'Published', { title });
      router.back();
    } catch (e: any) {
      log.error('Material', 'Publish failed', e);
      Alert.alert('Upload Failed', e.message ?? 'Could not upload file.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={[styles.container, Platform.OS === 'android' && { paddingBottom: Spacing.five }]}
        keyboardShouldPersistTaps="handled">

        <View style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', gap: Spacing.three }}>

          {/* Title */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Title *</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Grade 10 Algebra Notes"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Grade */}
          <Dropdown
            label="Grade *"
            value={grade}
            placeholder="Select grade…"
            options={ALL_GRADES}
            onSelect={handleGradeSelect}
          />

          {/* Subject */}
          <Dropdown
            label="Subject *"
            value={subject}
            placeholder={grade ? 'Select subject…' : 'Select a grade first'}
            options={availableSubjects}
            onSelect={setSubject}
          />

          {/* Type */}
          <Dropdown
            label="Type"
            value={type ? TYPE_LABELS[type as MatType] : ''}
            placeholder="Select type…"
            options={MATERIAL_TYPES.map(t => TYPE_LABELS[t])}
            onSelect={v => setType(MATERIAL_TYPES.find(t => TYPE_LABELS[t] === v) ?? 'notes')}
          />

          {/* File picker */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>File</ThemedText>
            {localUri ? (
              <View style={styles.fileChip}>
                <Ionicons name="document-attach-outline" size={16} color={PRIMARY} />
                <ThemedText style={styles.fileChipText} numberOfLines={1}>{fileName}</ThemedText>
                <Pressable onPress={() => { setLocalUri(''); setFileName(''); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.uploadBtn} onPress={pickFile}>
                <Ionicons name="folder-open-outline" size={20} color={PRIMARY} />
                <ThemedText style={styles.uploadText}>Pick file from device (PDF, image, video)</ThemedText>
              </Pressable>
            )}
          </View>

          {/* External URL */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>
              Or paste a link
              <ThemedText style={{ color: '#9CA3AF', fontWeight: '400' }}> (YouTube, Google Drive…)</ThemedText>
            </ThemedText>
            <TextInput
              style={styles.input}
              value={externalUrl}
              onChangeText={setExternalUrl}
              placeholder="https://…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="Short description of what this covers…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable
            style={[styles.publishBtn, saving && { opacity: 0.6 }]}
            onPress={handlePublish}
            disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
            <ThemedText style={styles.publishBtnText}>
              {saving ? 'Publishing…' : 'Publish Material'}
            </ThemedText>
          </Pressable>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const dd = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: Spacing.three, paddingVertical: 13,
    backgroundColor: '#fff',
  },
  triggerText: { fontSize: 15, color: '#111827' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: Spacing.three, paddingBottom: Spacing.five,
    maxHeight: '60%',
  },
  sheetTitle: {
    fontSize: 14, fontWeight: '700', color: '#374151',
    paddingHorizontal: Spacing.four, paddingBottom: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  optionActive: { backgroundColor: PRIMARY + '08' },
  optionText: { fontSize: 15, color: '#111827' },
});

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
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: PRIMARY + '60',
    borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: 14,
    backgroundColor: PRIMARY + '06',
  },
  uploadText: { flex: 1, fontSize: 14, color: PRIMARY, fontWeight: '500' },
  fileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY + '10', borderRadius: 8,
    paddingHorizontal: Spacing.three, paddingVertical: 10,
    borderWidth: 1, borderColor: PRIMARY + '30',
  },
  fileChipText: { flex: 1, fontSize: 14, color: PRIMARY, fontWeight: '500' },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, paddingVertical: Spacing.three,
    borderRadius: 8, marginTop: Spacing.two,
  },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
