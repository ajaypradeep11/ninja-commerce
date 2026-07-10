import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { AppShell } from '@/components/layout/AppShell';
import { CategoriesPage } from '@/pages/categories';
import { LoginPage } from '@/pages/login';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAdmin>
                  <AppShell />
                </RequireAdmin>
              }
            >
              <Route index element={<div>Dashboard (Task 15)</div>} />
              <Route path="products" element={<div>Products (Task 12)</div>} />
              <Route path="products/new" element={<div>New product (Task 13)</div>} />
              <Route path="products/:id" element={<div>Edit product (Task 13)</div>} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="orders" element={<div>Orders (Task 14)</div>} />
              <Route path="orders/:id" element={<div>Order detail (Task 14)</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
