import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '@/utils/supabase';
import { LoadingDots } from '@/components/loading-dots';

/**
 * Hides footer/nav chrome inside the checkout page and prevents
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

const RETURN_SCHEME = 'geniuslabs://payment-return';

function parseReturnStatus(url: string): 'success' | 'cancel' | 'failure' | null {
  if (!url.startsWith(RETURN_SCHEME)) return null;
  try {
    const status = new URL(url).searchParams.get('status');
    if (status === 'success' || status === 'cancel' || status === 'failure') return status;
  } catch {}
  return null;
}

export default function PaymentWebViewScreen() {
  const { url, title, paymentId } = useLocalSearchParams<{ url: string; title: string; paymentId: string }>();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const handledRef = useRef(false);

  const headerTopPad = Platform.OS === 'android' ? Math.max(insets.top, 8) : 10;

  // Never trust the redirect itself — it only tells us to go ask Yoco what
  // really happened. verify-payment does that lookup server-side and is the
  // only thing that ever marks a payment paid.
  async function handleReturn(status: 'success' | 'cancel' | 'failure') {
    if (handledRef.current) return;
    handledRef.current = true;

    if (status !== 'success') {
      Alert.alert(
        status === 'cancel' ? 'Payment Cancelled' : 'Payment Failed',
        'No charge was made.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    if (!paymentId) {
      Alert.alert('Payment Submitted', 'Check your Payments list for the updated status.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
      return;
    }

    setVerifying(true);
    const { data, error } = await supabase.functions.invoke('verify-payment', { body: { paymentId } });
    setVerifying(false);

    if (!error && data?.status === 'paid') {
      Alert.alert('Payment Successful', 'Your payment has been confirmed.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } else if (!error && data?.status === 'failed') {
      Alert.alert('Payment Failed', 'Yoco reported this payment did not succeed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      // Still pending on Yoco's side, or verification couldn't complete — don't claim success.
      Alert.alert(
        'Still Confirming',
        "We couldn't confirm this payment yet. Check your Payments list shortly — it'll update once confirmed.",
        [{ text: 'OK', onPress: () => router.back() }]
      );
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
        // Intercept the custom-scheme redirect before the OS tries (and fails) to load it.
        onShouldStartLoadWithRequest={(nav) => {
          const status = parseReturnStatus(nav.url);
          if (status) {
            handleReturn(status);
            return false;
          }
          return true;
        }}
      />

      {verifying && (
        <View style={styles.verifyOverlay} pointerEvents="auto">
          <LoadingDots size={10} color="#fff" />
          <Text style={styles.verifyText}>Confirming payment…</Text>
        </View>
      )}

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

  verifyOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  verifyText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  headerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: '#000',
    borderBottomWidth: 0,
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
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
});
