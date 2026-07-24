import { useAuth } from '@/context/auth-context';
import AdminDashboard from '@/screens/admin-dashboard';
import LearnerHome from '@/screens/learner-home';

// The tab bar's first Trigger ("index") is shared by every role — admin and
// everyone else land here via the same bare '/(tabs)' path, and this file
// picks the right screen. Keeps the whole app down to one NativeTabs tree
// instead of a second tab-bar group just for admin.
export default function TabIndex() {
  const { profile } = useAuth();
  return profile?.role === 'admin' ? <AdminDashboard /> : <LearnerHome />;
}
