import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '@/utils/supabase';

/**
 * Hides footer/nav chrome inside the Yoco checkout page and prevents
 * overscroll bounce. Re-applied after DOM mutations and at intervals.
 */
const CHECKOUT_SCRIPT = `
(function () {
  var STYLE_ID = '__gl_checkout_tweak';
  var CSS =
    'html,body{overscroll-behavior:none;-webkit-font-smoothing:antialiased;}' +
    'footer,[role="contentinfo"],#footer,.footer,.site-footer,' +
    '[class*="footer"],[id*="footer"],[class*="Footer"]{' +
    'display:none!important;height:0!important;max-height:0!important;' +
    'overflow:hidden!important;visibility:hidden!important;}';
  function apply() {
    try {
      if (!document.head || document.getElementById(STYLE_ID)) return;
      var s = document.createElement('style');
      s.id = STYLE_ID;
      s.appendChild(document.createTextNode(CSS));
      document.head.appendChild(s);
    } catch(e) {}
  }
  function watch() {
    if (window.__gl_bound) return;
    window.__gl_bound = true;
    try {
      new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
    } catch(e) {}
    [0, 250, 800, 2000, 4000].forEach(function(ms) { setTimeout(apply, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
  apply();
  true;
})();
`;

function parseReturnStatus(url: string): 'success' | 'cancelled' | null {
  if (!url.includes('/demo/yoco')) return null;
  try {
    const u = new URL(url);
    const s = u.searchParams.get('status');
    if (s === 'success') return 'success';
    if (s === 'cancel' || s === 'failure') return 'cancelled';
  } catch {
    if (url.includes('status=success')) return 'success';
    if (url.includes('status=cancel') || url.includes('status=failure')) return 'cancelled';
  }
  return null;
}

export default function PaymentWebViewScreen() {
  const { url, title, amount, feeType, learnerId, guardianId, applicationId } =
    useLocalSearchParams<{
      url: string; title: string; amount: string;
      feeType: string; learnerId: string; guardianId: string; applicationId: string;
    }>();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const completedRef = useRef(false);

  const headerTopPad = Platform.OS === 'android' ? Math.max(insets.top, 8) : 10;

  async function onPaymentSuccess() {
    if (completedRef.current) return;
    completedRef.current = true;

    await supabase.from('payments').insert({
      learner_id:     learnerId || null,
      guardian_id:    guardianId,
      amount:         Number(amount ?? 0),
      currency:       'ZAR',
      type:           (feeType as any) ?? 'tuition',
      status:         'paid',
      payment_method: 'card',
      paid_at:        new Date().toISOString(),
      description:    title,
    });

    if (applicationId) {
      await supabase.from('enrolment_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', applicationId);
    }

    Alert.alert('Payment Successful 🎉', 'Your payment is confirmed and enrolment approved!', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  }

  function handleNavChange(nav: { url: string }) {
    const status = parseReturnStatus(nav.url);
    if (status === 'success') void onPaymentSuccess();
    else if (status === 'cancelled') {
      Alert.alert('Payment Cancelled', 'No charge was made.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Full-screen WebView — sits behind the overlaid header */}
      <WebView
        ref={webRef}
        style={styles.webView}
        source={{ uri: url ?? 'about:blank' }}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        startInLoadingState
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
        bounces={false}
        overScrollMode="never"
        androidLayerType="hardware"
        injectedJavaScript={CHECKOUT_SCRIPT}
        injectedJavaScriptBeforeContentLoaded={
          Platform.OS === 'ios' ? CHECKOUT_SCRIPT : undefined
        }
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          webRef.current?.injectJavaScript(CHECKOUT_SCRIPT);
        }}
        onNavigationStateChange={handleNavChange}
      />

      {/* Absolute header overlay — black, always on top */}
      <View
        style={[styles.headerOverlay, { paddingTop: headerTopPad }]}
        pointerEvents="auto">
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={14}
            style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title ?? 'Payment'}</Text>
            <Text style={styles.headerSub}>Secure payment · Yoco</Text>
          </View>

          {/* spacer to balance the close button */}
          <View style={{ width: 40 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  webView: { flex: 1, backgroundColor: '#000' },

  headerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'android' ? 6 : 10,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
});
