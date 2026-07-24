import * as ExpoNotifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/auth-context';
import type { Notification } from '@/types/db';

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

const PERMISSION_STATUS_KEY = 'notif_permission_status';
const PROMPTED_ONCE_KEY = 'notif_prompted_once';

type NotificationContextType = {
  unreadCount: number;
  chatUnread: number;
  tasksUnread: number;
  permissionStatus: PermissionStatus;
  enableNotifications: () => Promise<void>;
  triggerLocal: (title: string, body: string) => Promise<void>;
  markAllRead: () => void;
  markChatRead: () => void;
  markTasksRead: () => void;
};

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  chatUnread: 0,
  tasksUnread: 0,
  permissionStatus: 'undetermined',
  enableNotifications: async () => {},
  triggerLocal: async () => {},
  markAllRead: () => {},
  markChatRead: () => {},
  markTasksRead: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [tasksUnread, setTasksUnread] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const permGranted = useRef(false);
  const chatChannels = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => { initPermission(); }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, []);
  useEffect(() => { if (profile?.id && permissionStatus === 'granted') registerPushToken(); }, [profile?.id, permissionStatus]);

  // ── System notifications (DB table) ──────────────────────────────
  useEffect(() => {
    if (!profile) return;
    fetchUnread();

    const ch = supabase
      .channel(`notifs:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${profile.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setUnreadCount(c => c + 1);
        if (n.type === 'new_material' || n.type === 'quiz_available') setTasksUnread(c => c + 1);
        triggerLocal(n.title, n.body);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  // ── Chat message notifications (global, always active) ───────────
  useEffect(() => {
    if (!profile) return;

    // Clean up previous chat subscriptions
    for (const ch of chatChannels.current) supabase.removeChannel(ch);
    chatChannels.current = [];

    subscribeToChatRooms();

    return () => {
      for (const ch of chatChannels.current) supabase.removeChannel(ch);
      chatChannels.current = [];
    };
  }, [profile?.id]);

  async function subscribeToChatRooms() {
    if (!profile) return;

    // Build the (subject_id, grade) pairs this user has access to
    let pairs: { subject_id: string; grade: string }[] = [];

    if (profile.role === 'tutor') {
      const subjectNames = profile.subjects ?? [];
      const grades = profile.grades ?? [];
      if (subjectNames.length && grades.length) {
        const { data: subjectRows } = await supabase
          .from('subjects').select('id').in('name', subjectNames);
        for (const s of subjectRows ?? [])
          for (const g of grades)
            pairs.push({ subject_id: (s as any).id, grade: g });
      }
    } else if (profile.role === 'learner') {
      const { data: learnerRow } = await supabase
        .from('learners').select('id, grade, full_name').eq('profile_id', profile.id).single();
      if (learnerRow) {
        let { data: apps } = await supabase
          .from('enrolment_applications').select('subjects')
          .eq('learner_id', learnerRow.id).limit(1);
        if (!apps?.length) {
          const { data } = await supabase
            .from('enrolment_applications').select('subjects')
            .ilike('learner_name', learnerRow.full_name.trim()).limit(1);
          apps = data;
        }
        const subjectNames: string[] = apps?.[0]?.subjects ?? [];
        if (subjectNames.length) {
          const { data: subjectRows } = await supabase
            .from('subjects').select('id').in('name', subjectNames);
          for (const s of subjectRows ?? [])
            pairs.push({ subject_id: (s as any).id, grade: learnerRow.grade });
        }
      }
    }

    if (!pairs.length) return;

    // Upsert chat rooms so they always exist before we subscribe
    await supabase.from('chat_rooms')
      .upsert(pairs.map(p => ({ subject_id: p.subject_id, grade: p.grade })), { onConflict: 'subject_id,grade' });

    // Fetch the IDs of those rooms
    const { data: rooms } = await supabase
      .from('chat_rooms').select('id')
      .in('subject_id', pairs.map(p => p.subject_id));

    let chatRoomIds: string[] = (rooms ?? []).map((r: any) => r.id);

    // Subscribe to each chat room for new messages
    for (const roomId of chatRoomIds) {
      const ch = supabase
        .channel(`chat-notif:${roomId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public',
          table: 'chat_room_messages',
          filter: `chat_room_id=eq.${roomId}`,
        }, async (payload) => {
          const msg = payload.new as { sender_id: string; content: string; chat_room_id: string };
          if (msg.sender_id === profile.id) return; // own message

          setUnreadCount(c => c + 1);
          setChatUnread(c => c + 1);

          // Resolve sender name + room details
          const [{ data: sender }, { data: room }] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('id', msg.sender_id).single(),
            supabase.from('chat_rooms')
              .select('grade, subjects!inner(name)')
              .eq('id', msg.chat_room_id)
              .single(),
          ]);

          const senderName = (sender as any)?.full_name ?? 'Someone';
          const subjectName = (room as any)?.subjects?.name ?? 'Group Chat';
          const grade = (room as any)?.grade ?? '';
          const title = `${subjectName} · Grade ${grade}`;
          const body = `${senderName}: ${msg.content.slice(0, 120)}`;

          // Persist to notifications table so the bell screen shows it
          await supabase.from('notifications').insert({
            profile_id: profile.id,
            title,
            body,
            type: 'general',
            read: false,
            data: { chat_room_id: msg.chat_room_id, subject: subjectName, grade },
          });

          triggerLocal(title, body);
        })
        .subscribe();
      chatChannels.current.push(ch);
    }
  }

  function applyStatus(status: PermissionStatus) {
    setPermissionStatus(status);
    permGranted.current = status === 'granted';
    AsyncStorage.setItem(PERMISSION_STATUS_KEY, status);
  }

  async function initPermission() {
    if (Platform.OS === 'web') return;
    const cached = await AsyncStorage.getItem(PERMISSION_STATUS_KEY) as PermissionStatus | null;
    if (cached) applyStatus(cached);

    const { status } = await ExpoNotifications.getPermissionsAsync();
    applyStatus(status as PermissionStatus);

    const prompted = await AsyncStorage.getItem(PROMPTED_ONCE_KEY);
    if (!prompted && status === 'undetermined') {
      await AsyncStorage.setItem(PROMPTED_ONCE_KEY, 'true');
      // Explain why before the OS permission sheet appears, rather than
      // requesting it with zero context on first login.
      Alert.alert(
        'Stay in the loop',
        'Turn on notifications to get updates on classes, messages, and announcements.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              const { status: newStatus } = await ExpoNotifications.requestPermissionsAsync();
              applyStatus(newStatus as PermissionStatus);
            },
          },
        ]
      );
    }
  }

  async function refreshPermission() {
    if (Platform.OS === 'web') return;
    const { status } = await ExpoNotifications.getPermissionsAsync();
    applyStatus(status as PermissionStatus);
  }

  async function enableNotifications() {
    if (Platform.OS === 'web') return;
    if (permissionStatus === 'denied') {
      Linking.openSettings();
      return;
    }
    await AsyncStorage.setItem(PROMPTED_ONCE_KEY, 'true');
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    applyStatus(status as PermissionStatus);
  }

  async function registerPushToken() {
    if (Platform.OS === 'web' || !Device.isDevice || !profile?.id) return;
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const { data: token } = await ExpoNotifications.getExpoPushTokenAsync({ projectId });
      if (token) {
        await supabase.from('profiles').update({ push_token: token }).eq('id', profile.id);
      }
    } catch {
      // unavailable in simulator or Expo Go — non-fatal
    }
  }

  async function fetchUnread() {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('type, data')
      .eq('profile_id', profile.id)
      .eq('read', false);
    const rows = (data ?? []) as { type: string; data: Record<string, unknown> | null }[];
    setUnreadCount(rows.length);
    setChatUnread(rows.filter(r => r.data?.chat_room_id).length);
    setTasksUnread(rows.filter(r => r.type === 'new_material' || r.type === 'quiz_available').length);
  }

  async function triggerLocal(title: string, body: string) {
    if (Platform.OS === 'web' || !permGranted.current) return;
    await ExpoNotifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  }

  function markAllRead() { setUnreadCount(0); setChatUnread(0); setTasksUnread(0); }
  function markChatRead() { setChatUnread(0); }
  function markTasksRead() { setTasksUnread(0); }

  return (
    <NotificationContext.Provider value={{ unreadCount, chatUnread, tasksUnread, permissionStatus, enableNotifications, triggerLocal, markAllRead, markChatRead, markTasksRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
