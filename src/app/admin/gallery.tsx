import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Alert, Dimensions, FlatList, KeyboardAvoidingView,
  Modal, Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/utils/supabase';
import { uploadToStorage } from '@/utils/upload';
import { Spacing } from '@/constants/theme';

import PhotosIllustration from '@/assets/illustrations/photos.svg';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';
const COLS = 2;
const GAP = 10;
const ITEM = (Dimensions.get('window').width - Spacing.four * 2 - GAP) / COLS;

type GalleryItem = { id: string; url: string; caption: string | null; created_at: string };

export default function AdminGallery() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<GalleryItem | null>(null);
  const [captionModal, setCaptionModal] = useState<{ uri: string; mimeType: string } | null>(null);
  const [caption, setCaption] = useState('');

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from('gallery')
      .select('id, url, caption, created_at')
      .order('created_at', { ascending: false });
    setItems((data as GalleryItem[]) ?? []);
    setLoading(false);
  }

  async function pickAndUpload() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    setCaption('');
    setCaptionModal({ uri: asset.uri, mimeType: mime });
  }

  async function confirmUpload() {
    if (!captionModal) return;
    setUploading(true);
    setCaptionModal(null);
    try {
      const ext = captionModal.mimeType.split('/')[1] ?? 'jpg';
      const path = `gallery/${Date.now()}.${ext}`;
      const url = await uploadToStorage('gallery', path, captionModal.uri, captionModal.mimeType);
      const { data, error } = await supabase
        .from('gallery')
        .insert({ url, caption: caption.trim() || null })
        .select()
        .single();
      if (error) throw error;
      setItems(prev => [data as GalleryItem, ...prev]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteItem(item: GalleryItem) {
    Alert.alert('Delete photo', 'Remove this photo from the gallery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('gallery').delete().eq('id', item.id);
          if (error) { Alert.alert('Error', error.message); return; }
          setItems(prev => prev.filter(x => x.id !== item.id));
          if (preview?.id === item.id) setPreview(null);
        },
      },
    ]);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <StatusBar style="dark" />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={s.title}>Gallery</ThemedText>
          <ThemedText style={s.subtitle}>{items.length} photo{items.length !== 1 ? 's' : ''}</ThemedText>
        </View>
        <Pressable style={s.addBtn} onPress={pickAndUpload} disabled={uploading}>
          {uploading
            ? <LoadingDots size={6} />
            : <><Ionicons name="add" size={18} color={PRIMARY} /><ThemedText style={s.addText}>Add</ThemedText></>}
        </Pressable>
      </View>

      {loading ? (
        <LoadingDots style={{ marginTop: 40, alignSelf: 'center' }} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <EmptyState illustration={PhotosIllustration} title="No photos yet" sub="Tap Add to upload the first photo." />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 40, gap: GAP }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setPreview(item)} style={s.thumb}>
              <Image source={{ uri: item.url }} style={s.thumbImg} contentFit="cover" transition={200} />
              {item.caption && (
                <View style={s.captionWrap}>
                  <ThemedText style={s.caption} numberOfLines={1}>{item.caption}</ThemedText>
                </View>
              )}
              <Pressable style={s.deleteOverlay} onPress={() => deleteItem(item)} hitSlop={4}>
                <Ionicons name="trash-outline" size={14} color="#fff" />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {/* Fullscreen preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={s.overlay} onPress={() => setPreview(null)}>
          <Image source={{ uri: preview?.url }} style={s.fullImg} contentFit="contain" />
          {preview?.caption && (
            <View style={s.fullCaption}>
              <ThemedText style={s.fullCaptionText}>{preview.caption}</ThemedText>
            </View>
          )}
          <Pressable style={[s.closeBtn, { top: insets.top + 12 }]} onPress={() => setPreview(null)}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <Pressable style={[s.fullDelete, { top: insets.top + 12 }]} onPress={() => preview && deleteItem(preview)}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Caption modal */}
      <Modal visible={!!captionModal} transparent animationType="slide" onRequestClose={() => setCaptionModal(null)}>
        <KeyboardAvoidingView style={s.captionSheet} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.captionCard}>
            <ThemedText style={s.captionTitle}>Add a caption (optional)</ThemedText>
            <TextInput
              style={s.captionInput}
              placeholder="e.g. Science fair 2025"
              placeholderTextColor="#9CA3AF"
              value={caption}
              onChangeText={setCaption}
              autoFocus
            />
            <View style={s.captionBtns}>
              <Pressable style={s.cancelBtn} onPress={() => setCaptionModal(null)}>
                <ThemedText style={s.cancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={s.uploadConfirmBtn} onPress={confirmUpload}>
                <ThemedText style={s.uploadConfirmText}>Upload</ThemedText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, minWidth: 64, justifyContent: 'center',
  },
  addText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  thumb: { width: ITEM, height: ITEM, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  thumbImg: { width: '100%', height: '100%' },
  captionWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 5,
  },
  caption: { fontSize: 11, color: '#fff', fontWeight: '600' },
  deleteOverlay: {
    position: 'absolute', top: 6, right: 6,
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullImg: { width: '100%', height: '75%' },
  fullCaption: {
    position: 'absolute', bottom: 60, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: 12,
  },
  fullCaptionText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  closeBtn: {
    position: 'absolute', right: 16,
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  fullDelete: {
    position: 'absolute', right: 60,
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: 'rgba(220,38,38,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  captionSheet: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  captionCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: Spacing.four, gap: Spacing.three },
  captionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  captionInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  captionBtns: { flexDirection: 'row', gap: Spacing.two },
  cancelBtn: { flex: 1, padding: 13, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
  uploadConfirmBtn: { flex: 1, padding: 13, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  uploadConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
