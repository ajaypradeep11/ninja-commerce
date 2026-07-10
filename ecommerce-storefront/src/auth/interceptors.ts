import { signOut } from 'firebase/auth';
import { client } from '@/api/client';
import { auth } from './firebase';

client.interceptors.request.use(async (request) => {
  const user = auth.currentUser;
  if (user) {
    request.headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  return request;
});

client.interceptors.response.use(async (response) => {
  if (response.status === 401 && auth.currentUser) {
    try {
      await signOut(auth);
    } catch {
      // Best-effort: a failed forced sign-out must not break response
      // handling for the caller that triggered this interceptor.
    }
  }
  return response;
});
