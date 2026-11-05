import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

// "/" руу ороход session-оос хамаарч чиглүүлнэ
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/home' : '/login'} />;
}
