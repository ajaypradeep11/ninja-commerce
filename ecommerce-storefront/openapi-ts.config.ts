import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../ecommerce-api/openapi.json',
  output: { path: 'src/api/generated', format: 'prettier' },
  plugins: ['@hey-api/client-fetch'],
});
