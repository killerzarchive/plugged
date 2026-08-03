import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/auth';

export default function Index() {
  const { token } = useAuth();
  
  if (token) {
    return <Redirect href="/(tabs)" />;
  }
  // Unauthenticated users should land on the marketing landing page
  return <Redirect href="/landing" />;
}
