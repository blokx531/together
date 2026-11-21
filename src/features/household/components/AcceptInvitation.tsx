import { useResource } from '@/shared/lib/useResource';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import type { AppError } from '@/shared/lib/appError';
import { Button } from '@/shared/ui/Button';
import { FormError } from '@/shared/ui/Field';
import { ErrorState, LoadingRows } from '@/shared/ui/States';
import { acceptInvitation, previewInvitation } from '../data/householdApi';

const JOIN_ERRORS: Record<string, string> = {
  INVITE_INVALID: 'This invite link has already been used or was replaced. Ask for a new one.',
  INVITE_EXPIRED: 'This invite link has expired. Ask for a new one.',
  ALREADY_IN_HOUSEHOLD: 'You already belong to a shared space.',
  HOUSEHOLD_FULL: 'This shared space already has two people.',
};

function joinErrorMessage(error: AppError): string {
  return (error.code ? JOIN_ERRORS[error.code] : undefined) ?? error.message;
}

interface AcceptInvitationProps {
  token: string;
  onJoined: () => void;
  onDiscard: () => void;
}

export function AcceptInvitation({ token, onJoined, onDiscard }: AcceptInvitationProps) {
  const preview = useResource(`invite-preview:${token}`, (signal) =>
    previewInvitation(token, signal),
  );
  const join = useAsyncAction(acceptInvitation);

  const onJoin = async () => {
    const result = await join.run(token);
    if (result?.ok) onJoined();
  };

  if (preview.status === 'loading')
    return (
      <div className="mt-8">
        <LoadingRows rows={2} label="Checking invite" />
      </div>
    );
  if (preview.status === 'error')
    return (
      <div className="mt-8">
        <ErrorState error={preview.error} onRetry={preview.reload} />
      </div>
    );

  if (!preview.data) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p className="text-ink-muted">
          This invite link is no longer valid. It may have expired, been used, or been replaced by a
          newer link.
        </p>
        <Button variant="secondary" onClick={onDiscard}>
          Create my own space instead
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-ink-muted">
        <strong className="text-ink">{preview.data.inviterName}</strong> invited you to join{' '}
        <strong className="text-ink">{preview.data.householdName}</strong>. You will be able to see
        what they choose to share, and they will see what you share. Private items stay private.
      </p>
      <FormError message={join.error ? joinErrorMessage(join.error) : null} />
      <Button onClick={() => void onJoin()} isLoading={join.isPending} fullWidth>
        Join {preview.data.householdName}
      </Button>
      <Button variant="ghost" onClick={onDiscard}>
        Not now
      </Button>
    </div>
  );
}
