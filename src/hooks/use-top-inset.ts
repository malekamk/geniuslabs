import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { useNetwork } from '@/context/network-context';

/**
 * Real device top inset — except 0 while a full-width banner ("Viewing as"
 * or offline) is already occupying the status-bar area, since screens must
 * not stack their own status-bar padding on top of it.
 */
export function useTopInset() {
  const { top } = useSafeAreaInsets();
  const { isImpersonating } = useAuth();
  const { bannerPhase } = useNetwork();
  const bannerVisible = isImpersonating || bannerPhase !== 'hidden';
  return bannerVisible ? 0 : top;
}
