import { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

import ErrorIllustration from '@/assets/illustrations/error.svg';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <ErrorIllustration width={160} height={160} />
        <ThemedText style={styles.title}>Something went wrong</ThemedText>
        <ThemedText style={styles.message} numberOfLines={4}>
          {this.state.error.message}
        </ThemedText>
        <Pressable style={styles.btn} onPress={() => this.setState({ error: null })}>
          <ThemedText style={styles.btnText}>Try again</ThemedText>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: '#F7F9F8' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  message: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, backgroundColor: '#1565C0', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
