import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: replace with auth check from useAuthStore
  const isAuthenticated = false;
  return <Redirect href={isAuthenticated ? '/(app)/home' : '/(auth)/login'} />;
}
