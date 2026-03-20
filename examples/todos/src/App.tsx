import { Suspense, type FormEvent } from 'react';
import { StoreProvider, useEvent, useSub } from './store';
import './styles.css';

function TipCard() {
  const tip = useSub('todo.tip/text');
  const refresh = useEvent('todo.tip/refresh');

  return (
    <section className="tip-card">
      <div>
        <p className="eyebrow">Async subscription</p>
        <h2>Fresh tip</h2>
      </div>
      <p className="tip-text">{tip}</p>
      <button className="ghost-button" onClick={() => refresh({})} type="button">
        Refresh tip
      </button>
    </section>
  );
}

function Todos() {
  const todos = useSub('todo.list/items');
  const stats = useSub('todo.list/stats');
  const draft = useSub('todo.draft/value');
  const filter = useSub('todo.filter/value');
  const setDraft = useEvent('todo.draft/set');
  const addTodo = useEvent('todo/create');
  const toggleTodo = useEvent('todo/toggle');
  const removeTodo = useEvent('todo/delete');
  const setFilter = useEvent('todo.filter/set');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    addTodo({});
  };

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Interphase example</p>
        <h1>Todo state with sync and async subscriptions</h1>
        <p className="hero-copy">
          Local state lives in slices, derived reads are subscriptions, and UI actions dispatch
          typed events. The tip panel is an async subscription backed by TanStack Query suspense.
        </p>
      </section>

      <section className="panel composer-panel">
        <form className="composer" onSubmit={submit}>
          <label className="composer-label" htmlFor="todo-input">
            Add a task
          </label>
          <div className="composer-row">
            <input
              id="todo-input"
              className="composer-input"
              onChange={(event) => setDraft({ value: event.target.value })}
              placeholder="Write the next useful thing"
              value={draft}
            />
            <button className="primary-button" type="submit">
              Add
            </button>
          </div>
        </form>

        <div className="stats">
          <div>
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">total</span>
          </div>
          <div>
            <span className="stat-value">{stats.remaining}</span>
            <span className="stat-label">left</span>
          </div>
          <div>
            <span className="stat-value">{stats.done}</span>
            <span className="stat-label">done</span>
          </div>
        </div>
      </section>

      <section className="panel filters">
        {(['all', 'active', 'done'] as const).map((value) => (
          <button
            key={value}
            className={filter === value ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setFilter({ value })}
            type="button"
          >
            {value}
          </button>
        ))}
      </section>

      <section className="grid">
        <section className="panel list-panel">
          <div className="list-header">
            <h2>Tasks</h2>
            <span>{todos.length} visible</span>
          </div>

          <ul className="todo-list">
            {todos.map((todo) => (
              <li className="todo-card" key={todo.id}>
                <button
                  aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
                  className={todo.done ? 'toggle done' : 'toggle'}
                  onClick={() => toggleTodo({ id: todo.id })}
                  type="button"
                />
                <span className={todo.done ? 'todo-text done' : 'todo-text'}>{todo.text}</span>
                <button
                  className="remove-button"
                  onClick={() => removeTodo({ id: todo.id })}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <Suspense fallback={<section className="tip-card loading">Loading tip...</section>}>
          <TipCard />
        </Suspense>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Todos />
    </StoreProvider>
  );
}
