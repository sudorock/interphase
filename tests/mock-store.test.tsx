import { act, fireEvent, render, screen } from '@testing-library/react';
import { Component, type ReactNode, Suspense, useState } from 'react';
import { suspensify } from '../src';
import { createMockStore } from '../src/mock';
import { createTestStore } from './helpers';

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error ? (
      <div data-testid="error">{this.state.error.message}</div>
    ) : (
      this.props.children
    );
  }
}

function setup() {
  const store = createTestStore();
  const { MockStoreProvider } = createMockStore(store);

  function Count() {
    return <div data-testid="count">{store.useSub('count')}</div>;
  }

  function AsyncCount() {
    return <div data-testid="count">{store.useSub('asyncCount')}</div>;
  }

  function SetCount() {
    const dispatch = store.useEvent('setCount');
    return <button onClick={() => dispatch({ value: 1 })}>go</button>;
  }

  return { store, MockStoreProvider, Count, AsyncCount, SetCount };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MockStoreProvider subs', () => {
  it('renders a plain value', () => {
    const { MockStoreProvider, Count } = setup();

    render(
      <MockStoreProvider subs={{ count: 5 }}>
        <Count />
      </MockStoreProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('5');
  });

  it('passes params to a function value', () => {
    const { store, MockStoreProvider } = setup();

    function Display() {
      return <div data-testid="result">{store.useSub('countByFactor', { factor: 3 })}</div>;
    }

    render(
      <MockStoreProvider subs={{ countByFactor: ({ factor }) => factor * 2 }}>
        <Display />
      </MockStoreProvider>
    );

    expect(screen.getByTestId('result').textContent).toBe('6');
  });

  it('pending promise renders the suspense fallback', async () => {
    const { MockStoreProvider, AsyncCount } = setup();
    const Wrapped = suspensify(AsyncCount);

    await act(async () => {
      render(
        <MockStoreProvider subs={{ asyncCount: new Promise<never>(() => {}) }}>
          <Wrapped fallback={<div>loading</div>} />
        </MockStoreProvider>
      );
    });

    expect(screen.getByText('loading')).toBeDefined();
  });

  it('resolved promise renders its value', async () => {
    const { MockStoreProvider, AsyncCount } = setup();

    await act(async () => {
      render(
        <MockStoreProvider subs={{ asyncCount: Promise.resolve(7) }}>
          <Suspense fallback={null}>
            <AsyncCount />
          </Suspense>
        </MockStoreProvider>
      );
    });

    expect(screen.getByTestId('count').textContent).toBe('7');
  });

  it('rejected promise reaches the error boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { MockStoreProvider, AsyncCount } = setup();
    const rejected = Promise.reject(new Error('boom'));
    rejected.catch(() => {});

    await act(async () => {
      render(
        <MockStoreProvider subs={{ asyncCount: rejected }}>
          <Boundary>
            <Suspense fallback={null}>
              <AsyncCount />
            </Suspense>
          </Boundary>
        </MockStoreProvider>
      );
    });

    expect(screen.getByTestId('error').textContent).toBe('boom');
  });

  it('function returning a fresh promise resolves once', async () => {
    const { store, MockStoreProvider } = setup();
    const subs = { asyncCount: () => Promise.resolve(1) };

    function Display() {
      const [, force] = useState(0);
      const count = store.useSub('asyncCount');
      return (
        <>
          <div data-testid="count">{count}</div>
          <button onClick={() => force((n) => n + 1)}>force</button>
        </>
      );
    }
    const Wrapped = suspensify(Display);

    await act(async () => {
      render(
        <MockStoreProvider subs={subs}>
          <Wrapped fallback={<div>loading</div>} />
        </MockStoreProvider>
      );
    });
    expect(screen.getByTestId('count').textContent).toBe('1');

    fireEvent.click(screen.getByText('force'));

    expect(screen.queryByText('loading')).toBeNull();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('throws for an id with no entry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { MockStoreProvider, Count } = setup();

    expect(() =>
      render(
        <MockStoreProvider>
          <Count />
        </MockStoreProvider>
      )
    ).toThrow('no mock sub "count"');
  });
});

describe('MockStoreProvider events', () => {
  it('useEvent calls the handler with params', () => {
    const { MockStoreProvider, SetCount } = setup();
    const setCount = vi.fn();

    render(
      <MockStoreProvider events={{ setCount }}>
        <SetCount />
      </MockStoreProvider>
    );
    fireEvent.click(screen.getByText('go'));

    expect(setCount).toHaveBeenCalledWith({ value: 1 });
  });

  it('useBoundEvent calls the handler with bound params', () => {
    const { store, MockStoreProvider } = setup();
    const setCount = vi.fn();

    function Display() {
      const invoke = store.useBoundEvent('setCount', { value: 9 });
      return <button onClick={invoke}>go</button>;
    }

    render(
      <MockStoreProvider events={{ setCount }}>
        <Display />
      </MockStoreProvider>
    );
    fireEvent.click(screen.getByText('go'));

    expect(setCount).toHaveBeenCalledWith({ value: 9 });
  });

  it('honors new handlers after re-render', () => {
    const { MockStoreProvider, SetCount } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const ui = (setCount: typeof first) => (
      <MockStoreProvider events={{ setCount }}>
        <SetCount />
      </MockStoreProvider>
    );

    const { rerender } = render(ui(first));
    rerender(ui(second));
    fireEvent.click(screen.getByText('go'));

    expect(second).toHaveBeenCalledWith({ value: 1 });
    expect(first).not.toHaveBeenCalled();
  });

  it('throws for an id with no entry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { MockStoreProvider, SetCount } = setup();

    expect(() =>
      render(
        <MockStoreProvider>
          <SetCount />
        </MockStoreProvider>
      )
    ).toThrow('no mock event "setCount"');
  });
});

describe('provider resolution', () => {
  it('renders with no props', () => {
    const { MockStoreProvider } = setup();

    render(
      <MockStoreProvider>
        <div data-testid="child" />
      </MockStoreProvider>
    );

    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('throws outside any provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { Count, SetCount } = setup();

    expect(() => render(<Count />)).toThrow('"useSub" called outside a StoreProvider');
    expect(() => render(<SetCount />)).toThrow('"useEvent" called outside a StoreProvider');
  });

  it('mock nested inside the real provider wins', () => {
    const { store, MockStoreProvider, Count } = setup();

    render(
      <store.StoreProvider>
        <MockStoreProvider subs={{ count: 42 }}>
          <Count />
        </MockStoreProvider>
      </store.StoreProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('42');
  });

  it("mocking one store leaves another store's hooks alone", () => {
    const a = setup();
    const b = setup();

    render(
      <a.store.StoreProvider>
        <b.MockStoreProvider subs={{ count: 99 }}>
          <a.Count />
        </b.MockStoreProvider>
      </a.store.StoreProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
