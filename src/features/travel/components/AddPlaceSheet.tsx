import { useDeferredValue, useMemo, useState } from 'react';
import { useHousehold } from '@/features/household';
import { parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useResource } from '@/shared/lib/useResource';
import { Button } from '@/shared/ui/Button';
import { FormError, SelectField, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';
import { ErrorState, LoadingRows } from '@/shared/ui/States';
import { useToast } from '@/shared/ui/Toast';
import { MIN_SEARCH_LENGTH, searchPlaces, type PlaceSuggestion } from '../data/placeSearch';
import { createPlace } from '../data/travelApi';
import { countryOptions, flagEmoji, parseCoordinates } from '../domain/places';
import { VisitorPicker } from './VisitorPicker';

interface AddPlaceSheetProps {
  open: boolean;
  today: LocalDate;
  onClose: () => void;
  onSaved: () => void;
}

export function AddPlaceSheet({ open, today, onClose, onSaved }: AddPlaceSheetProps) {
  return (
    <Sheet open={open} title="Add a place" onClose={onClose}>
      {open ? <AddPlaceForm today={today} onClose={onClose} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function describeSuggestion(place: PlaceSuggestion): string {
  return [place.locality, place.region, place.countryName].filter(Boolean).join(', ');
}

function Suggestions({
  query,
  onPick,
}: {
  query: string;
  onPick: (place: PlaceSuggestion) => void;
}) {
  const results = useResource(`place-search:${query}`, (signal) => searchPlaces(query, signal));
  if (results.status === 'loading') return <LoadingRows rows={2} label="Searching places" />;
  if (results.status === 'error')
    return <ErrorState error={results.error} onRetry={results.reload} />;
  if (results.data.length === 0)
    return (
      <p className="text-sm text-ink-muted">
        No matches. Try another spelling, or enter it manually.
      </p>
    );
  return (
    <ul
      aria-label="Place suggestions"
      className="overflow-hidden rounded-control border border-line"
    >
      {results.data.map((place) => (
        <li
          key={`${place.sourceRef ?? place.name}-${place.latitude}`}
          className="border-b border-line last:border-b-0"
        >
          <button
            type="button"
            onClick={() => {
              onPick(place);
            }}
            className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2"
          >
            <span aria-hidden>{flagEmoji(place.countryCode)}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{place.name}</span>
              <span className="block truncate text-xs text-ink-muted">
                {describeSuggestion(place)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function AddPlaceForm({ today, onClose, onSaved }: Omit<AddPlaceSheetProps, 'open'>) {
  const household = useHousehold();
  const toast = useToast();
  const [requestId] = useState(newRequestId);
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [picked, setPicked] = useState<PlaceSuggestion | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualCountry, setManualCountry] = useState('IN');
  const countries = useMemo(() => countryOptions(), []);
  const [manualCoordinates, setManualCoordinates] = useState('');
  const [status, setStatus] = useState<'visited' | 'wishlist'>('visited');
  const [visibility, setVisibility] = useState<'household' | 'private'>(
    household.partner ? 'household' : 'private',
  );
  const [startedOn, setStartedOn] = useState<string>(today);
  const [endedOn, setEndedOn] = useState('');
  const [visitors, setVisitors] = useState<string[]>([household.me.userId]);
  const [error, setError] = useState<string | null>(null);
  const save = useAsyncAction(createPlace);

  const onSave = async () => {
    let location: Omit<PlaceSuggestion, 'sourceRef'> & {
      sourceRef: string | null;
      source: 'manual' | 'photon';
    };
    if (mode === 'search') {
      if (!picked) {
        setError('Pick a place from the suggestions, or enter it manually.');
        return;
      }
      location = { ...picked, source: 'photon' };
    } else {
      const coordinates = parseCoordinates(manualCoordinates);
      if (manualName.trim() === '' || !coordinates) {
        setError('Enter a name and coordinates like 26.91, 75.79 (copy them from any map app).');
        return;
      }
      location = {
        name: manualName.trim(),
        locality: null,
        region: null,
        countryCode: manualCountry === '' ? null : manualCountry,
        countryName: countries.find((country) => country.code === manualCountry)?.name ?? null,
        ...coordinates,
        sourceRef: null,
        source: 'manual',
      };
    }
    const start = parseLocalDate(startedOn);
    const end = endedOn === '' ? null : parseLocalDate(endedOn);
    const memberIds = visibility === 'private' ? [household.me.userId] : visitors;
    if (
      status === 'visited' &&
      (!start || (endedOn !== '' && !end) || (end !== null && end < start))
    ) {
      setError('Check the visit dates.');
      return;
    }
    if (status === 'visited' && memberIds.length === 0) {
      setError('Choose who went.');
      return;
    }
    setError(null);
    const result = await save.run({
      requestId,
      ...location,
      visibility,
      isWishlist: status === 'wishlist',
      firstVisit:
        status === 'visited' && start ? { startedOn: start, endedOn: end, memberIds } : null,
    });
    if (result?.ok) {
      toast.show(status === 'visited' ? 'Place stamped' : 'Added to your wishlist', {
        tone: 'success',
      });
      onSaved();
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="How to add"
        options={[
          { value: 'search', label: 'Search' },
          { value: 'manual', label: 'Enter manually' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'search' ? (
        picked ? (
          <div className="flex items-center justify-between gap-3 rounded-control bg-surface-2 px-3 py-2">
            <span>
              <span className="font-medium">
                {flagEmoji(picked.countryCode)} {picked.name}
              </span>
              <span className="block text-xs text-ink-muted">{describeSuggestion(picked)}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPicked(null);
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <>
            <TextField
              label="Search a city or place"
              type="search"
              placeholder="e.g. Jaipur"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
            {deferredQuery.length >= MIN_SEARCH_LENGTH ? (
              <Suggestions query={deferredQuery} onPick={setPicked} />
            ) : null}
            <p className="text-xs text-ink-subtle">
              Search by Photon · © OpenStreetMap contributors
            </p>
          </>
        )
      ) : (
        <>
          <TextField
            label="Place name"
            maxLength={120}
            value={manualName}
            onChange={(event) => {
              setManualName(event.target.value);
            }}
          />
          <SelectField
            label="Country"
            value={manualCountry}
            onChange={(event) => {
              setManualCountry(event.target.value);
            }}
          >
            <option value="">Not sure / at sea</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Coordinates"
            placeholder="26.9124, 75.7873"
            hint="Long-press a spot in any map app and copy its coordinates."
            value={manualCoordinates}
            onChange={(event) => {
              setManualCoordinates(event.target.value);
            }}
          />
        </>
      )}
      <SegmentedControl
        label="Status"
        options={[
          { value: 'visited', label: 'Been there' },
          { value: 'wishlist', label: 'Want to go' },
        ]}
        value={status}
        onChange={setStatus}
      />
      {household.partner ? (
        <SegmentedControl
          label="Visible to"
          options={[
            { value: 'household', label: 'Both of us' },
            { value: 'private', label: 'Only me' },
          ]}
          value={visibility}
          onChange={setVisibility}
        />
      ) : null}
      {status === 'visited' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="From"
              type="date"
              max={today}
              value={startedOn}
              onChange={(event) => {
                setStartedOn(event.target.value);
              }}
            />
            <TextField
              label="To (optional)"
              type="date"
              value={endedOn}
              onChange={(event) => {
                setEndedOn(event.target.value);
              }}
            />
          </div>
          <VisitorPicker
            value={visitors}
            onChange={setVisitors}
            onlySelf={visibility === 'private'}
          />
        </>
      ) : null}
      <FormError message={error ?? save.error?.message} />
      <Button onClick={() => void onSave()} isLoading={save.isPending} fullWidth>
        {status === 'visited' ? 'Stamp it' : 'Add to wishlist'}
      </Button>
    </div>
  );
}
