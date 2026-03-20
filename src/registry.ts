import type {
  EventHandler,
  StoreEvents,
  StoreSubs,
  SubscriptionResolver,
} from './types';

export type RegisteredSubscription = {
  fn: (args: { state: any; params: any }) => unknown | Promise<unknown>;
  async: boolean;
};

export type RegisteredEvent = {
  fn: (args: any) => void | Promise<void>;
};

export type Registry<State, Subs extends StoreSubs, Events extends StoreEvents> = {
  subscriptions: Partial<Record<keyof Subs, RegisteredSubscription>>;
  events: Partial<Record<keyof Events, RegisteredEvent>>;
  sub: <T extends keyof Subs>(id: T, fn: SubscriptionResolver<State, Subs, T>) => void;
  asyncSub: <T extends keyof Subs>(id: T, fn: SubscriptionResolver<State, Subs, T>) => void;
  evt: <T extends keyof Events>(id: T, fn: EventHandler<State, Subs, Events, T>) => void;
};

export function createRegistry<
  State,
  Subs extends StoreSubs,
  Events extends StoreEvents,
>(): Registry<State, Subs, Events> {
  const subscriptions: Registry<State, Subs, Events>['subscriptions'] = {};
  const events: Registry<State, Subs, Events>['events'] = {};

  return {
    subscriptions,
    events,
    sub(id, fn) {
      subscriptions[id] = { fn, async: false };
    },
    asyncSub(id, fn) {
      subscriptions[id] = { fn, async: true };
    },
    evt(id, fn) {
      events[id] = { fn };
    },
  };
}
