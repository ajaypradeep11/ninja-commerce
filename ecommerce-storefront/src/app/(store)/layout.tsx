import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* Clears the floating notch; the home hero pulls itself back up. */}
      <main className="pt-[var(--notch-space)]">{children}</main>
      <Footer />
    </>
  );
}
