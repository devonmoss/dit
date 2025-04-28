import { useAuth as useAuthContext } from '../contexts/AuthContext';

// This is a simple wrapper around the context to keep compatibility
export default function useAuth() {
  return useAuthContext();
}