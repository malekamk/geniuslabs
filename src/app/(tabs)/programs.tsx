import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const PRIMARY = '#1565C0';
const BLUE = '#1565C0';
const BG = '#F7F9F8';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SUBJECT_ICONS: Record<string, IoniconName> = {
  Mathematics: 'calculator-outline',
  'Natural Sciences': 'leaf-outline',
  English: 'reader-outline',
  'Social Sciences': 'earth-outline',
  'Mathematical Literacy': 'trending-up-outline',
  'Physical Sciences': 'flask-outline',
  'Life Sciences': 'bug-outline',
  Accounting: 'cash-outline',
  'Business Studies': 'briefcase-outline',
  Geography: 'map-outline',
  History: 'time-outline',
  Afrikaans: 'chatbubble-outline',
};

const PROGRAMS = [
  {
    band: 'Grades 6 – 9',
    bandKey: 'junior',
    color: '#',
    gradientColors: ['#1565C0', '#0D3B23'] as const,
    tag: 'Foundation Phase',
    subjects: [
      { title: 'Mathematics', desc: 'Number work, algebra, geometry and data handling aligned to CAPS.' },
      { title: 'Natural Sciences', desc: 'Life and living, matter, energy and planet Earth concepts.' },
      { title: 'English', desc: 'Reading comprehension, writing skills and grammar support.' },
      { title: 'Social Sciences', desc: 'History, Geography, map work and essay technique.' },
    ],
  },
  {
    band: 'Grades 10 – 12',
    bandKey: 'senior',
    color: BLUE,
    gradientColors: ['#1565C0', '#0D47A1'] as const,
    tag: 'Senior Phase · NSC',
    subjects: [
      { title: 'Mathematics', desc: 'Functions, calculus, trigonometry and statistics for NSC.' },
      { title: 'Mathematical Literacy', desc: 'Real-life maths applications, finance and measurement.' },
      { title: 'Physical Sciences', desc: 'Physics and Chemistry — concepts, calculations and past papers.' },
      { title: 'Life Sciences', desc: 'Genetics, evolution, ecology and human biology exam prep.' },
      { title: 'Accounting', desc: 'Financial statements, ledgers and reconciliation support.' },
      { title: 'Business Studies', desc: 'Business environments, entrepreneurship and management.' },
      { title: 'Geography', desc: 'Geomorphology, climate, development geography and mapwork.' },
      { title: 'History', desc: 'Source analysis, essay structure and prescribed content.' },
      { title: 'English', desc: 'Literature, language and writing skills for NSC.' },
      { title: 'Afrikaans', desc: 'First and second additional language support.' },
    ],
  },
];

type Filter = 'All' | 'Gr 6–9' | 'Gr 10–12';
const FILTERS: Filter[] = ['All', 'Gr 6–9', 'Gr 10–12'];

function SectionLabel({ title, color, tag, count }: { title: string; color: string; tag: string; count: number }) {
  return (
    <View style={styles.sectionLabel}>
      <View style={[styles.sectionAccent, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.sectionTag}>{tag}</ThemedText>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      </View>
      <View style={styles.sectionCount}>
        <ThemedText style={styles.sectionCountText}>{count} subjects</ThemedText>
      </View>
    </View>
  );
}

function SubjectCard({ title, desc, color, onEnrol }: { title: string; desc: string; color: string; onEnrol: () => void }) {
  const iconName = SUBJECT_ICONS[title] ?? 'school-outline';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
          <Ionicons name={iconName} size={22} color={color} />
        </View>
        <View style={styles.cardMeta}>
          <ThemedText style={styles.cardTitle}>{title}</ThemedText>
          <ThemedText style={styles.cardDesc} numberOfLines={2}>{desc}</ThemedText>
        </View>
      </View>
      <View style={styles.divider} />
      <Pressable
        style={({ pressed }) => [styles.enrollBtn, { backgroundColor: '#000', opacity: pressed ? 0.85 : 1 }]}
        onPress={onEnrol}>
        <Ionicons name="clipboard-outline" size={14} color="#fff" />
        <ThemedText style={styles.enrollBtnText}>Enrol in this subject</ThemedText>
        <Ionicons name="arrow-forward-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  );
}

export default function ProgramsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('All');

  const platformPaddingTop = Platform.select({
    web: Spacing.six,
    default: insets.top,
  });

  const totalSubjects = PROGRAMS.reduce((n, b) => n + b.subjects.length, 0);

  const visibleBands = PROGRAMS.filter((b) => {
    if (filter === 'Gr 6–9') return b.bandKey === 'junior';
    if (filter === 'Gr 10–12') return b.bandKey === 'senior';
    return true;
  });

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
            <ThemedText style={styles.headerTitle}>Programmes</ThemedText>
            <ThemedText style={styles.headerSub}>
              {totalSubjects} subjects · Grades 6–12
            </ThemedText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.enrollAllBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push('/enroll')}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <ThemedText style={styles.enrollAllBtnText}>Enrol</ThemedText>
          </Pressable>
        </View>

        {/* CAPS BANNER */}
        {/* <LinearGradient colors={[PRIMARY, '#0D3B23']} style={styles.capsBanner}>
          <View style={styles.capsBannerInner}>
            <View style={styles.capsIconWrap}>
              <Ionicons name="checkmark-done-circle-outline" size={22} color="#4ADE80" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.capsBannerTitle}>CAPS Aligned Curriculum</ThemedText>
              <ThemedText style={styles.capsBannerSub}>All classes follow the national curriculum</ThemedText>
            </View>
          </View>
          <View style={styles.statsRow}>
            {[
              { value: '7', label: 'Grades', icon: 'school-outline' as IoniconName },
              { value: '14', label: 'Subjects', icon: 'book-outline' as IoniconName },
              { value: '92%', label: 'Pass Rate', icon: 'trophy-outline' as IoniconName },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <ThemedText style={styles.statValue}>{s.value}</ThemedText>
                <ThemedText style={styles.statLabel}>{s.label}</ThemedText>
              </View>
            ))}
          </View>
        </LinearGradient> */}

        {/* FILTER */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const count = f === 'All' ? totalSubjects : f === 'Gr 6–9' ? PROGRAMS[0].subjects.length : PROGRAMS[1].subjects.length;
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterPill, active && styles.filterPillActive]}>
                <ThemedText style={[styles.filterText, active && styles.filterTextActive]}>{f}</ThemedText>
                {/* <View style={[styles.countBubble, active && styles.countBubbleActive]}>
                  <ThemedText style={[styles.countBubbleText, active && styles.countBubbleTextActive]}>{count}</ThemedText>
                </View> */}
              </Pressable>
            );
          })}
        </View>

        {/* BANDS */}
        {visibleBands.map((band) => (
          <View key={band.band}>
            <SectionLabel
              title={band.band}
              color={band.color}
              tag={band.tag}
              count={band.subjects.length}
            />
            <View style={styles.list}>
              {band.subjects.map((s) => (
                <SubjectCard
                  key={s.title}
                  title={s.title}
                  desc={s.desc}
                  color={band.color}
                  onEnrol={() => router.push({ pathname: '/enroll', params: { subject: s.title } } as any)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* BOTTOM CTA */}
        {/* <View style={styles.bottomCta}>
          <View style={[styles.ctaIconWrap, { backgroundColor: PRIMARY + '15' }]}>
            <Ionicons name="help-circle-outline" size={28} color={PRIMARY} />
          </View>
          <ThemedText style={styles.ctaTitle}>Not sure which programme?</ThemedText>
          <ThemedText style={styles.ctaDesc}>
            Book a free assessment and our tutors will recommend the best fit.
          </ThemedText>
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push('/enroll')}>
            <Ionicons name="clipboard-outline" size={16} color="#fff" />
            <ThemedText style={styles.ctaBtnText}>Book Free Assessment</ThemedText>
          </Pressable>
        </View> */}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: Spacing.five },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  enrollAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 8,
  },
  enrollAllBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  capsBanner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  capsBannerInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  capsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  capsBannerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  statItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 3,
  },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  filterPillActive: { backgroundColor: '#000'},
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  countBubble: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 20,
    alignItems: 'center',
  },
  countBubbleActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countBubbleText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  countBubbleTextActive: { color: '#fff' },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  sectionAccent: { width: 4, height: 36, borderRadius: 2 },
  sectionTag: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  sectionCount: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sectionCountText: { fontSize: 11, fontWeight: '700', color: '#374151' },

  list: { paddingHorizontal: Spacing.four, gap: Spacing.two, marginBottom: Spacing.two },

  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardMeta: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
  },
  enrollBtnText: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },

  bottomCta: {
    margin: Spacing.four,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  ctaIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  ctaTitle: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' },
  ctaDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: Spacing.one,
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
