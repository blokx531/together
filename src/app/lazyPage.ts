import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'together.chunkReload';

/**
 * React.lazy for route pages. After a new deploy, an open tab may request a chunk that no longer
 * exists; in that case reload once to pick up the new build instead of showing an error.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  return lazy(async () => {
    try {
      const component = await load();
      sessionStorage.removeItem(RELOAD_FLAG);
      return { default: component };
    } catch (error) {
      if (sessionStorage.getItem(RELOAD_FLAG) === null) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  });
}
