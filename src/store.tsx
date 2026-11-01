import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  type Context,
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { createStore as createStateStore } from 'zustand/vanilla';
import { hashKey } from './hash';
import type { Registry } from './registry';
import type {
  BoundEventHook,
  DispatchEvent,
  EventHook,
  FetchSub,
  InvalidateAsyncSub,
  InvalidateAsyncSubs,
  ReplaceAsyncSub,
  ReplaceAsyncSubs,
  Slice,
  StoreEvents,
  StoreSubs,
  SubHook,
} from './types';

export type StoreContextType<Subs extends StoreSubs, Events extends StoreEvents> = {
  useSubImpl: SubHook<Subs>;
  useEventImpl: EventHook<Events>;
};

export type CreateStoreArgs<
  State extends object,
  Subs extends StoreSubs,
  Events extends StoreEvents,
> = {
  slices: Array<Slice<State>>;
  registry: Registry<State, Subs, Events>;
};

export type StoreBundle<
  Subs extends StoreSubs,
  Events extends StoreEvents,
> = {
  StoreProvider: ({ children }: { children: ReactNode }) => ReactNode;
  useSub: SubHook<Subs>;
  useEvent: EventHook<Events>;
  useBoundEvent: BoundEventHook<Events>;
  context: Context<StoreContextType<Subs, Events>>;
};

export function createStore<
  State extends object,
  Subs extends StoreSubs,
  Events extends StoreEvents,
>({ slices, registry }: CreateStoreArgs<State, Subs, Events>): StoreBundle<Subs, Events> {
  const StoreContext = createContext<StoreContextType<Subs, Events>>({
    useSubImpl: () => {
      throw new Error('"useSub" called outside a StoreProvider');
    },
    useEventImpl: () => {
      throw new Error('"useEvent" called outside a StoreProvider');
    },
  });

  function createProviderScope() {
    const initialState = slices.reduce<Partial<State>>((acc, slice) => {
      return Object.assign(acc, slice());
    }, {}) as State;

    const stateStore = createStateStore<State>()(
      devtools(
        immer(() => {
          return initialState;
        })
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          queryFn: ({ queryKey }: any) => {
            const [id, { params }] = queryKey;
            const subscription = registry.subscriptions[id]!;
            return subscription.fn({ state: stateStore.getState(), params });
          },
        },
      },
    });

    const setState = stateStore.setState;
    const getState = stateStore.getState;

    const invalidateAsyncSub: InvalidateAsyncSub<Subs> = async (sub) => {
      const [id, params] = sub;
      await queryClient.invalidateQueries({ queryKey: [id, { params }] });
    };

    const invalidateAsyncSubs: InvalidateAsyncSubs<Subs> = async (subs) => {
      await Promise.all(subs.map(([id, params]) => invalidateAsyncSub([id, params])));
    };

    const replaceAsyncSub: ReplaceAsyncSub<Subs> = (sub, updater) => {
      const [id, params] = sub;
      queryClient.setQueryData([id, { params }], updater);
    };

    const replaceAsyncSubs: ReplaceAsyncSubs<Subs> = (subs) => {
      for (const sub of subs) {
        const [[id, params], updater] = sub;
        queryClient.setQueryData([id, { params }], updater);
      }
    };

    const fetchSub: FetchSub<Subs> = (id, params?) => {
      const subscription = registry.subscriptions[id]!;

      return subscription.async
        ? (queryClient.getQueryState([id, { params }])?.data as Subs[typeof id]['result'])
        : (subscription.fn({ state: getState(), params }) as Subs[typeof id]['result']);
    };

    const dispatchEvent: DispatchEvent<Events> = (id, params?) => {
      const event = registry.events[id]!;
      return event.fn({
        setState,
        getState,
        params,
        fetchSub,
        dispatchEvent,
        invalidateAsyncSub,
        invalidateAsyncSubs,
        replaceAsyncSub,
        replaceAsyncSubs,
      });
    };

    const useLocal: SubHook<Subs> = (id, params) => {
      const subscription = registry.subscriptions[id]!;
      const selector = useShallow((state: State) => {
        return subscription.fn({ state, params }) as Subs[typeof id]['result'];
      });

      return useStore(stateStore, selector);
    };

    const useSubImpl: SubHook<Subs> = (id, params) => {
      const useSub = registry.subscriptions[id]!.async ? useRemote : useLocal;
      return useSub(id, params);
    };

    const useEventImpl: EventHook<Events> = (id) => {
      return useCallback((params) => dispatchEvent(id, params), [id]);
    };

    return { stateStore, queryClient, useSubImpl, useEventImpl };
  }

  const useRemote: SubHook<Subs> = (id, params) => {
    const { data } = useSuspenseQuery({ queryKey: [id, { params }] });
    return data as Subs[typeof id]['result'];
  };

  const useSub: SubHook<Subs> = (id, params) => {
    const { useSubImpl } = useContext(StoreContext);
    return useSubImpl(id, params);
  };

  const useEvent: EventHook<Events> = (id) => {
    const { useEventImpl } = useContext(StoreContext);
    return useEventImpl(id);
  };

  const useBoundEvent: BoundEventHook<Events> = (id, params) => {
    const dispatch = useEvent(id);
    const paramsHash = hashKey(params);

    return useCallback(() => dispatch(params), [dispatch, paramsHash]);
  };

  const StoreProvider = memo(({ children }: { children: ReactNode }) => {
    const scopeRef = useRef<ReturnType<typeof createProviderScope> | null>(null);
    if (!scopeRef.current) {
      scopeRef.current = createProviderScope();
    }
    const { queryClient, useSubImpl, useEventImpl } = scopeRef.current;

    const ctx = useMemo(
      () => ({
        useSubImpl,
        useEventImpl,
      }),
      []
    );

    return (
      <QueryClientProvider client={queryClient}>
        <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>
      </QueryClientProvider>
    );
  });

  return {
    StoreProvider,
    useSub,
    useEvent,
    useBoundEvent,
    context: StoreContext,
  };
}
