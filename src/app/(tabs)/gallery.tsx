import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Dimensions, FlatList, Modal,
  Pressable, StyleSheet, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { EmptyState } from '@/components/empty-state';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTopInset } from '@/hooks/use-top-inset';
import { supabase } from '@/utils/supabase';

import PhotosIllustration from '@/assets/illustrations/photos.svg';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';
const COLS = 2;
const GAP = 10;
const ITEM = (Dimensions.get('window').width - Spacing.four * 2 - GAP) / COLS;

type GalleryItem = { id: string; url: string; caption: string | null; created_at: string };

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const { profile } = useAuth();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<GalleryItem | null>(null);

  useFocusEffect(useCallback(() => { fetchGallery(); }, []));

  async function fetchGallery() {
    setLoading(true);
    const { data } = await supabase
      .from('gallery')
      .select('id, url, caption, created_at')
      .order('created_at', { ascending: false });
    setItems((data as GalleryItem[]) ?? []);
    setLoading(false);
  }

  const paddingTop = topInset + Spacing.three;

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <ThemedText style={styles.title}>Gallery</ThemedText>
        {profile?.role === 'admin' && (
          <Pressable style={styles.uploadBtn}>
            <Ionicons name="add" size={20} color={PRIMARY} />
            <ThemedText style={styles.uploadText}>Add</ThemedText>
          </Pressable>
        )}
      </View>

      {loading ? (
        <LoadingDots style={{ marginTop: 40, alignSelf: 'center' }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState illustration={PhotosIllustration} title="No photos yet" sub="School activity photos will appear here." />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{
            paddingHorizontal: Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.three,
            gap: GAP,
          }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setPreview(item)} style={styles.thumb}>
              <Image
                source={{ uri: item.url }}
                style={styles.thumbImg}
                contentFit="cover"
                transition={200}
              />
              {item.caption && (
                <View style={styles.captionWrap}>
                  <ThemedText style={styles.caption} numberOfLines={1}>{item.caption}</ThemedText>
                </View>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Fullscreen preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.overlay} onPress={() => setPreview(null)}>
          <Image
            source={{ uri: preview?.url }}
            style={styles.fullImg}
            contentFit="contain"
          />
          {preview?.caption && (
            <View style={styles.fullCaption}>
              <ThemedText style={styles.fullCaptionText}>{preview.caption}</ThemedText>
            </View>
          )}
          <Pressable style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={() => setPreview(null)}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingBottom: Spacing.three,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 8,
    paddingHorizontal: Spacing.two + 4, paddingVertical: 6,
  },
  uploadText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  thumb: {
    width: ITEM, height: ITEM, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  thumbImg: { width: '100%', height: '100%' },
  captionWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 5,
  },
  caption: { fontSize: 11, color: '#fff', fontWeight: '600' },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
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
});
