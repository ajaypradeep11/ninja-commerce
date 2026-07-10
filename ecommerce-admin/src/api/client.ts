import { signOut } from 'firebase/auth';
import { auth } from '@/auth/firebase';
import { client } from './generated/client.gen';

client.setConfig({ baseUrl: import.meta.env.VITE_API_URL });

client.interceptors.request.use(async (request) => {
  const user = auth.currentUser;
  if (user) {
    request.headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  return request;
});

client.interceptors.response.use((response) => {
  if (response.status === 401) void signOut(auth);
  return response;
});
