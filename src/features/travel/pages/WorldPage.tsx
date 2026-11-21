import { Globe2, Plus } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { memberName, useHousehold } from '@/features/household';
import { formatLocalDate, todayIn } from '@/shared/lib/localDate';
import { useResource } from '@/shared/lib/useResource';
import { Fab } from '@/shared/ui/Fab';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SegmentedControl, type SegmentOption } from '@/shared/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingRows, Skeleton } from '@/shared/ui/States';
import { AddPlaceSheet } from '../components/AddPlaceSheet';
import { PlaceSheet } from '../components/PlaceSheet';
import { listPlaces } from '../data/travelApi';
import {
  filterPlaces,
  flagEmoji,
  summarizeVisits,
  travelStats,
  type Place,
  type PlaceFilter,
} from '../domain/places';

function MapUnavailable() {
  return (
    <div className="flex h-72 items-center justify-center rounded-card border border-line bg-surface-2 p-6 text-center text-sm text-ink-muted">
      The map could not be loaded. Your places are listed below.
    </div>
  );
}

// MapLibre is large; it is fetched only when this page renders, never on other routes.
const TravelMap = lazy(() =>
  import('../components/TravelMap').then(
    (module) => ({ default: module.TravelMap }),
    () => ({ default: MapUnavailable }),
  ),
);

function PlaceRow({ place, onOpen }: { place: Place; onOpen: () => void }) {
  const household = useHousehold();
  const summary = summarizeVisits(place, {
    meId: household.me.userId,
    partnerId: household.partner?.userId ?? null,
  });
  const latest = place.visits[0];
  const who = summary.together
    ? 'Together'
    : latest
      ? latest.memberIds.map((id) => memberName(household, id)).join(' & ')
      : null;
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-2"
      >
        <span className="text-xl" aria-hidden>
          {flagEmoji(place.countryCode)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{place.name}</span>
          <span className="block truncate text-sm text-ink-muted">
            {latest
              ? `${who ?? ''} · ${formatLocalDate(latest.startedOn, 'month-year')}`
              : 'Want to go'}
            {latest && place.isWishlist ? ' · on wishlist' : ''}
          </span>
        </span>
      </button>
    </li>
  );
}

export function WorldPage() {
  const household = useHousehold();
  const today = todayIn(household.timeZone, new Date());
  const places = useResource('places', listPlaces);
  const [filter, setFilter] = useState<PlaceFilter>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const people = useMemo(
    () => ({ meId: household.me.userId, partnerId: household.partner?.userId ?? null }),
    [household.me.userId, household.partner],
  );

  const filterOptions: SegmentOption<PlaceFilter>[] = household.partner
    ? [
        { value: 'all', label: 'All' },
        { value: 'mine', label: 'Mine' },
        { value: 'partner', label: household.partner.displayName },
        { value: 'together', label: 'Together' },
        { value: 'wishlist', label: 'Wishlist' },
      ]
    : [
        { value: 'all', label: 'All' },
        { value: 'wishlist', label: 'Wishlist' },
      ];

  const visible = useMemo(
    () => (places.status === 'success' ? filterPlaces(places.data, filter, people) : []),
    [places, filter, people],
  );
  const stats = travelStats(visible);
  const openPlace =
    places.status === 'success' ? (places.data.find((place) => place.id === openId) ?? null) : null;

  return (
    <>
      <PageHeader title="World" />
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="Show places"
          options={filterOptions}
          value={filter}
          onChange={setFilter}
        />
        {places.status === 'loading' ? <LoadingRows rows={3} label="Loading places" /> : null}
        {places.status === 'error' ? (
          <ErrorState error={places.error} onRetry={places.reload} />
        ) : null}
        {places.status === 'success' ? (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Places visited', stats.placesVisited],
                ['Countries', stats.countriesVisited],
                ['Wishlist', stats.wishlist],
              ].map(([label, value]) => (
                <div key={label} className="rounded-card border border-line bg-surface py-3">
                  <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                  <dt className="text-xs text-ink-muted">{label}</dt>
                </div>
              ))}
            </dl>
            <Suspense fallback={<Skeleton className="h-72" />}>
              <TravelMap places={visible} people={people} onSelect={setOpenId} />
            </Suspense>
            {visible.length === 0 ? (
              <EmptyState
                icon={<Globe2 className="size-8" aria-hidden />}
                title={places.data.length === 0 ? 'No places yet' : 'Nothing for this filter'}
                description="Stamp the places you have been and keep a wishlist of where to go next."
              />
            ) : (
              <ul
                aria-label="Places"
                className="overflow-hidden rounded-card border border-line bg-surface"
              >
                {visible.map((place) => (
                  <PlaceRow
                    key={place.id}
                    place={place}
                    onOpen={() => {
                      setOpenId(place.id);
                    }}
                  />
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-subtle">
              A pin means someone recorded a visit; it says nothing about how long or how much of a
              place you saw.
            </p>
          </>
        ) : null}
      </div>
      <Fab
        label="Add place"
        icon={<Plus className="size-5" aria-hidden />}
        onClick={() => {
          setIsAdding(true);
        }}
      />
      <AddPlaceSheet
        open={isAdding}
        today={today}
        onClose={() => {
          setIsAdding(false);
        }}
        onSaved={places.reload}
      />
      <PlaceSheet
        place={openPlace}
        today={today}
        onClose={() => {
          setOpenId(null);
        }}
        onChanged={places.reload}
      />
    </>
  );
}
