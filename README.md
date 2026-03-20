# interphase

Reusable state-management runtime extracted from the Elements store.

It keeps the original runtime model:

- Zustand for local state
- TanStack Query v5 for async subscriptions
- typed subscriptions and events

It does not include app policy:

- no aggregated `Subs`/`Events`
- no slice inventory
- no transport helpers like `remoteSub`
- no app-specific hooks

## Install

```bash
npm install react @tanstack/react-query zustand immer
```

## Example

```tsx
import { createRegistry, createStore, Evt, Sub } from 'interphase';

type Subs = {
  'counter/value': Sub<undefined, number>;
  'profile/name': Sub<{ userId: string }, string>;
};

type Events = {
  'counter/increment': Evt<{ amount: number }>;
};

const registry = createRegistry<Subs, Events>();
const { sub, asyncSub, evt } = registry;

const remoteSub = <T extends keyof Subs>(id: T) => {
  asyncSub(id, async ({ params }) => {
    const response = await fetch(`/api/sub/${String(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });

    return response.json();
  });
};

sub('counter/value', ({ state }) => state.counter.value);
remoteSub('profile/name');

evt('counter/increment', ({ setState, params }) => {
  setState((state: any) => {
    state.counter.value += params.amount;
  });
});

const store = createStore({
  registry,
  slices: [
    () => ({
      counter: { value: 0 },
    }),
  ],
});

export const StoreProvider = store.StoreProvider;
export const useValue = store.useValue;
export const useDispatch = store.useDispatch;
```

Components consume the app-local exports:

```tsx
function Counter() {
  const count = useValue('counter/value');
  const increment = useDispatch('counter/increment');

  return <button onClick={() => increment({ amount: 1 })}>{count}</button>;
}
```

## Examples

- `examples/todos` is a small Vite app that consumes `interphase` as a local package.
- The example scripts build the library before starting or bundling the app.

```bash
cd examples/todos
npm install
npm run dev
```
