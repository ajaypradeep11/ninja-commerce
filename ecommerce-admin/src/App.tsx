import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/dashboard';
import { BrandsPage } from '@/pages/brands';
import { CategoriesPage } from '@/pages/categories';
import { LoginPage } from '@/pages/login';
import { OrdersPage } from '@/pages/orders';
import { OrderDetailPage } from '@/pages/orders/order-detail';
import { ProductsPage } from '@/pages/products';
import { ProductFormPage } from '@/pages/products/product-form';

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
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductFormPage />} />
              <Route path="products/:id" element={<ProductFormPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="brands" element={<BrandsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
