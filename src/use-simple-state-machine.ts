import { useMemo, useRef, useState } from "react";

export type {
  MaybePromise,
  SendFunction,
  StateNodeConfig,
  TransitionHandler,
  WyrdMachineConfig,
  WyrdMachineState,
} from "./types";

import type {
  InferredEventsFromStates,
  SendFunction,
  StateNodeConfig,
  TransitionHandler,
  WyrdMachineConfig,
  WyrdMachineState,
} from "./types";

// Overload 1: explicit state and event map provided
export function useWyrdMachine<
  T extends string,
  E extends Record<string, unknown>,
>(
  config: WyrdMachineConfig<T, E>,
): [WyrdMachineState<T>, SendFunction<E>, (to?: T) => boolean];

// Overload 1b: explicit state union `T` provided but events should be
// inferred from the passed config's `states` mapping. This covers calls
// like `useWyrdMachine<PaymentStatus>(machineConfig)` where the user
// specifies the state type but expects the event keys to be inferred
// from the `states` object. We avoid `any` by using `Record<string, unknown>`.
export function useWyrdMachine<
  T extends string,
  C extends WyrdMachineConfig<T, Record<string, unknown>>,
>(
  config: C,
): [
  WyrdMachineState<T>,
  SendFunction<InferredEventsFromStates<C["states"]>>,
  (to?: T) => boolean,
];

/**
 * useWyrdMachine will infer the state union `T` and event map `E` from the passed config's `states` mapping.
 *
 * @param config
 */
export function useWyrdMachine<C extends { states: Record<string, unknown> }>(
  config: C,
): [
  WyrdMachineState<Extract<keyof C["states"], string>>,
  SendFunction<InferredEventsFromStates<C["states"]>>,
  (to?: Extract<keyof C["states"], string>) => boolean,
];

export function useWyrdMachine<
  T extends string,
  E extends Record<string, unknown> = Record<string, unknown>,
>(
  config: WyrdMachineConfig<T, E>,
): [WyrdMachineState<T>, SendFunction<E>, (to?: T) => boolean] {
  const { initial, states } = config;
  const [current, setCurrent] = useState<T>(initial);

  /**
   * Store latest cleanup so we can run it when leaving a state.
   */
  const cleanupRef = useRef<null | (() => void)>(null);

  /**
   * Ref to keep track of the current state value.
   */
  const currentStateRef = useRef<T>(initial);

  /**
   * Compute nextEvents for current state.
   */
  const nextEvents = useMemo(() => {
    const node = states[current];
    return node && node.on ? Object.keys(node.on) : [];
  }, [current, states]);

  /**
   * Helper to run the effect for a state node synchronously and store its cleanup.
   * Effects are invoked directly from `send` / `reset` for imperative semantics.
   */
  const runNodeEffect = (node?: StateNodeConfig<T, E>) => {
    if (!node || typeof node.effect !== "function") {
      cleanupRef.current = null;
      return;
    }

    const maybeCleanup = node.effect();
    if (typeof maybeCleanup === "function") {
      cleanupRef.current = maybeCleanup;
      return;
    }

    cleanupRef.current = null;
  };

  /**
   * Async transition API used by `send.async(...)`.
   * Supports both string targets and async function handlers.
   */
  const sendAsync = async <K extends Extract<keyof E, string>>(
    event: K,
    payload?: E[K],
  ) => {
    const node = states[currentStateRef.current];
    if (!node || !node.on) {
      return false;
    }

    const handlerOrTarget = node.on[event as string];
    if (!handlerOrTarget) {
      return false;
    }

    let next: T | undefined;

    if (typeof handlerOrTarget === "function") {
      try {
        next = await (handlerOrTarget as TransitionHandler<T, E[K]>)(payload);
      } catch (err) {
        console.error(
          'Error in async transition handler for event "',
          event,
          '" from state "',
          currentStateRef.current,
          '":',
          err,
        );
        return false;
      }
    } else {
      next = handlerOrTarget as T;
    }

    if (!next) {
      return false;
    }

    if (!(next in states)) {
      return false;
    }

    if (next === currentStateRef.current) {
      return true;
    }

    try {
      cleanupRef.current?.();
    } finally {
      cleanupRef.current = null;
    }

    setCurrent(next as T);
    currentStateRef.current = next as T;
    runNodeEffect(states[next as T]);
    return true;
  };

  const send = (<K extends Extract<keyof E, string>>(
    event: K,
    payload?: E[K],
  ) => {
    const node = states[currentStateRef.current];
    if (!node || !node.on) {
      return false;
    }

    const handlerOrTarget = node.on[event as string];

    if (!handlerOrTarget) {
      return false;
    }

    try {
      if (typeof handlerOrTarget === "function") {
        const result = (handlerOrTarget as TransitionHandler<T, E[K]>)(payload);

        /**
         * CRITICAL: If handler returned a promise, we do NOT handle it here.
         * Returning true for an async operation creates false positive semantics:
         * - Caller thinks the transition succeeded immediately
         * - But it actually succeeds later in the background
         * - This can lead to race conditions and out-of-order transitions
         *
         * Return false to signal that this handler is async and send() cannot
         * handle it. Caller must use send.async() instead.
         */
        if (
          result &&
          typeof (result as Promise<T | undefined>).then === "function"
        ) {
          console.error(
            'Async transition handler detected for event "',
            event,
            '" in synchronous send(). Use send.async() instead to handle promises properly.',
          );
          return false;
        }

        const next = result as T | undefined;
        if (!next) {
          return false;
        }
        if (!(next in states)) {
          return false;
        }
        if (next === currentStateRef.current) {
          return true;
        }

        try {
          cleanupRef.current?.();
        } finally {
          cleanupRef.current = null;
        }

        setCurrent(next as T);
        currentStateRef.current = next as T;
        runNodeEffect(states[next as T]);
        return true;
      }

      // handlerOrTarget is a string target
      const next = handlerOrTarget as T;

      // guard against an empty target
      if (!next) {
        return false;
      }

      // sanity check for target state existence in the machine config
      if (!(next in states)) {
        return false;
      }

      // if next state is same as current, we can skip running effects and cleanup
      if (next === currentStateRef.current) {
        return true;
      }

      // run cleanup of current state synchronously before transitioning
      try {
        cleanupRef.current?.();
      } finally {
        cleanupRef.current = null;
      }

      setCurrent(next as T);
      currentStateRef.current = next as T;
      runNodeEffect(states[next as T]);
      return true;
    } catch (err) {
      console.error("Error in transition handler for event", event, err);
      return false;
    }
  }) as SendFunction<E>;

  /**
   * Attach async variant to send so callers can perform the `await send.async(...)` for example.
   *
   * INFO: it is best to keep the state machine synchronous by default for simplicity and only use the async version when needed, as it adds some overhead and complexity.
   * This also allows for better control over when to handle promises and when to keep things simple and synchronous.
   */
  send.async = sendAsync;

  /**
   * Reset function that returns the machine to `initial` by default, or to a
   * provided target state.
   *
   * Behavior:
   * - returns `false` when the target state does not exist in the machine
   * - returns `true` after a valid reset and runs cleanup before entering target
   */
  const reset = (to?: T) => {
    const target = (to ?? initial) as T;

    if (!(target in states)) {
      return false;
    }

    try {
      cleanupRef.current?.();
    } finally {
      cleanupRef.current = null;
    }

    setCurrent(target);
    currentStateRef.current = target;
    runNodeEffect(states[target]);
    return true;
  };

  return [
    {
      value: current,
      nextEvents,
    },
    send,
    reset,
  ];
}
