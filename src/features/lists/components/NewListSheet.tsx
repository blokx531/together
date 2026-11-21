import { useState, type SubmitEvent } from 'react';
import { useLocation } from 'wouter';
import { useHousehold } from '@/features/household';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';
import { createList } from '../data/listsApi';
import { LIST_KIND_PRESETS, LIST_KINDS, type ListKind } from '../domain/listKinds';

interface NewListSheetProps {
  open: boolean;
  onClose: () => void;
}

export function NewListSheet({ open, onClose }: NewListSheetProps) {
  return (
    <Sheet open={open} title="New list" onClose={onClose}>
      {open ? <NewListForm onClose={onClose} /> : null}
    </Sheet>
  );
}

function NewListForm({ onClose }: { onClose: () => void }) {
  const household = useHousehold();
  const [, navigate] = useLocation();
  const [requestId] = useState(newRequestId);
  const [kind, setKind] = useState<ListKind>('grocery');
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'household' | 'private'>(
    household.partner ? 'household' : 'private',
  );
  const create = useAsyncAction(createList);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const preset = LIST_KIND_PRESETS[kind];
    const result = await create.run({
      requestId,
      householdId: household.householdId,
      ownerId: household.me.userId,
      kind,
      title: title.trim() || preset.label,
      emoji: preset.emoji,
      visibility,
    });
    if (result?.ok) {
      onClose();
      navigate(`/lists/${result.value}`);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <div className="grid grid-cols-2 gap-2">
          {LIST_KINDS.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-0.5 rounded-control border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
            >
              <input
                type="radio"
                name="list-kind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                }}
                className="sr-only"
              />
              <span className="font-medium">
                <span aria-hidden>{LIST_KIND_PRESETS[value].emoji}</span>{' '}
                {LIST_KIND_PRESETS[value].label}
              </span>
              <span className="text-xs text-ink-muted">{LIST_KIND_PRESETS[value].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        label="Name"
        maxLength={60}
        placeholder={LIST_KIND_PRESETS[kind].label}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      {household.partner ? (
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
      <FormError message={create.error?.message} />
      <Button type="submit" isLoading={create.isPending} fullWidth>
        Create list
      </Button>
    </form>
  );
}
