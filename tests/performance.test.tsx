import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { createTestStore, createWrapper } from './helpers';

// --- Selective re-rendering ---

describe('selective re-rendering', () => {
  it('does not re-render when unsubscribed state changes', () => {
    const { useSub, useEvent, StoreProvider } = createTestStore();

    function CountDisplay() {
      const renderCount = useRef(0);
      renderCount.current++;
      const count = useSub('count');
      return <div data-testid="count" data-renders={renderCount.current}>{count}</div>;
    }

    function LabelDisplay() {
      const renderCount = useRef(0);
      renderCount.current++;
      const label = useSub('labelUpper');
      return <div data-testid="label" data-renders={renderCount.current}>{label}</div>;
    }

    function Controls() {
      const setCount = useEvent('setCount');
      const setLabel = useEvent('setLabel');
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
  it('useEvent returns stable reference across re-renders', () => {
    const { useEvent, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [, setTick] = useState(0);
      const dispatch = useEvent('setCount');
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

  it('useBoundEvent returns stable reference for structurally equal params', () => {
    const { useBoundEvent, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [, setTick] = useState(0);
      const invoke = useBoundEvent('setCount', { value: 1 });
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

  it('useBoundEvent is stable with different key order', () => {
    const { useBoundEvent, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [tick, setTick] = useState(0);
      const params = tick % 2 === 0
        ? { count: 1, label: 'x' }
        : { label: 'x', count: 1 };
      const invoke = useBoundEvent('setBoth', params);
      refs.push(invoke);
      return <button onClick={() => setTick((t) => t + 1)}>rerender</button>;
    }

    render(<Track />, { wrapper: createWrapper(StoreProvider) });

    fireEvent.click(screen.getByText('rerender'));

    expect(refs.length).toBe(2);
    expect(refs[0]).toBe(refs[1]);
  });

  it('useBoundEvent returns new reference when params change', () => {
    const { useBoundEvent, StoreProvider } = createTestStore();
    const refs: Function[] = [];

    function Track() {
      const [tick, setTick] = useState(1);
      const invoke = useBoundEvent('setCount', { value: tick });
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
    const { useSub, useEvent, StoreProvider } = createTestStore();

    function StatsDisplay() {
      const renderCount = useRef(0);
      renderCount.current++;
      const stats = useSub('stats');
      return <div data-testid="stats" data-renders={renderCount.current}>{stats.count},{stats.label}</div>;
    }

    function Controls() {
      const toggleFlag = useEvent('toggleFlag');
      return <button onClick={() => toggleFlag(undefined as any)}>toggle-flag</button>;
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

    fireEvent.click(screen.getByText('toggle-flag'));

    const rendersAfter = Number(el.getAttribute('data-renders'));
    expect(rendersAfter).toBe(rendersBefore);
  });
});
