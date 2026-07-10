import { client } from '@/api/generated/client.gen';

client.setConfig({ baseUrl: process.env.NEXT_PUBLIC_API_URL });

export { client };
