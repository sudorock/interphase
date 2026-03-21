import { Suspense, type ReactNode } from 'react';
import { createRegistry, createStore } from '../src/index';
import type { Sub, Event, Slice } from '../src/index';

type State = { count: number; label: string; flag: boolean };

type Subs = {
  count: Sub<void, number>;
  doubled: Sub<void, number>;
  countByFactor: Sub<{ factor: number }, number>;
  labelUpper: Sub<void, string>;
  stats: Sub<void, { count: number; label: string }>;
  asyncCount: Sub<void, number>;
};

type Events = {
  increment: Event<void>;
  setCount: Event<{ value: number }>;
  setLabel: Event<{ value: string }>;
  toggleFlag: Event<void>;
  setBoth: Event<{ count: number; label: string }>;
};

export type { State, Subs, Events };

export function createTestStore() {
  const registry = createRegistry<State, Subs, Events>();

  registry.sub('count', ({ state }) => state.count);
  registry.sub('doubled', ({ state }) => state.count * 2);
  registry.sub('countByFactor', ({ state, params }) => state.count * params.factor);
  registry.sub('labelUpper', ({ state }) => state.label.toUpperCase());
  registry.sub('stats', ({ state }) => ({ count: state.count, label: state.label }));
  registry.asyncSub('asyncCount', async ({ state }) => state.count);

  registry.event('increment', ({ setState }) => {
    setState(((draft: State) => {
      draft.count++;
    }));
  });
  registry.event('setCount', ({ setState, params }) => {
    setState(((draft: State) => {
      draft.count = params.value;
    }));
  });
  registry.event('setLabel', ({ setState, params }) => {
    setState(((draft: State) => {
      draft.label = params.value;
    }));
  });
  registry.event('toggleFlag', ({ setState }) => {
    setState(((draft: State) => {
      draft.flag = !draft.flag;
    }));
  });
  registry.event('setBoth', ({ setState, params }) => {
    setState(((draft: State) => {
      draft.count = params.count;
      draft.label = params.label;
    }));
  });

  const slices: Slice<State>[] = [() => ({ count: 0 }), () => ({ label: 'hello' }), () => ({ flag: false })];

  return createStore<State, Subs, Events>({ slices, registry });
}

export function createWrapper(StoreProvider: ({ children }: { children: ReactNode }) => ReactNode) {
  return ({ children }: { children: ReactNode }) => (
    <StoreProvider>
      <Suspense fallback={<div>loading</div>}>{children}</Suspense>
    </StoreProvider>
  );
}
