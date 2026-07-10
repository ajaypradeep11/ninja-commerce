import { SITE } from '@/lib/site';

export default function Home() {
  return (
    <main className="p-16">
      <h1 className="font-display text-5xl">{SITE.name}</h1>
      <p className="mt-4 font-mono text-sm">{SITE.tagline}</p>
      <div className="selvedge mt-8 max-w-md" />
    </main>
  );
}
