import { Link } from 'wouter';
import { useHousehold } from '@/features/household';
import { useResource } from '@/shared/lib/useResource';
import { Card } from '@/shared/ui/Card';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { listPlaces } from '../data/travelApi';
import { filterPlaces, flagEmoji, travelStats } from '../domain/places';

/** Home-screen summary: places visited together and the next wishlist idea. No map code here. */
export function TravelSnapshotCard() {
  const household = useHousehold();
  const places = useResource('home-places', listPlaces);
  const people = { meId: household.me.userId, partnerId: household.partner?.userId ?? null };
  return (
    <Card
      title="World"
      action={
        <Link href="/world" className="text-sm font-medium text-accent">
          Open
        </Link>
      }
    >
      {places.status === 'loading' ? <Skeleton className="h-12" /> : null}
      {places.status === 'error' ? (
        <ErrorState error={places.error} onRetry={places.reload} />
      ) : null}
      {places.status === 'success'
        ? (() => {
            const stats = travelStats(places.data);
            const together = household.partner
              ? filterPlaces(places.data, 'together', people).length
              : null;
            const nextWish = places.data.find(
              (place) => place.isWishlist && place.visits.length === 0,
            );
            return (
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  <strong className="text-lg tabular-nums">{stats.placesVisited}</strong>{' '}
                  {stats.placesVisited === 1 ? 'place' : 'places'} in{' '}
                  <strong className="tabular-nums">{stats.countriesVisited}</strong>{' '}
                  {stats.countriesVisited === 1 ? 'country' : 'countries'}
                  {together !== null ? ` · ${together} together` : ''}
                </p>
                {nextWish ? (
                  <p className="text-ink-muted">
                    Next on the wishlist: {flagEmoji(nextWish.countryCode)} {nextWish.name}
                  </p>
                ) : null}
              </div>
            );
          })()
        : null}
    </Card>
  );
}
