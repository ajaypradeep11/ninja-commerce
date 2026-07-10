'use client';

import { useRouter } from 'next/navigation';
import { useMe } from '@/api/hooks/account';
import { useAuth } from '@/auth/AuthProvider';
import { AddressManager } from '@/components/site/AddressManager';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AccountPage() {
  const { data: me, isLoading, error, refetch } = useMe();
  const { signOutUser } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.push('/');
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (error || !me) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink/70">We couldn&rsquo;t load your account.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <div>
        <p className="font-mono text-sm text-ink">{me.email}</p>
        <p className="mt-1 text-sm text-ink/60">
          Member since {formatMemberSince(me.createdAt)}
        </p>
        <Button
          variant="outline"
          onClick={() => void handleSignOut()}
          className="mt-4"
        >
          Sign out
        </Button>
      </div>

      <AddressManager />
    </div>
  );
}
