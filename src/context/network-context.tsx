import NetInfo from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

import { log } from '@/utils/logger';

const TAG = 'Network';
const BACK_ONLINE_DISPLAY_MS = 2000;

type BannerPhase = 'hidden' | 'offline' | 'backOnline';

type NetworkContextType = {
  /** True once we've heard from NetInfo at least once — avoids a false
   *  "offline" flash on the very first render before the first event fires. */
  isReady: boolean;
  isOnline: boolean;
  /** Single source of truth for the offline banner's visibility, so layout
   *  code elsewhere (safe-area inset overrides) can stay in sync with it
   *  instead of guessing from `isOnline` alone (which misses the "back
   *  online" grace period). */
  bannerPhase: BannerPhase;
};

const NetworkContext = createContext<NetworkContextType | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [bannerPhase, setBannerPhase] = useState<BannerPhase>('hidden');
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // isInternetReachable can be null while it's still being determined —
      // treat that as "assume online" rather than flashing the banner for
      // every ambiguous reading (e.g. captive portals still probing).
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(prev => {
        if (prev !== online) log[online ? 'ok' : 'warn'](TAG, online ? 'Back online' : 'Connection lost', { type: state.type });
        return online;
      });
      setIsReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isReady) return;

    if (!isOnline) {
      wasOffline.current = true;
      setBannerPhase('offline');
      return;
    }

    if (wasOffline.current) {
      wasOffline.current = false;
      setBannerPhase('backOnline');
      const timer = setTimeout(() => setBannerPhase('hidden'), BACK_ONLINE_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isReady]);

  return (
    <NetworkContext.Provider value={{ isReady, isOnline, bannerPhase }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used inside NetworkProvider');
  return ctx;
}
