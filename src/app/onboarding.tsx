import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export const ONBOARDING_KEY = 'geniuslabs_onboarding_done';

const SLIDES = [
  {
    key: '1',
    icon: 'school' as const,
    gradient: ['#1565C0', '#0D47A1'] as [string, string],
    title: 'Learn Smarter',
    body: 'Access personalised tutoring for Grades 6–12 across all key subjects — anywhere, anytime.',
  },
  {
    key: '2',
    icon: 'chatbubbles' as const,
    gradient: ['#7C3AED', '#5B21B6'] as [string, string],
    title: 'Connect with Tutors',
    body: 'Chat directly with your tutors in real-time subject groups. Get answers when you need them.',
  },
  {
    key: '3',
    icon: 'trophy' as const,
    gradient: ['#059669', '#047857'] as [string, string],
    title: 'Track Your Progress',
    body: 'Complete quizzes, review materials, and watch your grades improve every week.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/auth/login');
  }

  function next() {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      finish();
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.four }]}>

      {/* Slide content */}
      <View style={styles.slideArea}>
        <LinearGradient colors={slide.gradient} style={styles.iconWrap}>
          <Ionicons name={slide.icon} size={56} color="#fff" />
        </LinearGradient>
        <ThemedText style={styles.title}>{slide.title}</ThemedText>
        <ThemedText style={styles.body}>{slide.body}</ThemedText>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity onPress={finish} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ThemedText style={styles.skipText}>Skip</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.85}>
          <ThemedText style={styles.nextText}>
            {index === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </ThemedText>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F9F8',
  },
  slideArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
    gap: Spacing.four,
  },
  iconWrap: {
    width: 120, height: 120, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center' },
  body: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    marginBottom: Spacing.four,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { width: 24, backgroundColor: '#1565C0' },
  btnRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  skipText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600', paddingVertical: 8 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1565C0',
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
  },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
