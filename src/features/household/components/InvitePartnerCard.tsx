import { Copy, Share2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormError } from '@/shared/ui/Field';
import { useToast } from '@/shared/ui/Toast';
import { createInvitation, type CreatedInvitation } from '../data/householdApi';

function inviteUrl(token: string): string {
  return `${window.location.origin}/join#t=${token}`;
}

const expiryFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function InvitePartnerCard() {
  const [invitation, setInvitation] = useState<CreatedInvitation | null>(null);
  const create = useAsyncAction(createInvitation);
  const toast = useToast();

  const onCreate = async () => {
    const result = await create.run();
    if (result?.ok) setInvitation(result.value);
  };

  const onCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show('Invite link copied');
    } catch {
      toast.show('Could not copy. Select the link and copy it manually.', { tone: 'error' });
    }
  };

  const onShare = async (url: string) => {
    try {
      await navigator.share({ title: 'Join me on Together', url });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await onCopy(url);
    }
  };

  return (
    <Card title="Invite your partner">
      {invitation ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Send this private link to your partner. It works once and expires{' '}
            {expiryFormatter.format(new Date(invitation.expiresAt))}. Creating a new link cancels
            this one.
          </p>
          <output className="block rounded-control bg-surface-2 px-3 py-2.5 font-mono text-xs break-all select-all">
            {inviteUrl(invitation.token)}
          </output>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Copy className="size-4" aria-hidden />}
              onClick={() => void onCopy(inviteUrl(invitation.token))}
            >
              Copy
            </Button>
            {typeof navigator.share === 'function' ? (
              <Button
                icon={<Share2 className="size-4" aria-hidden />}
                onClick={() => void onShare(inviteUrl(invitation.token))}
              >
                Share
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Together works best with two. Your partner gets their own account and sees only what you
            share.
          </p>
          <FormError message={create.error?.message} />
          <Button
            icon={<UserPlus className="size-4" aria-hidden />}
            isLoading={create.isPending}
            onClick={() => void onCreate()}
          >
            Create invite link
          </Button>
        </div>
      )}
    </Card>
  );
}
