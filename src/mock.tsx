import { type ReactNode, use, useMemo } from 'react';
import { hashKey } from './hash';
import type { StoreBundle, StoreContextType } from './store';
import type { StoreEvents, StoreSubs } from './types';

type MockSubValue<Result> = Result | Promise<Result>;

export type MockSubs<Subs extends StoreSubs> = {
  [K in keyof Subs]?:
    | MockSubValue<Subs[K]['result']>
    | ((params: Subs[K]['params']) => MockSubValue<Subs[K]['result']>);
};

export type MockEvents<Events extends StoreEvents> = {
  [K in keyof Events]?: (params: Events[K]['params']) => void | Promise<void>;
};

export type MockStoreProviderProps<Subs extends StoreSubs, Events extends StoreEvents> = {
  subs?: MockSubs<Subs>;
  events?: MockEvents<Events>;
  children: ReactNode;
};

const EMPTY = {};

export function createMockStore<Subs extends StoreSubs, Events extends StoreEvents>(
  store: StoreBundle<Subs, Events>
) {
  const StoreContext = store.context;

  const MockStoreProvider = ({
    subs = EMPTY,
    events = EMPTY,
    children,
  }: MockStoreProviderProps<Subs, Events>) => {
    const ctx = useMemo<StoreContextType<Subs, Events>>(() => {
      const cache = new Map<string, unknown>();
      return {
        useSubImpl: (id, params) => {
          const key = hashKey([id, params]);
          if (!cache.has(key)) {
            if (!(id in subs)) throw new Error(`no mock sub "${String(id)}"`);
            const value = subs[id];
            cache.set(key, typeof value === 'function' ? value(params) : value);
          }
          const result = cache.get(key);
          return (result instanceof Promise ? use(result) : result) as Subs[typeof id]['result'];
        },
        useEventImpl: (id) => {
          const handler = events[id];
          if (!handler) throw new Error(`no mock event "${String(id)}"`);
          return handler;
        },
      };
    }, [subs, events]);

    return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>;
  };

  return { MockStoreProvider };
}
