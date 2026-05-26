import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const rider = useAuthStore((s) => s.rider);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  switch (rider?.status) {
    case 'APPROVED':
      return <Redirect href="/(onboarding)/step1" />;
    case 'ACTIVE':
      return <Redirect href="/(app)/home" />;
    case 'UNDER_REVIEW':
      return <Redirect href="/(auth)/pending-approval" />;
    case 'REJECTED':
      return <Redirect href="/(auth)/rejected" />;
    case 'PENDING_DOCUMENTS':
      return <Redirect href="/(auth)/register/step-1-personal" />;
    default:
      return <Redirect href="/(auth)/login" />;
  }
}
