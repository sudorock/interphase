import { render, screen, act, fireEvent } from '@testing-library/react';
import { Suspense } from 'react';
import { createRegistry, createStore, suspensify } from '../src';
import type { Sub, Evt } from '../src';
import { createTestStore, createWrapper, type State, type Subs, type Events } from './helpers';

// --- createRegistry ---

describe('createRegistry', () => {
  it('registers sync subscription', () => {
    const registry = createRegistry<State, Subs, Events>();
    registry.sub('count', ({ state }) => state.count);
    expect(registry.subscriptions['count']).toMatchObject({ async: false });
  });

  it('registers async subscription', () => {
    const registry = createRegistry<State, Subs, Events>();
    registry.asyncSub('asyncCount', async ({ state }) => state.count);
    expect(registry.subscriptions['asyncCount']).toMatchObject({ async: true });
  });

  it('registers event handler', () => {
    const registry = createRegistry<State, Subs, Events>();
    registry.evt('increment', ({ setState }) => {
      setState(((draft: State) => { draft.count++; }));
    });
    expect(registry.events['increment']).toBeDefined();
  });
});

// --- useSub (sync) ---

describe('useSub (sync)', () => {
  it('reads initial sync value', () => {
    const { useSub, StoreProvider } = createTestStore();

    function Display() {
      const count = useSub('count');
      return <div data-testid="count">{count}</div>;
    }

    render(<Display />, { wrapper: createWrapper(StoreProvider) });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('reads derived sync value after dispatch', () => {
    const { useSub, useEvent, StoreProvider } = createTestStore();

    function Display() {
      const doubled = useSub('doubled');
      const dispatch = useEvent('setCount');
      return (
        <>
          <div data-testid="doubled">{doubled}</div>
          <button onClick={() => dispatch({ value: 5 })}>set</button>
        </>
      );
    }

    render(<Display />, { wrapper: createWrapper(StoreProvider) });
    expect(screen.getByTestId('doubled').textContent).toBe('0');

    fireEvent.click(screen.getByText('set'));
    expect(screen.getByTestId('doubled').textContent).toBe('10');
  });

  it('reads sync subscription with params', () => {
    const { useSub, useEvent, StoreProvider } = createTestStore();

    function Display() {
      const result = useSub('countByFactor', { factor: 3 });
      const dispatch = useEvent('setCount');
      return (
        <>
          <div data-testid="result">{result}</div>
          <button onClick={() => dispatch({ value: 4 })}>set</button>
        </>
      );
    }

    render(<Display />, { wrapper: createWrapper(StoreProvider) });
    expect(screen.getByTestId('result').textContent).toBe('0');

    fireEvent.click(screen.getByText('set'));
    expect(screen.getByTestId('result').textContent).toBe('12');
  });
});

// --- useSub (async) ---

describe('useSub (async)', () => {
  it('reads async subscription with Suspense', async () => {
    const { useSub, StoreProvider } = createTestStore();

    function Display() {
      const count = useSub('asyncCount');
      return <div data-testid="async-count">{count}</div>;
    }

    render(<Display />, { wrapper: createWrapper(StoreProvider) });

    expect(screen.getByText('loading')).toBeDefined();
    const el = await screen.findByTestId('async-count');
    expect(el.textContent).toBe('0');
  });

  it('async subscription receives params', async () => {
    type ASubs = { 'data': Sub<{ id: number }, string> };
    type AEvents = Record<string, never>;
    type AState = {};

    const registry = createRegistry<AState, ASubs, AEvents>();
    registry.asyncSub('data', async ({ params }) => {
      return `item-${params.id}`;
    });

    const { useSub, StoreProvider } = createStore<AState, ASubs, AEvents>({
      slices: [],
      registry,
    });

    function Display() {
      const value = useSub('data', { id: 42 });
      return <div data-testid="value">{value}</div>;
    }

    render(
      <StoreProvider>
        <Suspense fallback={<div>loading</div>}>
          <Display />
        </Suspense>
      </StoreProvider>
    );

    const el = await screen.findByTestId('value');
    expect(el.textContent).toBe('item-42');
  });
});

// --- useEvent ---

describe('useEvent', () => {
  it('dispatches event that modifies state', () => {
    const { useSub, useEvent, StoreProvider } = createTestStore();

    function Display() {
      const count = useSub('count');
      const dispatch = useEvent('setCount');
      return (
        <>
          <div data-testid="count">{count}</div>
          <button onClick={() => dispatch({ value: 42 })}>set</button>
        </>
      );
    }

    render(<Display />, { wrapper: createWrapper(StoreProvider) });
    fireEvent.click(screen.getByText('set'));
    expect(screen.getByTestId('count').textContent).toBe('42');
  });

  it('event handler uses immer-style setState', () => {
    const { useSub, useEvent, StoreProvider } = createTestStore();

    function Display() {
      const count = useSub('count');
      const dispatch = useEvent('increment');
      return (
        <>
          <div data-testid="count">{count}</div>
          <button onClick={() => dispatch(undefined as any)}>inc</button>
        </>
      );
    }

    render(<Display />, { wrapper: createWrapper(StoreProvider) });
    fireEvent.click(screen.getByText('inc'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    fireEvent.click(screen.getByText('inc'));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('event handler uses read() to access current sub value', () => {
    type RSubs = { count: Sub<void, number>; doubled: Sub<void, number> };
    type REvents = { setCountFromDoubled: Evt<void> };
    type RState = { count: number };

    const registry = createRegistry<RState, RSubs, REvents>();
    registry.sub('count', ({ state }) => state.count);
    registry.sub('doubled', ({ state }) => state.count * 2);
    registry.evt('setCountFromDoubled', ({ read, setState }) => {
      const doubled = read('doubled');
      setState(((draft: RState) => { draft.count = doubled; }));
    });

    const { useSub, useEvent, StoreProvider } = createStore<RState, RSubs, REvents>({
      slices: [() => ({ count: 3 })],
      registry,
    });

    function Display() {
      const count = useSub('count');
      const dispatch = useEvent('setCountFromDoubled');
      return (
        <>
          <div data-testid="count">{count}</div>
          <button onClick={() => dispatch(undefined as any)}>go</button>
        </>
      );
    }

    render(
      <StoreProvider>
        <Suspense fallback={null}><Display /></Suspense>
      </StoreProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('3');
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByTestId('count').textContent).toBe('6');
  });

  it('event handler dispatches other events', () => {
    type DSubs = { count: Sub<void, number> };
    type DEvents = { increment: Evt<void>; doubleIncrement: Evt<void> };
    type DState = { count: number };

    const registry = createRegistry<DState, DSubs, DEvents>();
    registry.sub('count', ({ state }) => state.count);
    registry.evt('increment', ({ setState }) => {
      setState(((draft: DState) => { draft.count++; }));
    });
    registry.evt('doubleIncrement', ({ dispatch }) => {
      dispatch('increment');
      dispatch('increment');
    });

    const { useSub, useEvent, StoreProvider } = createStore<DState, DSubs, DEvents>({
      slices: [() => ({ count: 0 })],
      registry,
    });

    function Display() {
      const count = useSub('count');
      const dispatch = useEvent('doubleIncrement');
      return (
        <>
          <div data-testid="count">{count}</div>
          <button onClick={() => dispatch(undefined as any)}>go</button>
        </>
      );
    }

    render(
      <StoreProvider>
        <Suspense fallback={null}><Display /></Suspense>
      </StoreProvider>
    );

    fireEvent.click(screen.getByText('go'));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('event handler invalidates async subscription', async () => {
    type ISubs = { data: Sub<void, string> };
    type IEvents = { refresh: Evt<void> };
    type IState = {};

    let callCount = 0;
    const registry = createRegistry<IState, ISubs, IEvents>();
    registry.asyncSub('data', async () => {
      callCount++;
      return `call-${callCount}`;
    });
    registry.evt('refresh', async ({ invalidateAsyncSub }) => {
      await invalidateAsyncSub(['data', undefined]);
    });

    const { useSub, useEvent, StoreProvider } = createStore<IState, ISubs, IEvents>({
      slices: [],
      registry,
    });

    function Display() {
      const data = useSub('data');
      const dispatch = useEvent('refresh');
      return (
        <>
          <div data-testid="data">{data}</div>
          <button onClick={() => dispatch(undefined as any)}>refresh</button>
        </>
      );
    }

    render(
      <StoreProvider>
        <Suspense fallback={<div>loading</div>}><Display /></Suspense>
      </StoreProvider>
    );

    const el = await screen.findByTestId('data');
    expect(el.textContent).toBe('call-1');

    await act(async () => {
      fireEvent.click(screen.getByText('refresh'));
    });

    await screen.findByText('call-2');
  });

  it('event handler replaces async subscription data', async () => {
    type RSubs = { data: Sub<void, string> };
    type REvents = { replace: Evt<{ value: string }> };
    type RState = {};

    const registry = createRegistry<RState, RSubs, REvents>();
    registry.asyncSub('data', async () => 'original');
    registry.evt('replace', ({ replaceAsyncSub, params }) => {
      replaceAsyncSub(['data', undefined], params.value);
    });

    const { useSub, useEvent, StoreProvider } = createStore<RState, RSubs, REvents>({
      slices: [],
      registry,
    });

    function Display() {
      const data = useSub('data');
      const dispatch = useEvent('replace');
      return (
        <>
          <div data-testid="data">{data}</div>
          <button onClick={() => dispatch({ value: 'replaced' })}>replace</button>
        </>
      );
    }

    render(
      <StoreProvider>
        <Suspense fallback={<div>loading</div>}><Display /></Suspense>
      </StoreProvider>
    );

    const el = await screen.findByTestId('data');
    expect(el.textContent).toBe('original');

    fireEvent.click(screen.getByText('replace'));

    await screen.findByText('replaced');
  });
});

// --- useBoundEvent ---

describe('useBoundEvent', () => {
  it('returns callback that dispatches with bound params', () => {
    const { useSub, useBoundEvent, StoreProvider } = createTestStore();

    function Display() {
      const count = useSub('count');
      const invoke = useBoundEvent('setCount', { value: 99 });
      return (
        <>
          <div data-testid="count">{count}</div>
          <button onClick={invoke}>go</button>
        </>
      );
    }

    render(<Display />, { wrapper: createWrapper(StoreProvider) });
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByTestId('count').textContent).toBe('99');
  });
});

// --- Provider scoping ---

describe('provider scoping', () => {
  it('two providers maintain isolated state', () => {
    const { useSub, useEvent, StoreProvider } = createTestStore();

    function Display({ label }: { label: string }) {
      const count = useSub('count');
      const dispatch = useEvent('setCount');
      return (
        <>
          <div data-testid={`count-${label}`}>{count}</div>
          <button onClick={() => dispatch({ value: label === 'a' ? 1 : 2 })}>set-{label}</button>
        </>
      );
    }

    render(
      <>
        <StoreProvider>
          <Suspense fallback={null}><Display label="a" /></Suspense>
        </StoreProvider>
        <StoreProvider>
          <Suspense fallback={null}><Display label="b" /></Suspense>
        </StoreProvider>
      </>
    );

    fireEvent.click(screen.getByText('set-a'));
    fireEvent.click(screen.getByText('set-b'));

    expect(screen.getByTestId('count-a').textContent).toBe('1');
    expect(screen.getByTestId('count-b').textContent).toBe('2');
  });
});

// --- suspensify ---

describe('suspensify', () => {
  it('wraps component in Suspense boundary', async () => {
    type SSubs = { data: Sub<void, string> };
    type SEvents = Record<string, never>;
    type SState = {};

    const registry = createRegistry<SState, SSubs, SEvents>();
    registry.asyncSub('data', async () => 'resolved-value');

    const { useSub, StoreProvider } = createStore<SState, SSubs, SEvents>({
      slices: [],
      registry,
    });

    function Inner() {
      const data = useSub('data');
      return <div data-testid="data">{data}</div>;
    }

    const Wrapped = suspensify(Inner);

    render(
      <StoreProvider>
        <Wrapped fallback={<div>suspense-loading</div>} />
      </StoreProvider>
    );

    expect(screen.getByText('suspense-loading')).toBeDefined();
    const el = await screen.findByTestId('data');
    expect(el.textContent).toBe('resolved-value');
  });
});
