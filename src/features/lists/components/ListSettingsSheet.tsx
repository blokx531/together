import { useState, type SubmitEvent } from 'react';
import { useLocation } from 'wouter';
import { useHousehold } from '@/features/household';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';
import { useToast } from '@/shared/ui/Toast';
import { deleteList, updateList } from '../data/listsApi';
import type { ListSummary } from '../domain/types';

interface ListSettingsSheetProps {
  list: ListSummary;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ListSettingsSheet({ list, open, onClose, onChanged }: ListSettingsSheetProps) {
  return (
    <Sheet open={open} title="List settings" onClose={onClose}>
      {open ? <ListSettingsForm list={list} onClose={onClose} onChanged={onChanged} /> : null}
    </Sheet>
  );
}

function ListSettingsForm({ list, onClose, onChanged }: Omit<ListSettingsSheetProps, 'open'>) {
  const household = useHousehold();
  const toast = useToast();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState(list.title);
  const [emoji, setEmoji] = useState(list.emoji);
  const [visibility, setVisibility] = useState(list.visibility);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const save = useAsyncAction(updateList);
  const remove = useAsyncAction(deleteList);
  const isOwner = list.ownerId === household.me.userId;

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await save.run(list.id, {
      title: title.trim() || list.title,
      emoji: emoji.trim(),
      ...(isOwner ? { visibility } : {}),
    });
    if (result?.ok) {
      onChanged();
      onClose();
    }
  };

  const onArchiveToggle = async () => {
    const result = await save.run(list.id, { archived: !list.isArchived });
    if (result?.ok) {
      toast.show(list.isArchived ? 'List restored' : 'List archived');
      onChanged();
      onClose();
    }
  };

  const onDelete = async () => {
    const result = await remove.run(list.id);
    if (result?.ok) {
      toast.show('List deleted');
      onClose();
      navigate('/lists');
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <TextField
          label="Icon"
          maxLength={8}
          value={emoji}
          onChange={(event) => {
            setEmoji(event.target.value);
          }}
        />
        <TextField
          label="Name"
          maxLength={60}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </div>
      {household.partner && isOwner ? (
        <SegmentedControl
          label="Who can see it"
          options={[
            { value: 'household', label: `Shared with ${household.partner.displayName}` },
            { value: 'private', label: 'Just me' },
          ]}
          value={visibility}
          onChange={setVisibility}
        />
      ) : null}
      <FormError message={save.error?.message ?? remove.error?.message} />
      <Button type="submit" isLoading={save.isPending} fullWidth>
        Save
      </Button>
      <div className="flex gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={() => void onArchiveToggle()} className="flex-1">
          {list.isArchived ? 'Restore list' : 'Archive list'}
        </Button>
        {isOwner ? (
          isConfirmingDelete ? (
            <Button
              variant="danger"
              isLoading={remove.isPending}
              onClick={() => void onDelete()}
              className="flex-1"
            >
              Delete forever
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setIsConfirmingDelete(true);
              }}
              className="flex-1"
            >
              Delete list
            </Button>
          )
        ) : null}
      </div>
      {isConfirmingDelete ? (
        <p className="text-sm text-negative">
          This deletes the list and every item in it for both of you.
        </p>
      ) : null}
    </form>
  );
}
