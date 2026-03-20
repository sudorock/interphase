import {
  QueryClient,
  QueryClientProvider,
  useQuery as useReactQuery,
} from 'react-query';
import { createContext, memo, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';
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
  read: Read<Subs>;
  dispatch: Dispatch<Events>;
  invalidateAsyncSub: InvalidateAsyncSub<Subs>;
  invalidateAsyncSubs: InvalidateAsyncSubs<Subs>;
  replaceAsyncSub: ReplaceAsyncSub<Subs>;
  replaceAsyncSubs: ReplaceAsyncSubs<Subs>;
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

  const initialState = slices.reduce<Partial<State>>((acc, slice) => {
    return Object.assign(acc, slice());
  }, {}) as State;

  const useStore = create<State>()(
    devtools(
      immer(() => {
        return initialState;
      })
    )
  );

  function queryFn({ queryKey }: any) {
    const [id, params] = queryKey;
    const subscription = registry.subscriptions[id]!;
    return subscription.fn(params);
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn,
        suspense: true,
      },
    },
  });

  const setState = useStore.setState;
  const getState = useStore.getState;

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

  const read: Read<Subs> = (id, params?) => {
    const subscription = registry.subscriptions[id]!;

    return subscription.async
      ? (queryClient.getQueryState([id, { params }])?.data as Subs[typeof id]['result'])
      : (subscription.fn({ state: getState(), params }) as Subs[typeof id]['result']);
  };

  const useRemote: ValueHook<Subs> = (id, params) => {
    const { data } = useReactQuery([id, { params }]);
    return data as Subs[typeof id]['result'];
  };

  const useLocal: ValueHook<Subs> = (id, params) => {
    const subscription = registry.subscriptions[id]!;
    return useStoreWithEqualityFn(
      useStore,
      (state) => {
        return subscription.fn({ state, params }) as Subs[typeof id]['result'];
      },
      shallow
    );
  };

  const useValueImpl: ValueHook<Subs> = (id, params) => {
    const useValue = registry.subscriptions[id]!.async ? useRemote : useLocal;
    return useValue(id, params);
  };

  const useDispatchImpl: DispatchHook<Events> = (id) => {
    return useCallback((params) => dispatch(id, params), [id]);
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
    const paramsKey = JSON.stringify(params);

    return useCallback(() => dispatch(params), [dispatch, paramsKey]);
  };

  const StoreProvider = memo(({ children }: { children: ReactNode }) => {
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
    read,
    dispatch,
    invalidateAsyncSub,
    invalidateAsyncSubs,
    replaceAsyncSub,
    replaceAsyncSubs,
  };
}
