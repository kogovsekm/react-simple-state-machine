# react-simple-state-machine

🧵 A tiny React hook for simple finite state machines.

The name Wyrd comes from Norse mythology, where it represents the weaving of fate, a fitting metaphor for defining states and deterministic transitions in the app.

## Installation

Install from npm:

```bash
npm install react-simple-state-machine
```

Peer dependency: `react` (>=17).

## Quick usage

```ts
import { useWyrdMachine } from 'react-simple-state-machine'

const machine = {
	initial: 'idle',
	states: {
		idle: { on: { START: 'working' } },
		working: { on: { DONE: 'idle' } }
	}
}

function Component(){
	const [state, send] = useWyrdMachine(machine)
	return <button onClick={()=>send('START')}>Start</button>
}
```

## API

### `useWyrdMachine<T, E>(config: WyrdMachineConfig<T, E>)`

Returns `[state, send, reset]`:

- **`state: { value: T, nextEvents: Array<string> }`** — Current state value and available transitions.
- **`send<K extends keyof E>(event: K, payload?: E[K]): boolean`** — Trigger an event and transition. Returns true if the transition succeeded, false otherwise. Can be called with a payload that is forwarded to function-based transition handlers.
- **`send.async<K extends keyof E>(event: K, payload?: E[K]): Promise<boolean>`** — Async variant that safely awaits promise-returning transition handlers.
- **`reset(to?: T): boolean`** — Reset to the initial state or a named state. Runs cleanup synchronously before transitioning, and returns `false` if the target state does not exist in the machine.

### Configuration

```ts
type WyrdMachineConfig<T, E> = {
  initial: T;                      // initial state name
  states: {
    [stateName]: {
      on?: {
        [eventName]: T | ((payload) => T | undefined)  // string target or function handler
      },
      effect?: () => (() => void) | undefined          // run on enter, return optional cleanup
    }
  }
}
```

**Key features:**
- **Function transitions** receive the event payload and return the next state (or `undefined` to cancel).
- **Effects** run when entering a state; if they return a cleanup function, it runs on exit.
- **Named resets** let you jump to any state directly via `reset("stateName")`.

## Building & development

```bash
npm install
npm run build        # build types + bundles
npm run dev          # run example (Vite)
npm test
npm run typecheck    # type-check example and tests
```

## Publish readiness

Current package metadata is configured for:

- GitHub repository: `https://github.com/kogovsekm/react-simple-state-machine`
- npm package name: `react-simple-state-machine`
- Entrypoints:
  - CommonJS: `dist/bundle.cjs.js`
  - ESM: `dist/bundle.esm.js`
  - Types: `dist/index.d.ts`

Before publishing, run:

```bash
npm run build
npm pack --dry-run
```

## Examples

To test the state machine locally and see it in action, start the interactive example:

```bash
cd example
npm install
npm run dev
```

This launches a Vite dev server (dark-mode UI with Tailwind) showcasing two demos.

### Example 1: Function transitions with payload and effects

**Flow:** `idle` → `ready` → `processing` → `complete`

Demonstrates:
- **Function-based transition handler:** `SUBMIT_SIGNAL(payload: { strength: number })` validates the payload and returns the next state or `undefined` to cancel the transition.
- **State effects:** Each state logs when it is entered and exited (lifecycle hooks).
- **Payload handling:** A slider lets you adjust the signal strength; the handler only transitions if strength >= 60.
- **Named state reset:** `reset("ready")` jumps directly to the ready state instead of always starting from idle.

**Try this sequence in the demo:**
1. Click PREPARE to enter the ready state.
2. Slide the signal strength below 60 and click SUBMIT_SIGNAL — transition is cancelled.
3. Slide above 60 and click SUBMIT_SIGNAL — state machine moves to processing.
4. Click MARK_COMPLETE to finalize, then REOPEN to return to ready.
5. Open the browser console to see the effect logs for each state transition.

### Example 2: Async transitions with send.async

**Flow:** `standby` → `requesting` → `success` or `failed`

Demonstrates:
- **Async transition handler:** `BEGIN_SEQUENCE(payload: { delayMs: number })` is an async function that delays before transitioning (simulating a request). Use `send.async()` to await it.
- **Multiple outcomes:** From requesting, you can RESOLVE → success, REJECT → failed, or ABORT → standby.
- **Retry pattern:** Both success and failed states offer RETRY, which loops back to standby.
- **Effect cleanup:** Each state logs its lifecycle; open the console to see entry/exit patterns across async boundaries.

**Try this sequence in the demo:**
1. Adjust the delay slider (200–2000ms).
2. Click `send.async(BEGIN_SEQUENCE)` — the button awaits the async handler and then the machine enters requesting.
3. The demo auto-generates a random outcome (60% RESOLVE, 40% REJECT) after a delay.
4. Click RETRY to go back to standby, then try another sequence.
5. Open the browser console to trace state entry/exit and async handler execution.

## Advanced Pattern: Conditional branching with function transitions

Function handlers can evaluate conditions and return different target states, enabling flexible branching logic. Here's an excerpt from Example 1 that showcases this pattern in a real component:

```ts
const [stateObj, send] = useWyrdMachine({
  initial: "idle",
  states: {
    idle: { on: { PREPARE: "ready" } },
    ready: {
      on: {
        // Function handler that evaluates payload and branches to different states
        SUBMIT_SIGNAL: (payload) => {
          console.log("[machine] SUBMIT_SIGNAL payload:", payload);
          if (!payload || payload.strength < 60) {
            console.log("[machine] signal below threshold, transition cancelled");
            return undefined;  // Cancel the transition
          }
          return "processing";  // Or return a different state based on other conditions
        },
        CANCEL: "idle",
      },
    },
    processing: {
      on: { MARK_COMPLETE: "complete", CANCEL: "idle" },
      effect: () => {
        // This runs when entering the processing state
        console.log("[effect] Processing started");
        
        // Return an optional cleanup function that runs when exiting this state
        return () => {
          console.log("[effect] Processing cleanup on exit");
        };
      },
    },
    complete: {
      on: { REOPEN: "ready" },
      effect: () => {
        console.log("[effect] Completed!");
        return undefined;  // No cleanup needed
      },
    },
  },
});

// Call with a payload that gets forwarded to the handler
send("SUBMIT_SIGNAL", { strength: 75 });  // transitions to processing
send("SUBMIT_SIGNAL", { strength: 40 });  // transition cancelled (returns undefined)
```

**Key takeaway:** Instead of a static string target, use function handlers to:
- Validate the incoming payload
- Conditionally branch to different states
- Cancel transitions by returning `undefined`
- Execute side effects before transitioning
- Log or track state changes

**Effects pattern:** Each state can declare an `effect()` that:
- Runs synchronously when entering the state
- Returns an optional cleanup function for graceful teardown
- Cleanup runs when exiting the state (before the next state's effect runs)
- Useful for logging, subscriptions, side effect orchestration, or lifecycle management

This is especially powerful when combined with function handlers for orchestrating complex workflows.


## Bundles

This package publishes TypeScript declarations and also builds UMD/CJS/ESM bundles using Rollup (see `rollup.config.js`).

## Contributing

See `CONTRIBUTING.md` for contribution guidelines.

## License

MIT
