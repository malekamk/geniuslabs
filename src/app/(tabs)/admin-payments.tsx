import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { LoadingDots } from '@/components/loading-dots';
import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/utils/supabase';
import { sendNotifications } from '@/utils/notify';
import { useTopInset } from '@/hooks/use-top-inset';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { Payment } from '@/types/db';

import PaymentIllustration from '@/assets/illustrations/payment.svg';

const PRIMARY = '#1565C0';
const BG = '#F5F6FA';

type Filter = 'all' | 'pending' | 'paid' | 'overdue';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid',    label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

const PAY_COLOR: Record<string, { bg: string; text: string }> = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  pending: { bg: '#FEF3C7', text: '#92400E' },
  overdue: { bg: '#FEE2E2', text: '#991B1B' },
  failed:  { bg: '#FEE2E2', text: '#991B1B' },
  waived:  { bg: '#F3F4F6', text: '#6B7280' },
};

export default function AdminPayments() {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const [filter, setFilter] = useState<Filter>('all');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOut, setTotalOut] = useState(0);

  useFocusEffect(useCallback(() => { fetchPayments(); }, [filter]));

  async function fetchPayments() {
    setLoading(true);
    let q = supabase.from('payments').select('*').order('due_date', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    const list = (data ?? []) as Payment[];
    setPayments(list);

    const [{ data: paid }, { data: out }] = await Promise.all([
      supabase.from('payments').select('amount').eq('status', 'paid'),
      supabase.from('payments').select('amount').in('status', ['pending', 'overdue']),
    ]);
    setTotalPaid((paid ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0));
    setTotalOut((out ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0));
    setLoading(false);
  }

  async function markPaid(p: Payment) {
    Alert.alert('Mark as Paid', `Mark R${p.amount} ${p.type} payment as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid', style: 'default',
        onPress: async () => {
          await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', p.id);
          await sendNotifications(
            p.guardian_id,
            'Payment Confirmed',
            `Your ${p.type} payment of R${p.amount} has been marked as received. Thank you!`,
            'payment_due',
          );
          fetchPayments();
        },
      },
    ]);
  }

  const paddingTop = topInset + Spacing.three;

  return (
    <View style={[styles.root, { paddingTop }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <ThemedText style={styles.title}>Payments</ThemedText>
      </View>

      {/* Summary banner */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <ThemedText style={styles.summaryVal}>R {totalPaid.toLocaleString('en-ZA')}</ThemedText>
          <ThemedText style={styles.summaryLbl}>Total Paid</ThemedText>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <ThemedText style={[styles.summaryVal, { color: '#D97706' }]}>R {totalOut.toLocaleString('en-ZA')}</ThemedText>
          <ThemedText style={styles.summaryLbl}>Outstanding</ThemedText>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable key={f.key} style={[styles.filterPill, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}>
            <ThemedText style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <LoadingDots style={{ marginTop: 40 }} />
      ) : payments.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState illustration={PaymentIllustration} title={`No ${filter === 'all' ? '' : filter + ' '}payments`} sub="Payments will show up here once recorded." />
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.three, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => {
            const sc = PAY_COLOR[item.status] ?? PAY_COLOR.pending;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.icon, { backgroundColor: sc.bg }]}>
                    <Ionicons name="cash-outline" size={18} color={sc.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.amount}>R {Number(item.amount).toLocaleString('en-ZA')}</ThemedText>
                    <ThemedText style={styles.sub}>
                      {item.type} · {item.due_date ? `Due ${new Date(item.due_date).toLocaleDateString('en-ZA')}` : 'No due date'}
                    </ThemedText>
                  </View>
                  <View style={[styles.chip, { backgroundColor: sc.bg }]}>
                    <ThemedText style={[styles.chipText, { color: sc.text }]}>{item.status}</ThemedText>
                  </View>
                </View>
                {item.status !== 'paid' && item.status !== 'waived' && (
                  <Pressable style={styles.markPaidBtn} onPress={() => markPaid(item)}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={PRIMARY} />
                    <ThemedText style={styles.markPaidText}>Mark as Paid</ThemedText>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  summary: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: Spacing.four, borderRadius: 8, padding: Spacing.three, marginBottom: Spacing.two, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryVal: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryLbl: { fontSize: 12, color: '#6B7280' },
  summaryDivider: { width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.four, gap: Spacing.one, marginBottom: Spacing.two },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterActive: { backgroundColor: '#000', borderColor: '#000' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: Spacing.three, gap: Spacing.two, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  amount: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  markPaidBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  markPaidText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
});
