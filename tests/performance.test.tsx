import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { createTestStore, createWrapper } from './helpers';

// --- Selective re-rendering ---

describe('selective re-rendering', () => {
  it('does not re-render when unsubscribed state changes', () => {
    const { useValue, useDispatch, StoreProvider } = createTestStore();

    function CountDisplay() {
      const renderCount = useRef(0);
      renderCount.current++;
      const count = useValue('count');
      return <div data-testid="count" data-renders={renderCount.current}>{count}</div>;
    }

    function LabelDisplay() {
      const renderCount = useRef(0);
      renderCount.current++;
      const label = useValue('labelUpper');
      return <div data-testid="label" data-renders={renderCount.current}>{label}</div>;
    }

    function Controls() {
      const setCount = useDispatch('setCount');
      const setLabel = useDispatch('setLabel');
      return (
        <>
          <button onClick={() => setCount({ value: 5 })}>set-count</button>
          <button onClick={() => setLabel({ value: 'world' })}>set-label</button>
        </>
      );
    }

    render(
      <>
        <CountDisplay />
        <LabelDisplay />
        <Controls />
      </>,
      { wrapper: createWrapper(StoreProvider) },
    );

    const countEl = screen.getByTestId('count');
    const labelEl = screen.getByTestId('label');

    const countRendersBeforeLabel = Number(countEl.getAttribute('data-renders'));

    fireEvent.click(screen.getByText('set-label'));

    const countRendersAfterLabel = Number(countEl.getAttribute('data-renders'));
    expect(countRendersAfterLabel).toBe(countRendersBeforeLabel);

    const labelRendersBeforeCount = Number(labelEl.getAttribute('data-renders'));

    fireEvent.click(screen.getByText('set-count'));

    const labelRendersAfterCount = Number(labelEl.getAttribute('data-renders'));
    expect(labelRendersAfterCount).toBe(labelRendersBeforeCount);
  });
});

// --- Hook reference stability ---

describe('hook reference stability', () => {
  it('useDispatch returns stable reference across re-renders', () => {
    const { useDispatch, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [, setTick] = useState(0);
      const dispatch = useDispatch('setCount');
      refs.push(dispatch);
      return <button onClick={() => setTick((t) => t + 1)}>rerender</button>;
    }

    render(<Track />, { wrapper: createWrapper(StoreProvider) });

    fireEvent.click(screen.getByText('rerender'));
    fireEvent.click(screen.getByText('rerender'));

    expect(refs.length).toBe(3);
    expect(refs[0]).toBe(refs[1]);
    expect(refs[1]).toBe(refs[2]);
  });

  it('useInvoke returns stable reference for structurally equal params', () => {
    const { useInvoke, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [, setTick] = useState(0);
      const invoke = useInvoke('setCount', { value: 1 });
      refs.push(invoke);
      return <button onClick={() => setTick((t) => t + 1)}>rerender</button>;
    }

    render(<Track />, { wrapper: createWrapper(StoreProvider) });

    fireEvent.click(screen.getByText('rerender'));
    fireEvent.click(screen.getByText('rerender'));

    expect(refs.length).toBe(3);
    expect(refs[0]).toBe(refs[1]);
    expect(refs[1]).toBe(refs[2]);
  });

  it('useInvoke is stable with different key order', () => {
    const { useInvoke, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [tick, setTick] = useState(0);
      const params = tick % 2 === 0
        ? { count: 1, label: 'x' }
        : { label: 'x', count: 1 };
      const invoke = useInvoke('setBoth', params);
      refs.push(invoke);
      return <button onClick={() => setTick((t) => t + 1)}>rerender</button>;
    }

    render(<Track />, { wrapper: createWrapper(StoreProvider) });

    fireEvent.click(screen.getByText('rerender'));

    expect(refs.length).toBe(2);
    expect(refs[0]).toBe(refs[1]);
  });

  it('useInvoke returns new reference when params change', () => {
    const { useInvoke, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [tick, setTick] = useState(1);
      const invoke = useInvoke('setCount', { value: tick });
      refs.push(invoke);
      return <button onClick={() => setTick((t) => t + 1)}>rerender</button>;
    }

    render(<Track />, { wrapper: createWrapper(StoreProvider) });

    fireEvent.click(screen.getByText('rerender'));

    expect(refs.length).toBe(2);
    expect(refs[0]).not.toBe(refs[1]);
  });
});

// --- useShallow stability ---

describe('useShallow selector stability', () => {
  it('sync sub returning object does not re-render when result is structurally equal', () => {
    const { useValue, useDispatch, StoreProvider } = createTestStore();

    function StatsDisplay() {
      const renderCount = useRef(0);
      renderCount.current++;
      const stats = useValue('stats');
      return <div data-testid="stats" data-renders={renderCount.current}>{stats.count},{stats.label}</div>;
    }

    function Controls() {
      const setBoth = useDispatch('setBoth');
      return <button onClick={() => setBoth({ count: 0, label: 'hello' })}>set-same</button>;
    }

    render(
      <>
        <StatsDisplay />
        <Controls />
      </>,
      { wrapper: createWrapper(StoreProvider) },
    );

    const el = screen.getByTestId('stats');
    expect(el.textContent).toBe('0,hello');
    const rendersBefore = Number(el.getAttribute('data-renders'));

    fireEvent.click(screen.getByText('set-same'));

    const rendersAfter = Number(el.getAttribute('data-renders'));
    expect(rendersAfter).toBe(rendersBefore);
  });
});
