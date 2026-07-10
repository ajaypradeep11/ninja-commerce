import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">
        Nothing here.
      </h1>
      <div className="selvedge mt-6 w-24" />
      <p className="mt-8 text-ink/70">
        The page you&rsquo;re looking for doesn&rsquo;t exist, or it moved.
      </p>
      <Link
        href="/products"
        className="mt-6 font-mono text-sm text-indigo underline underline-offset-4 hover:no-underline"
      >
        Back to the shop
      </Link>
    </div>
  );
}
