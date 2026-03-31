import { useState } from "react";
import { useWyrdMachine } from "..";
import type { WyrdMachineConfig } from "..";
import AsyncExample from "./AsyncExample";

type DemoState = "idle" | "ready" | "processing" | "complete";

type DemoEvents = {
  PREPARE: undefined;
  SUBMIT_SIGNAL: { strength: number } | undefined;
  MARK_COMPLETE: undefined;
  CANCEL: undefined;
  REOPEN: undefined;
};

const machine = {
  initial: "idle",
  states: {
    idle: {
      on: { PREPARE: "ready" },
      effect: () => {
        console.log("[machine] entered idle");
        return () => {
          console.log("[machine] leaving idle");
        };
      },
    },
    ready: {
      on: {
        SUBMIT_SIGNAL: (payload) => {
          console.log("[machine] SUBMIT_SIGNAL payload:", payload);
          if (!payload || payload.strength < 60) {
            console.log(
              "[machine] signal below threshold, transition cancelled",
            );
            return undefined;
          }

          return "processing";
        },
        CANCEL: "idle",
      },
      effect: () => {
        console.log("[machine] entered ready");
        return () => {
          console.log("[machine] leaving ready");
        };
      },
    },
    processing: {
      on: {
        MARK_COMPLETE: "complete",
        CANCEL: "idle",
      },
      effect: () => {
        console.log("[machine] entered processing");
        return () => {
          console.log("[machine] leaving processing");
        };
      },
    },
    complete: {
      on: { REOPEN: "ready" },
      effect: () => {
        console.log("[machine] entered complete");
        return () => {
          console.log("[machine] leaving complete");
        };
      },
    },
  },
} as WyrdMachineConfig<DemoState, DemoEvents>;

export default function App() {
  const [stateObj, send, reset] = useWyrdMachine<DemoState, DemoEvents>(
    machine,
  );
  const [signalStrength, setSignalStrength] = useState<number>(45);
  const [lastResult, setLastResult] = useState<string>(
    "No transitions sent yet.",
  );

  const runSubmitSignal = () => {
    const didTransition = send("SUBMIT_SIGNAL", { strength: signalStrength });
    const suffix = didTransition ? "transitioned" : "was cancelled";
    setLastResult(`SUBMIT_SIGNAL (${signalStrength}) ${suffix}.`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-100 font-sans p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px), radial-gradient(circle at 20% 10%, rgba(99, 102, 241, 0.12), transparent 45%), radial-gradient(circle at 80% 90%, rgba(56, 189, 248, 0.08), transparent 50%)",
          backgroundSize: "28px 28px, 28px 28px, 100% 100%, 100% 100%",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto bg-slate-800/50 rounded-3xl p-6 shadow-lg backdrop-blur-[1px]">
        <h1 className="text-2xl font-semibold mb-4">
          State machine capabilities demo
        </h1>
        <div className="mb-4 rounded-2xl bg-slate-900/60 p-4 text-sm text-slate-200 border border-slate-700/80">
          <p className="font-mono text-xs leading-relaxed">
            Flow: idle → ready → processing → complete. PREPARE activates the
            machine. SUBMIT_SIGNAL(strength) is a function transition that
            returns the next state or cancels by returning undefined. CANCEL and
            MARK_COMPLETE move the flow; REOPEN reopens from complete.
          </p>
        </div>
        <p className="text-slate-100">
          Current state: <strong className="ml-2">{stateObj.value}</strong>
        </p>
        <p className="mt-2 text-slate-300">
          Available events in this state:{" "}
          {stateObj.nextEvents.join(", ") || "none"}
        </p>

        <div className="mt-4 rounded-2xl bg-slate-700/50 p-4">
          <label
            className="block text-sm text-slate-200"
            htmlFor="signal-strength"
          >
            Signal strength (used by function transition)
          </label>
          <input
            id="signal-strength"
            className="mt-2 w-full accent-indigo-500"
            min={0}
            max={100}
            type="range"
            value={signalStrength}
            onChange={(event) => {
              setSignalStrength(Number(event.target.value));
            }}
          />
          <p className="mt-2 text-sm text-slate-300">
            Current payload value: {signalStrength}
          </p>
        </div>

        <div className="mt-4 flex items-center flex-wrap gap-3">
          <button
            className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-xl hover:cursor-pointer"
            onClick={() => {
              const didTransition = send("PREPARE");
              setLastResult(
                `PREPARE ${didTransition ? "transitioned" : "was ignored"}.`,
              );
            }}
          >
            PREPARE
          </button>

          <button
            className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-xl hover:cursor-pointer"
            onClick={runSubmitSignal}
          >
            SUBMIT_SIGNAL (payload)
          </button>

          <button
            className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-xl hover:cursor-pointer"
            onClick={() => {
              const didTransition = send("MARK_COMPLETE");
              setLastResult(
                `MARK_COMPLETE ${didTransition ? "transitioned" : "was ignored"}.`,
              );
            }}
          >
            MARK_COMPLETE
          </button>

          <button
            className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-xl hover:cursor-pointer"
            onClick={() => {
              const didTransition = send("REOPEN");
              setLastResult(
                `REOPEN ${didTransition ? "transitioned" : "was ignored"}.`,
              );
            }}
          >
            REOPEN
          </button>

          <button
            className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-xl hover:cursor-pointer"
            onClick={() => {
              const didTransition = send("CANCEL");
              setLastResult(
                `CANCEL ${didTransition ? "transitioned" : "was ignored"}.`,
              );
            }}
          >
            CANCEL
          </button>

          <button
            className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-xl hover:cursor-pointer"
            onClick={() => {
              reset();
              setLastResult("reset() moved machine to initial state.");
            }}
          >
            reset()
          </button>

          <button
            className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-xl hover:cursor-pointer"
            onClick={() => {
              reset("ready");
              setLastResult('reset("ready") moved machine to a named state.');
            }}
          >
            reset(&quot;ready&quot;)
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-300">
          Last send/reset result: {lastResult}
        </p>

        <AsyncExample />
      </div>
    </div>
  );
}
