import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/themed-text';
import { LoadingRow } from '@/components/loading-dots';
import { useAuth } from '@/context/auth-context';
import { useNotifications } from '@/context/notification-context';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import type { ChatRoomMessage, ChatRoomRead } from '@/types/db';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const TUTOR_COLOR = '#1565C0';
const SENT_COLOR = PRIMARY;
const BG = '#F2F2F7';

type MsgWithSender = ChatRoomMessage & { sender_name: string };

type ListItem =
  | { type: 'date'; label: string; id: string }
  | { type: 'msg'; data: MsgWithSender; isFirst: boolean; isLast: boolean };

/** Groups consecutive messages from the same sender and adds date dividers. */
function buildItems(msgs: MsgWithSender[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const d = new Date(m.created_at);
    const label = dateLabel(d);

    if (label !== lastDate) {
      items.push({ type: 'date', label, id: `date-${m.created_at}` });
      lastDate = label;
    }

    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    const isFirst = !prev || prev.sender_id !== m.sender_id;
    const isLast  = !next || next.sender_id !== m.sender_id;

    items.push({ type: 'msg', data: m, isFirst, isLast });
  }
  return items;
}

function dateLabel(d: Date): string {
  const today = new Date();
  const diff = today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0);
  if (diff === 0) return 'Today';
  if (diff === 86_400_000) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ChatRoomScreen() {
  const { subjectId, grade, subjectName } = useLocalSearchParams<{
    subjectId: string; grade: string; subjectName: string;
  }>();
  const { profile } = useAuth();
  const { triggerLocal } = useNotifications();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);

  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgWithSender[]>([]);
  const [reads, setReads] = useState<ChatRoomRead[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId || !grade) return;
    upsertRoom();
  }, [subjectId, grade]);

  // Re-fetch when screen comes back into focus
  useFocusEffect(useCallback(() => {
    if (chatRoomId) fetchMessages();
  }, [chatRoomId]));

  useEffect(() => {
    if (!chatRoomId) return;
    fetchMessages();

    const channel = supabase
      .channel(`crm:${chatRoomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'chat_room_messages',
        filter: `chat_room_id=eq.${chatRoomId}`,
      }, async (payload) => {
        const msg = payload.new as ChatRoomMessage;
        const { data: p } = await supabase
          .from('profiles').select('id, full_name').eq('id', msg.sender_id).single();
        const full: MsgWithSender = { ...msg, sender_name: p?.full_name ?? 'Unknown' };
        setMessages(prev => [...prev, full]);
        AsyncStorage.setItem(`chat_read_${subjectId}_${grade}`, msg.created_at);
        if (profile) {
          supabase.from('chat_room_reads').upsert({
            chat_room_id: chatRoomId,
            profile_id: profile.id,
            last_read_at: msg.created_at,
          }, { onConflict: 'chat_room_id,profile_id' });
        }
        fetchReads();
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        if (msg.sender_id !== profile?.id)
          triggerLocal(`${subjectName} · Grade ${grade}`, `${p?.full_name ?? 'Someone'}: ${msg.content.slice(0, 80)}`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatRoomId]);

  async function upsertRoom() {
    const { data: existing } = await supabase
      .from('chat_rooms').select('id')
      .eq('subject_id', subjectId).eq('grade', grade).maybeSingle();
    if (existing) { setChatRoomId(existing.id); return; }
    const { data } = await supabase
      .from('chat_rooms').insert({ subject_id: subjectId, grade }).select('id').single();
    if (data) setChatRoomId(data.id);
  }

  async function fetchMessages() {
    setLoading(true);
    const { data } = await supabase
      .from('chat_room_messages')
      .select('*, sender:profiles!chat_room_messages_sender_id_fkey(id, full_name)')
      .eq('chat_room_id', chatRoomId!)
      .order('created_at', { ascending: true });
    const msgs = (data ?? []).map((m: any) => ({ ...m, sender_name: m.sender?.full_name ?? 'Unknown' }));
    setMessages(msgs);
    if (msgs.length && subjectId && grade) {
      const lastCreatedAt = msgs[msgs.length - 1].created_at;
      AsyncStorage.setItem(`chat_read_${subjectId}_${grade}`, lastCreatedAt);
      if (profile) {
        supabase.from('chat_room_reads').upsert({
          chat_room_id: chatRoomId,
          profile_id: profile.id,
          last_read_at: lastCreatedAt,
        }, { onConflict: 'chat_room_id,profile_id' });
      }
    }
    fetchReads();
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 120);
  }

  async function fetchReads() {
    if (!chatRoomId || !profile) return;
    const { data } = await supabase
      .from('chat_room_reads')
      .select('*')
      .eq('chat_room_id', chatRoomId)
      .neq('profile_id', profile.id);
    setReads(data ?? []);
  }

  async function send() {
    const content = text.trim();
    if (!content || !profile || !chatRoomId || sending) return;
    setSending(true);
    setText('');
    const role = profile.role === 'tutor' ? 'tutor' : profile.role === 'admin' ? 'admin' : 'learner';
    const { error } = await supabase.from('chat_room_messages').insert({
      chat_room_id: chatRoomId,
      sender_id: profile.id,
      sender_role: role,
      content,
    });
    if (error) {
      log.warn('ChatRoom', 'Send failed', error);
      Alert.alert('Send failed', error.message);
      setText(content); // restore text so user doesn't lose it
    }
    setSending(false);
  }

  const items = buildItems(messages);
  const paddingTop = Platform.select({ web: Spacing.six, default: insets.top });

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>

      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={PRIMARY} />
        </Pressable>
        <View style={[styles.headerAvatar, { backgroundColor: PRIMARY + '18' }]}>
          <Ionicons name="people-outline" size={18} color={PRIMARY} />
        </View>
        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>{subjectName}</ThemedText>
          <ThemedText style={styles.headerSub}>Grade {grade} · Group</ThemedText>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <LoadingRow label="Loading…" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyText}>👋 Be the first to say something!</ThemedText>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={item => item.type === 'date' ? item.id : item.data.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === 'date') return <DateDivider label={item.label} />;
            const mine = item.data.sender_id === profile?.id;
            const seenCount = mine && item.isLast
              ? reads.filter(r => r.last_read_at >= item.data.created_at).length
              : 0;
            return (
              <Bubble
                msg={item.data}
                mine={mine}
                isFirst={item.isFirst}
                isLast={item.isLast}
                seenCount={seenCount}
              />
            );
          }}
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendBtn, { opacity: text.trim().length === 0 || sending ? 0.35 : 1 }]}
          onPress={send}
          disabled={text.trim().length === 0 || sending}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Date Divider ─────────────────────────────────────────────────────────────

function DateDivider({ label }: { label: string }) {
  return (
    <View style={dd.wrap}>
      <ThemedText style={dd.text}>{label}</ThemedText>
    </View>
  );
}

const dd = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 12 },
  text: { fontSize: 12, color: '#8E8E93', fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3 },
});

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ msg, mine, isFirst, isLast, seenCount }: {
  msg: MsgWithSender; mine: boolean; isFirst: boolean; isLast: boolean; seenCount?: number;
}) {
  const isTutor = msg.sender_role === 'tutor';
  const avatarColor = isTutor ? TUTOR_COLOR : PRIMARY;

  // Bubble corner radii for tail effect
  const radius = 18;
  const tail = 4;
  const bubbleRadius = mine
    ? { borderTopLeftRadius: radius, borderTopRightRadius: isFirst ? radius : radius,
        borderBottomLeftRadius: radius, borderBottomRightRadius: isLast ? tail : radius }
    : { borderTopLeftRadius: isFirst ? radius : radius, borderTopRightRadius: radius,
        borderBottomLeftRadius: isLast ? tail : radius, borderBottomRightRadius: radius };

  // Vertical gap: tighter within a group, looser between groups
  const marginBottom = isLast ? 10 : 2;

  return (
    <View style={[b.row, mine ? b.rowMine : b.rowOther, { marginBottom }]}>

      {/* Avatar column — only for received messages */}
      {!mine && (
        <View style={b.avatarCol}>
          {isLast ? (
            <View style={[b.avatar, { backgroundColor: avatarColor }]}>
              <ThemedText style={b.avatarTxt}>{initials(msg.sender_name)}</ThemedText>
            </View>
          ) : (
            <View style={b.avatarSpacer} />
          )}
        </View>
      )}

      {/* Bubble + metadata */}
      <View style={[b.col, mine ? b.colMine : b.colOther]}>
        {/* Sender name — first message in group only */}
        {!mine && isFirst && (
          <ThemedText style={[b.senderName, { color: avatarColor }]}>
            {msg.sender_name}{isTutor ? ' · Tutor' : ''}
          </ThemedText>
        )}

        <View style={[b.bubble, mine ? b.bubbleMine : b.bubbleOther, bubbleRadius]}>
          <ThemedText style={[b.text, mine && b.textMine]}>{msg.content}</ThemedText>
        </View>

        {/* Time — below bubble, outside */}
        {isLast && (
          <ThemedText style={[b.time, mine ? b.timeMine : b.timeOther]}>
            {fmtTime(msg.created_at)}
          </ThemedText>
        )}

        {/* Seen by — trailing indicator on sender's own latest message only */}
        {mine && isLast && !!seenCount && (
          <ThemedText style={b.seenBy}>Seen by {seenCount}</ThemedText>
        )}
      </View>
    </View>
  );
}

const AVATAR_SIZE = 32;

const b = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, alignItems: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  rowMine:  { justifyContent: 'flex-end' },

  avatarCol: { width: AVATAR_SIZE + 8, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 2 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  avatarSpacer: { width: AVATAR_SIZE, height: AVATAR_SIZE },

  col: { maxWidth: '72%', gap: 2 },
  colOther: { alignItems: 'flex-start' },
  colMine:  { alignItems: 'flex-end' },

  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 2, marginLeft: 4 },

  bubble: { paddingHorizontal: 14, paddingVertical: 9 },
  bubbleOther: {
    backgroundColor: '#fff',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  bubbleMine: { backgroundColor: SENT_COLOR },

  text: { fontSize: 16, lineHeight: 22, color: '#111' },
  textMine: { color: '#fff' },

  time: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  timeMine:  { alignSelf: 'flex-end', marginRight: 2 },
  timeOther: { alignSelf: 'flex-start', marginLeft: 4 },

  seenBy: { fontSize: 11, color: '#8E8E93', alignSelf: 'flex-end', marginRight: 2, marginTop: 1 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#C6C6C8',
    gap: 6,
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#000' },
  headerSub: { fontSize: 12, color: '#8E8E93' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#8E8E93' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#8E8E93' },

  list: { paddingTop: 8, paddingBottom: 8 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C6C6C8',
    paddingHorizontal: 12, paddingTop: 8,
  },
  input: {
    flex: 1, minHeight: 36, maxHeight: 110,
    backgroundColor: '#F2F2F7',
    borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#C6C6C8',
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 16, color: '#000',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
