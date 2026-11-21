import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { memberName, useHousehold } from '@/features/household';
import { formatLocalDate, parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { useToast } from '@/shared/ui/Toast';
import { addVisit, deletePlace, setWishlist } from '../data/travelApi';
import { flagEmoji, summarizeVisits, type Place, type Visit } from '../domain/places';
import { VisitorPicker } from './VisitorPicker';

interface PlaceSheetProps {
  place: Place | null;
  today: LocalDate;
  onClose: () => void;
  onChanged: () => void;
}

export function PlaceSheet({ place, today, onClose, onChanged }: PlaceSheetProps) {
  return (
    <Sheet
      open={place !== null}
      title={place ? `${flagEmoji(place.countryCode)} ${place.name}` : 'Place'}
      onClose={onClose}
    >
      {place ? (
        <PlaceDetail
          key={place.id}
          place={place}
          today={today}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </Sheet>
  );
}

function visitDates(visit: Visit): string {
  const start = formatLocalDate(visit.startedOn, 'day-month-year');
  return visit.endedOn && visit.endedOn !== visit.startedOn
    ? `${start} – ${formatLocalDate(visit.endedOn, 'day-month-year')}`
    : start;
}

function PlaceDetail({
  place,
  today,
  onClose,
  onChanged,
}: { place: Place } & Omit<PlaceSheetProps, 'place'>) {
  const household = useHousehold();
  const toast = useToast();
  const people = { meId: household.me.userId, partnerId: household.partner?.userId ?? null };
  const summary = summarizeVisits(place, people);
  const [isAddingVisit, setIsAddingVisit] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const [startedOn, setStartedOn] = useState<string>(today);
  const [visitors, setVisitors] = useState<string[]>([household.me.userId]);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = useAsyncAction(addVisit);
  const wish = useAsyncAction(setWishlist);
  const remove = useAsyncAction(deletePlace);
  const location = [place.locality, place.region, place.countryName].filter(Boolean).join(', ');

  const onAddVisit = async () => {
    const start = parseLocalDate(startedOn);
    if (!start || visitors.length === 0) {
      setError('Choose a date and who went.');
      return;
    }
    setError(null);
    const result = await add.run({
      requestId,
      placeId: place.id,
      startedOn: start,
      endedOn: null,
      note: '',
      memberIds: visitors,
    });
    if (result?.ok) {
      setIsAddingVisit(false);
      setRequestId(newRequestId());
      onChanged();
    }
  };

  const onDelete = async () => {
    const result = await remove.run(place.id);
    if (result?.ok) {
      toast.show('Place removed');
      onChanged();
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        {location || 'Saved location'} · {place.latitude.toFixed(3)}, {place.longitude.toFixed(3)}
        {place.visibility === 'private' ? ' · only you' : ''}
      </p>
      {summary.together ? (
        <p className="w-fit rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-strong">
          Visited together
        </p>
      ) : null}
      {place.visits.length > 0 ? (
        <ul aria-label="Visits" className="flex flex-col gap-2">
          {place.visits.map((visit) => (
            <li key={visit.id} className="rounded-control bg-surface-2 px-3 py-2">
              <span className="block font-medium">{visitDates(visit)}</span>
              <span className="block text-sm text-ink-muted">
                {visit.memberIds.map((id) => memberName(household, id)).join(' & ')}
              </span>
              {visit.note ? <span className="block text-sm">{visit.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Not visited yet.</p>
      )}
      {isAddingVisit ? (
        <div className="flex flex-col gap-3 rounded-control border border-line p-3">
          <TextField
            label="Visit date"
            type="date"
            max={today}
            value={startedOn}
            onChange={(event) => {
              setStartedOn(event.target.value);
            }}
          />
          <VisitorPicker
            value={visitors}
            onChange={setVisitors}
            onlySelf={place.visibility === 'private'}
          />
          <FormError message={error ?? add.error?.message} />
          <Button onClick={() => void onAddVisit()} isLoading={add.isPending}>
            Save visit
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setIsAddingVisit(true);
          }}
        >
          Add a visit
        </Button>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-accent"
          checked={place.isWishlist}
          disabled={wish.isPending}
          onChange={(event) => {
            void wish.run(place.id, event.target.checked).then((result) => {
              if (result?.ok) onChanged();
            });
          }}
        />
        On our wishlist {summary.isVisited ? '(go again)' : ''}
      </label>
      <FormError message={wish.error?.message ?? remove.error?.message} />
      {isConfirmingDelete ? (
        <Button variant="danger" isLoading={remove.isPending} onClick={() => void onDelete()}>
          Remove this place and its visits
        </Button>
      ) : (
        <Button
          variant="ghost"
          icon={<Trash2 className="size-4" aria-hidden />}
          onClick={() => {
            setIsConfirmingDelete(true);
          }}
        >
          Remove place
        </Button>
      )}
    </div>
  );
}
