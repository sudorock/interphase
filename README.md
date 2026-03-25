# interphase

Reactive state for React. Sync and async through one interface.

## Motive

State in UI apps fractures into two worlds: local state is immediate, remote state drags in loading flags, error branches, and conditional rendering. Components end up shaped by *how* data arrives rather than *what* they display.

interphase collapses that distinction. One hook — `useSub` — reads any subscription. Sync subscriptions resolve from Zustand state. Async subscriptions resolve through TanStack Query with Suspense. Components don't know and don't care which is which.

`suspensify` wires async subscriptions to React Suspense so fallback UI is declarative, not procedural.

## Install

```bash
npm install @aktopia/interphase
```

Package: [@aktopia/interphase](https://www.npmjs.com/package/@aktopia/interphase)

Peer dependencies: `react`, `zustand`, `@tanstack/react-query`.
Direct dependency (bundled): `immer`.

## Quick start

```ts
import { createRegistry, createStore, suspensify, type Event, type Sub } from '@aktopia/interphase';

type Todo = { id: string; text: string; done: boolean };
type SortBy = 'newest' | 'oldest' | 'alphabetical';

type State = {
  sortBy: SortBy;
};

type Subs = {
  'todo/sort-by': Sub<{}, SortBy>;
  'todo/items': Sub<{ sortBy: SortBy }, Todo[]>;
};

type Events = {
  'todo/create': Event<{ text: string }>;
  'todo/toggle': Event<{ id: string }>;
  'todo.sort-by/set': Event<{ value: SortBy }>;
};

const registry = createRegistry<State, Subs, Events>();
const { sub, asyncSub, event } = registry;

sub('todo/sort-by', ({ state }) => state.sortBy);

// Async subscription: backed by TanStack Query + Suspense
asyncSub('todo/items', async ({ params }) => {
  const res = await fetch(`/api/todos?sort=${params.sortBy}`);
  return res.json();
});

event('todo/create', async ({ params, invalidateAsyncSub, fetchSub }) => {
  const sortBy = fetchSub('todo/sort-by');
  await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: params.text }),
  });
  await invalidateAsyncSub(['todo/items', { sortBy }]);
});

event('todo/toggle', async ({ params, invalidateAsyncSub, fetchSub }) => {
  const sortBy = fetchSub('todo/sort-by');
  await fetch(`/api/todos/${params.id}/toggle`, { method: 'POST' });
  await invalidateAsyncSub(['todo/items', { sortBy }]);
});

event('todo.sort-by/set', ({ params, setState }) => {
  setState((state) => {
    state.sortBy = params.value;
  });
});

const store = createStore<State, Subs, Events>({
  registry,
  slices: [() => ({ sortBy: 'newest' })],
});

export const { StoreProvider, useSub, useEvent } = store;
```

```tsx
const TodoList = suspensify(function TodoList() {
  const sortBy = useSub('todo/sort-by');             // sync
  const todos = useSub('todo/items', { sortBy });  // async, suspends until resolved
  const create = useEvent('todo/create');
  const toggle = useEvent('todo/toggle');
  const setSort = useEvent('todo.sort-by/set');

  return (
    <div>
      <select value={sortBy} onChange={(e) => setSort({ value: e.target.value as SortBy })}>
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="alphabetical">A-Z</option>
      </select>
      <button onClick={() => create({ text: 'New task' })}>Add</button>
      <ul>
        {todos.map((t) => (
          <li key={t.id} onClick={() => toggle({ id: t.id })}>
            {t.done ? '[x]' : '[ ]'} {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
});

function App() {
  return (
    <StoreProvider>
      <TodoList fallback={<p>Loading todos...</p>} />
    </StoreProvider>
  );
}
```

## API reference

### `createRegistry<State, Subs, Events>()`

Creates a registry that collects subscription and event definitions. Returns `{ sub, asyncSub, event }` and internal maps consumed by `createStore`.

```ts
const registry = createRegistry<State, Subs, Events>();
const { sub, asyncSub, event } = registry;
```

### `sub(id, resolver)`

Registers a sync subscription. The resolver receives `{ state, params }` and returns the derived value.

```ts
sub('todo/sort-by', ({ state }) => state.sortBy);
```

### `asyncSub(id, resolver)`

Registers an async subscription. The resolver returns a `Promise`. Async subscriptions are backed by TanStack Query and integrate with React Suspense.

```ts
asyncSub('todo/items', async ({ params }) => {
  const res = await fetch(`/api/todos?sort=${params.sortBy}`);
  return res.json();
});
```

### `event(id, handler)`

Registers an event handler. The handler receives `{ setState, getState, fetchSub, params, dispatchEvent, invalidateAsyncSub, invalidateAsyncSubs, replaceAsyncSub, replaceAsyncSubs }`.

`setState` uses immer. Mutate the draft directly.

`fetchSub(id, params?)` reads the current value of a subscription.

`dispatchEvent(id, params?)` runs another event from inside the current event handler.

```ts
event('todo.sort-by/set', ({ params, setState }) => {
  setState((state) => {
    state.sortBy = params.value;
  });
});
```

Event handlers can invalidate async subscriptions to trigger a refetch:

```ts
event('todo/create', async ({ params, invalidateAsyncSub, fetchSub }) => {
  const sortBy = fetchSub('todo/sort-by');
  await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: params.text }),
  });
  await invalidateAsyncSub(['todo/items', { sortBy }]);
});
```

Event handlers can compose other events:

```ts
event('todo/toggle-twice', ({ params, dispatchEvent }) => {
  dispatchEvent('todo/toggle', { id: params.id });
  dispatchEvent('todo/toggle', { id: params.id });
});
```

### `createStore({ registry, slices })`

Creates the store from a registry and initial state slices. Returns `{ StoreProvider, useSub, useEvent, useBoundEvent }`.

Each slice is a function returning a partial state object. Slices are merged to form the initial state.

```ts
const store = createStore<State, Subs, Events>({
  registry,
  slices: [
    () => ({ todos: [] }),
  ],
});

export const { StoreProvider, useSub, useEvent, useBoundEvent } = store;
```

### `useSub(id, params?)`

One hook for all subscriptions — sync or async.

```tsx
const sortBy = useSub('todo/sort-by');             // sync
const todos = useSub('todo/items', { sortBy });  // async (suspends)
```

### `useEvent(id)`

Returns a stable dispatcher function for the given event.

```tsx
const create = useEvent('todo/create');
// ...
<button onClick={() => create({ text: 'New task' })}>Add</button>
```

### `useBoundEvent(id, params)`

Returns a memoized zero-arg callback. Useful for handlers with fixed params — no allocation on re-render.

```tsx
const addDefault = useBoundEvent('todo/create', { text: 'Default task' });
// ...
<button onClick={addDefault}>Add default</button>
```

### `suspensify(Component)`

HOC that wraps a component in `<Suspense>`. Accepts an optional `fallback` prop.

Without `suspensify`:

```tsx
<Suspense fallback={<p>Loading...</p>}>
  <TodoList />
</Suspense>
```

With `suspensify`:

```tsx
const TodoList = suspensify(function TodoList() {
  const todos = useSub('todo/items', { sortBy });
  // ...
});

<TodoList fallback={<p>Loading...</p>} />
```

## `remoteSub` pattern

Thin wrapper over `asyncSub` that wires a subscription directly to an HTTP endpoint:

```ts
const remoteSub = <T extends keyof Subs>(id: T) => {
  asyncSub(id, async ({ params }) => {
    const res = await fetch(`/api/${String(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  });
};
```

One line per subscription:

```ts
remoteSub('todo/items');
```

## Examples

`examples/todos` — a Vite app that demonstrates the full API.

```bash
cd examples/todos
npm install
npm run dev
```

## License

MIT
