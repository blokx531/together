import { Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useHousehold } from '@/features/household';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, SelectField, TextAreaField, TextField } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { useToast } from '@/shared/ui/Toast';
import { deleteItem, updateItemContent } from '../data/listsApi';
import { detailsFromFields, fieldsFromDetails, type DetailFields } from '../domain/itemDetails';
import type { ListKind } from '../domain/listKinds';
import type { ListItem } from '../domain/types';

interface ItemSheetProps {
  item: ListItem | null;
  kind: ListKind;
  onClose: () => void;
  onChanged: () => void;
}

export function ItemSheet({ item, kind, onClose, onChanged }: ItemSheetProps) {
  return (
    <Sheet open={item !== null} title="Edit item" onClose={onClose}>
      {item ? (
        <ItemForm
          key={`${item.id}:${item.revision}`}
          item={item}
          kind={kind}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </Sheet>
  );
}

function ItemForm({
  item,
  kind,
  onClose,
  onChanged,
}: { item: ListItem } & Omit<ItemSheetProps, 'item'>) {
  const household = useHousehold();
  const toast = useToast();
  const [text, setText] = useState(item.text);
  const [note, setNote] = useState(item.note ?? '');
  const [fields, setFields] = useState<DetailFields>(() => fieldsFromDetails(item.details));
  const [validationError, setValidationError] = useState<string | null>(null);
  const save = useAsyncAction(updateItemContent);
  const remove = useAsyncAction(deleteItem);
  const setField = (patch: Partial<DetailFields>) => {
    setFields((current) => ({ ...current, ...patch }));
  };

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === '') {
      setValidationError('The item needs some text.');
      return;
    }
    const details = detailsFromFields(kind, fields);
    if (!details.ok) {
      setValidationError(details.error);
      return;
    }
    setValidationError(null);
    const result = await save.run(item, {
      text: text.trim(),
      note: note.trim() || null,
      details: details.details,
    });
    if (result?.ok) {
      onChanged();
      onClose();
    } else if (result?.error.code === 'STALE_ITEM') {
      onChanged();
    }
  };

  const onDelete = async () => {
    const result = await remove.run(item.id);
    if (result?.ok) {
      toast.show('Item deleted');
      onChanged();
      onClose();
    }
  };

  const conflictMessage =
    save.error?.code === 'STALE_ITEM'
      ? 'Someone changed this item while you were editing. Your edit was not saved; the latest version is now shown in the list.'
      : null;

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Item"
        required
        maxLength={200}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      {kind === 'grocery' ? (
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Qty"
            inputMode="decimal"
            value={fields.quantity}
            onChange={(event) => {
              setField({ quantity: event.target.value });
            }}
          />
          <TextField
            label="Unit"
            maxLength={12}
            placeholder="kg"
            value={fields.unit}
            onChange={(event) => {
              setField({ unit: event.target.value });
            }}
          />
          <TextField
            label="Price (₹)"
            inputMode="decimal"
            value={fields.price}
            onChange={(event) => {
              setField({ price: event.target.value });
            }}
          />
        </div>
      ) : null}
      {kind === 'todo' ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Due"
            type="date"
            value={fields.dueOn}
            onChange={(event) => {
              setField({ dueOn: event.target.value });
            }}
          />
          <SelectField
            label="Who"
            value={fields.assigneeId}
            onChange={(event) => {
              setField({ assigneeId: event.target.value });
            }}
          >
            <option value="">Anyone</option>
            <option value={household.me.userId}>{household.me.displayName}</option>
            {household.partner ? (
              <option value={household.partner.userId}>{household.partner.displayName}</option>
            ) : null}
          </SelectField>
        </div>
      ) : null}
      {kind === 'watch' ? (
        <SelectField
          label="Rating"
          value={fields.rating}
          onChange={(event) => {
            setField({ rating: event.target.value });
          }}
        >
          <option value="">Not rated</option>
          {[1, 2, 3, 4, 5].map((stars) => (
            <option key={stars} value={String(stars)}>
              {'★'.repeat(stars)} ({stars})
            </option>
          ))}
        </SelectField>
      ) : null}
      {kind === 'watch' || kind === 'ideas' ? (
        <TextField
          label="Link"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={fields.link}
          onChange={(event) => {
            setField({ link: event.target.value });
          }}
        />
      ) : null}
      <TextAreaField
        label="Note"
        maxLength={1000}
        rows={2}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />
      <FormError
        message={validationError ?? conflictMessage ?? save.error?.message ?? remove.error?.message}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon={<Trash2 className="size-4" aria-hidden />}
          isLoading={remove.isPending}
          onClick={() => void onDelete()}
        >
          Delete
        </Button>
        <Button type="submit" isLoading={save.isPending} className="flex-1">
          Save
        </Button>
      </div>
    </form>
  );
}
