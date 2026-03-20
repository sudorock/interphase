import { render, screen, fireEvent, act } from '@testing-library/react';
import { Suspense, useRef, useState } from 'react';
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
      const [tick, setTick] = useState(0);
      // New object identity each render, but structurally equal
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
      // Alternate key order each render
      const params = tick % 2 === 0 ? { value: 1 } : { value: 1 };
      const invoke = useInvoke('setCount', params);
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

    function Display() {
      const renderCount = useRef(0);
      renderCount.current++;
      const count = useValue('count');
      return <div data-testid="count" data-renders={renderCount.current}>{count}</div>;
    }

    function Controls() {
      const setLabel = useDispatch('setLabel');
      return <button onClick={() => setLabel({ value: 'changed' })}>change-label</button>;
    }

    render(
      <>
        <Display />
        <Controls />
      </>,
      { wrapper: createWrapper(StoreProvider) },
    );

    const el = screen.getByTestId('count');
    const rendersBefore = Number(el.getAttribute('data-renders'));

    fireEvent.click(screen.getByText('change-label'));

    const rendersAfter = Number(el.getAttribute('data-renders'));
    expect(rendersAfter).toBe(rendersBefore);
  });
});
