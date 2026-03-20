import type { StoreApi } from 'zustand';

export type Sub<Params, Result> = { params: Params; result: Result };
export type Evt<Params> = { params: Params };

export type StoreSubs = Record<string, Sub<any, any>>;
export type StoreEvents = Record<string, Evt<any>>;

export type Slice<State> = () => Partial<State>;

export type Read<Subs extends StoreSubs> = <T extends keyof Subs>(
  id: T,
  params?: Subs[T]['params']
) => Subs[T]['result'];

export type Dispatch<Events extends StoreEvents> = <T extends keyof Events>(
  id: T,
  params?: Events[T]['params']
) => void | Promise<void>;

export type ValueHook<Subs extends StoreSubs> = <T extends keyof Subs>(
  id: T,
  params?: Subs[T]['params']
) => Subs[T]['result'];

export type DispatchHook<Events extends StoreEvents> = <T extends keyof Events>(
  id: T
) => (params: Events[T]['params']) => void | Promise<void>;

export type InvokeHook<Events extends StoreEvents> = <T extends keyof Events>(
  id: T,
  params: Events[T]['params']
) => () => void | Promise<void>;

export type InvalidateAsyncSub<Subs extends StoreSubs> = <T extends keyof Subs>(
  sub: [id: T, params: Subs[T]['params'] | undefined]
) => Promise<void>;

export type InvalidateAsyncSubs<Subs extends StoreSubs> = <T extends keyof Subs>(
  subs: [id: T, params: Subs[T]['params'] | undefined][]
) => Promise<void>;

export type ReplaceAsyncSub<Subs extends StoreSubs> = <T extends keyof Subs>(
  sub: [id: T, params: Subs[T]['params'] | undefined],
  updater: Subs[T]['result'] | ((old: Subs[T]['result']) => Subs[T]['result'])
) => void;

export type ReplaceAsyncSubs<Subs extends StoreSubs> = <T extends keyof Subs>(
  subs: [
    sub: [id: T, params: Subs[T]['params'] | undefined],
    updater: Subs[T]['result'] | ((old: Subs[T]['result']) => Subs[T]['result']),
  ][]
) => void;

export type SubscriptionArgs<State, Subs extends StoreSubs, T extends keyof Subs> = {
  state: State;
  params: Subs[T]['params'];
};

export type SubscriptionResolver<State, Subs extends StoreSubs, T extends keyof Subs> = (
  args: SubscriptionArgs<State, Subs, T>
) => Subs[T]['result'] | Promise<Subs[T]['result']>;

export type EventHandlerArgs<
  State,
  Subs extends StoreSubs,
  Events extends StoreEvents,
  T extends keyof Events,
> = {
  setState: (updater: State | Partial<State> | ((draft: State) => void)) => void;
  getState: StoreApi<State>['getState'];
  read: Read<Subs>;
  params: Events[T]['params'];
  dispatch: Dispatch<Events>;
  invalidateAsyncSub: InvalidateAsyncSub<Subs>;
  invalidateAsyncSubs: InvalidateAsyncSubs<Subs>;
  replaceAsyncSub: ReplaceAsyncSub<Subs>;
  replaceAsyncSubs: ReplaceAsyncSubs<Subs>;
};

export type EventHandler<
  State,
  Subs extends StoreSubs,
  Events extends StoreEvents,
  T extends keyof Events,
> = (args: EventHandlerArgs<State, Subs, Events, T>) => void | Promise<void>;
