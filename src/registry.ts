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

export type Registry<Subs extends StoreSubs, Events extends StoreEvents> = {
  subscriptions: Partial<Record<keyof Subs, RegisteredSubscription>>;
  events: Partial<Record<keyof Events, RegisteredEvent>>;
  sub: <T extends keyof Subs>(id: T, fn: SubscriptionResolver<Subs, T>) => void;
  asyncSub: <T extends keyof Subs>(id: T, fn: SubscriptionResolver<Subs, T>) => void;
  evt: <T extends keyof Events>(id: T, fn: EventHandler<Subs, Events, T>) => void;
};

export function createRegistry<
  Subs extends StoreSubs,
  Events extends StoreEvents,
>(): Registry<Subs, Events> {
  const subscriptions: Registry<Subs, Events>['subscriptions'] = {};
  const events: Registry<Subs, Events>['events'] = {};

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
