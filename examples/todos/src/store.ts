import { createRegistry, createStore, type Evt, type Sub } from 'interphase';

type Filter = 'all' | 'active' | 'done';

type Todo = {
  id: string;
  text: string;
  done: boolean;
};

type State = {
  todos: Todo[];
  draft: string;
  filter: Filter;
};

type Subs = {
  'todo.list/items': Sub<{}, Todo[]>;
  'todo.list/stats': Sub<{}, { total: number; done: number; remaining: number }>;
  'todo.filter/value': Sub<{}, Filter>;
  'todo.draft/value': Sub<{}, string>;
  'todo.tip/text': Sub<{}, string>;
};

type Events = {
  'todo.draft/set': Evt<{ value: string }>;
  'todo/create': Evt<{}>;
  'todo/toggle': Evt<{ id: string }>;
  'todo/delete': Evt<{ id: string }>;
  'todo.filter/set': Evt<{ value: Filter }>;
  'todo.tip/refresh': Evt<{}>;
};

const tips = [
  'Split big chores into five-minute starts.',
  'Clear the smallest task first to build momentum.',
  'Group errands together so your list shrinks faster.',
  'Write tasks as verbs so each item implies action.',
];

const nextTip = () => {
  return tips[Math.floor(Math.random() * tips.length)];
};

const registry = createRegistry<State, Subs, Events>();
const { sub, asyncSub, evt } = registry;

sub('todo.list/items', ({ state }) => {
  if (state.filter === 'active') {
    return state.todos.filter((todo: Todo) => !todo.done);
  }

  if (state.filter === 'done') {
    return state.todos.filter((todo: Todo) => todo.done);
  }

  return state.todos;
});

sub('todo.list/stats', ({ state }) => {
  const total = state.todos.length;
  const done = state.todos.filter((todo: Todo) => todo.done).length;

  return {
    total,
    done,
    remaining: total - done,
  };
});

sub('todo.filter/value', ({ state }) => state.filter);
sub('todo.draft/value', ({ state }) => state.draft);

asyncSub('todo.tip/text', async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  return nextTip();
});

evt('todo.draft/set', ({ params, setState }) => {
  setState((state: State) => {
    state.draft = params.value;
  });
});

evt('todo/create', ({ read, setState }) => {
  const draft = read('todo.draft/value')?.trim();

  if (!draft) {
    return;
  }

  setState((state: State) => {
    state.todos.unshift({
      id: crypto.randomUUID(),
      text: draft,
      done: false,
    });
    state.draft = '';
  });
});

evt('todo/toggle', ({ params, setState }) => {
  setState((state: State) => {
    const todo = state.todos.find((item) => item.id === params.id);

    if (!todo) {
      return;
    }

    todo.done = !todo.done;
  });
});

evt('todo/delete', ({ params, setState }) => {
  setState((state: State) => {
    state.todos = state.todos.filter((todo) => todo.id !== params.id);
  });
});

evt('todo.filter/set', ({ params, setState }) => {
  setState((state: State) => {
    state.filter = params.value;
  });
});

evt('todo.tip/refresh', async ({ invalidateAsyncSub }) => {
  await invalidateAsyncSub(['todo.tip/text', undefined]);
});

const store = createStore<State, Subs, Events>({
  registry,
  slices: [
    () => ({
      draft: '',
      filter: 'all',
      todos: [
        { id: '1', text: 'Ship the interphase runtime', done: true },
        { id: '2', text: 'Wire a local example app', done: true },
        { id: '3', text: 'Add one more task from the UI', done: false },
      ],
    }),
  ],
});

export const StoreProvider = store.StoreProvider;
export const useEvent = store.useEvent;
export const useSub = store.useSub;
