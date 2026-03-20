import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createContext, memo, type ReactNode, useCallback, useContext, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { createStore as createStateStore } from 'zustand/vanilla';
import type { Registry } from './registry';
import type {
  Dispatch,
  DispatchHook,
  InvalidateAsyncSub,
  InvalidateAsyncSubs,
  InvokeHook,
  Read,
  ReplaceAsyncSub,
  ReplaceAsyncSubs,
  Slice,
  StoreEvents,
  StoreSubs,
  ValueHook,
} from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function hashKey(value: unknown): string {
  return JSON.stringify(value, (_, val) =>
    isPlainObject(val)
      ? Object.keys(val).sort().reduce((result, key) => {
          result[key] = val[key];
          return result;
        }, {} as Record<string, unknown>)
      : val
  );
}

export type CreateStoreArgs<
  State extends object,
  Subs extends StoreSubs,
  Events extends StoreEvents,
> = {
  slices: Array<Slice<State>>;
  registry: Registry<Subs, Events>;
};

export type StoreBundle<
  Subs extends StoreSubs,
  Events extends StoreEvents,
> = {
  StoreProvider: ({ children }: { children: ReactNode }) => ReactNode;
  useValue: ValueHook<Subs>;
  useDispatch: DispatchHook<Events>;
  useInvoke: InvokeHook<Events>;
};

export function createStore<
  State extends object,
  Subs extends StoreSubs,
  Events extends StoreEvents,
>({ slices, registry }: CreateStoreArgs<State, Subs, Events>): StoreBundle<Subs, Events> {
  type StoreContextType = {
    useValueImpl: ValueHook<Subs>;
    useDispatchImpl: DispatchHook<Events>;
  };

  const placeholderContext: StoreContextType = {
    useValueImpl: (_id, _params) => {
      throw new Error('"useValue" not set for StoreContext');
    },
    useDispatchImpl: (_id) => {
      throw new Error('"useDispatch" not set for StoreContext');
    },
  };

  const StoreContext = createContext<StoreContextType>(placeholderContext);

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

    const read: Read<Subs> = (id, params?) => {
      const subscription = registry.subscriptions[id]!;

      return subscription.async
        ? (queryClient.getQueryState([id, { params }])?.data as Subs[typeof id]['result'])
        : (subscription.fn({ state: getState(), params }) as Subs[typeof id]['result']);
    };

    const dispatch: Dispatch<Events> = (id, params?) => {
      const event = registry.events[id]!;
      return event.fn({
        setState,
        getState,
        params,
        read,
        dispatch,
        invalidateAsyncSub,
        invalidateAsyncSubs,
        replaceAsyncSub,
        replaceAsyncSubs,
      });
    };

    const useLocal: ValueHook<Subs> = (id, params) => {
      const subscription = registry.subscriptions[id]!;
      const selector = useShallow((state: State) => {
        return subscription.fn({ state, params }) as Subs[typeof id]['result'];
      });

      return useStore(stateStore, selector);
    };

    const useValueImpl: ValueHook<Subs> = (id, params) => {
      const useValue = registry.subscriptions[id]!.async ? useRemote : useLocal;
      return useValue(id, params);
    };

    const useDispatchImpl: DispatchHook<Events> = (id) => {
      return useCallback((params) => dispatch(id, params), [id]);
    };

    return { stateStore, queryClient, useValueImpl, useDispatchImpl };
  }

  const useRemote: ValueHook<Subs> = (id, params) => {
    const { data } = useSuspenseQuery({ queryKey: [id, { params }] });
    return data as Subs[typeof id]['result'];
  };

  const useValue: ValueHook<Subs> = (id, params) => {
    const { useValueImpl } = useContext(StoreContext);
    return useValueImpl(id, params);
  };

  const useDispatch: DispatchHook<Events> = (id) => {
    const { useDispatchImpl } = useContext(StoreContext);
    return useDispatchImpl(id);
  };

  const useInvoke: InvokeHook<Events> = (id, params) => {
    const dispatch = useDispatch(id);
    const paramsHash = hashKey(params);

    return useCallback(() => dispatch(params), [dispatch, paramsHash]);
  };

  const StoreProvider = memo(({ children }: { children: ReactNode }) => {
    const scopeRef = useRef<ReturnType<typeof createProviderScope>>();
    if (!scopeRef.current) {
      scopeRef.current = createProviderScope();
    }
    const { queryClient, useValueImpl, useDispatchImpl } = scopeRef.current;

    const ctx = useMemo(
      () => ({
        useValueImpl,
        useDispatchImpl,
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
    useValue,
    useDispatch,
    useInvoke,
  };
}
