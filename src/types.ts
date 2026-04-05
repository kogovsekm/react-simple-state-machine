/**
 * Represents a value that may or may not be wrapped in a Promise.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * A transition handler function that takes optional payload and returns
 * either a next state or undefined to cancel the transition.
 * Can be synchronous or asynchronous.
 */
export type TransitionHandler<T extends string, P = unknown> = (
  payload: P | undefined,
) => MaybePromise<T | undefined>;

/**
 * Configuration for a single state node in the state machine.
 */
export type StateNodeConfig<
  T extends string,
  E extends Record<string, unknown>,
> = {
  /**
   * Transition can be a target state (string) or a function that runs side-effects and
   *  returns the next state (or `undefined` to cancel the transition)
   */
  on?: Partial<{ [K in keyof E]: T | TransitionHandler<T, E[K]> }> &
    Record<string, T | TransitionHandler<T, unknown>>;
  effect?: () => (() => void) | undefined;
};

/**
 * Utility type to extract event keys from state configuration.
 * Used internally for type inference.
 */
export type ExtractEventKeysFromStates<S> =
  S extends Record<string, infer N>
    ? N extends { on?: infer O }
      ? keyof NonNullable<O>
      : never
    : never;

/**
 * Utility type to infer event map from state objects.
 * Used internally for type inference.
 */
export type InferredEventsFromStates<S> = Record<
  ExtractEventKeysFromStates<S> & string,
  unknown
>;

/**
 * State machine configuration type.
 * Defines the initial state and all state nodes with their transitions and effects.
 */
export type StateMachineConfig<
  T extends string,
  E extends Record<string, unknown> = Record<string, unknown>,
> = {
  initial: T;
  states: Record<T, StateNodeConfig<T, E>>;
};

/**
 * Public state shape returned by the useStateMachine hook.
 */
export type StateMachineState<T extends string> = {
  value: T;
  nextEvents: Array<string>;
};

/**
 * Public shape of the `send` function returned by `useStateMachine`.
 *
 * `send(event, payload)` handles synchronous transitions.
 * `send.async(event, payload)` handles promise-returning transition handlers.
 */
export type SendFunction<E extends Record<string, unknown>> = {
  <K extends Extract<keyof E, string>>(event: K, payload?: E[K]): boolean;
  async<K extends Extract<keyof E, string>>(
    event: K,
    payload?: E[K],
  ): Promise<boolean>;
};
