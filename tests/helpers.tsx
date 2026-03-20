import { Suspense, type ReactNode } from 'react';
import { createRegistry, createStore } from '../src/index';
import type { Sub, Evt, Slice } from '../src/index';

type State = { count: number; label: string };

type Subs = {
  count: Sub<void, number>;
  doubled: Sub<void, number>;
  countByFactor: Sub<{ factor: number }, number>;
  labelUpper: Sub<void, string>;
  asyncCount: Sub<void, number>;
};

type Events = {
  increment: Evt<void>;
  setCount: Evt<{ value: number }>;
  setLabel: Evt<{ value: string }>;
};

export type { State, Subs, Events };

export function createTestStore() {
  const registry = createRegistry<Subs, Events>();

  registry.sub('count', ({ state }: { state: State }) => state.count);
  registry.sub('doubled', ({ state }: { state: State }) => state.count * 2);
  registry.sub('countByFactor', ({ state, params }: { state: State; params: { factor: number } }) => state.count * params.factor);
  registry.sub('labelUpper', ({ state }: { state: State }) => state.label.toUpperCase());
  registry.asyncSub('asyncCount', async ({ state }: { state: State }) => state.count);

  registry.evt('increment', ({ setState }) => {
    setState((draft: State) => { draft.count++; });
  });
  registry.evt('setCount', ({ setState, params }) => {
    setState((draft: State) => { draft.count = params.value; });
  });
  registry.evt('setLabel', ({ setState, params }) => {
    setState((draft: State) => { draft.label = params.value; });
  });

  const slices: Slice<State>[] = [
    () => ({ count: 0 }),
    () => ({ label: 'hello' }),
  ];

  return createStore<State, Subs, Events>({ slices, registry });
}

export function createWrapper(StoreProvider: ({ children }: { children: ReactNode }) => ReactNode) {
  return ({ children }: { children: ReactNode }) => (
    <StoreProvider>
      <Suspense fallback={<div>loading</div>}>
        {children}
      </Suspense>
    </StoreProvider>
  );
}
