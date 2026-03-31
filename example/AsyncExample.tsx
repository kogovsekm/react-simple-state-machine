import React from "react";
import { useWyrdMachine } from "..";
import type { WyrdMachineConfig } from "..";

type AsyncState = "standby" | "requesting" | "success" | "failed";

type AsyncEvents = {
  BEGIN_SEQUENCE: { delayMs: number } | undefined;
  RESOLVE: undefined;
  REJECT: undefined;
  RETRY: undefined;
  ABORT: undefined;
};

const machine = {
  initial: "standby",
  states: {
    standby: {
      on: {
        BEGIN_SEQUENCE: async (payload) => {
          const delayMs = payload?.delayMs ?? 700;
          console.log("[async machine] waiting before requesting", delayMs);
          await new Promise((resolve) => {
            setTimeout(resolve, delayMs);
          });
          return "requesting";
        },
      },
      effect: () => {
        console.log("[async machine] entered standby");
        return () => {
          console.log("[async machine] leaving standby");
        };
      },
    },
    requesting: {
      on: { RESOLVE: "success", REJECT: "failed", ABORT: "standby" },
      effect: () => {
        console.log("[async machine] entered requesting");
        return () => {
          console.log("[async machine] leaving requesting");
        };
      },
    },
    success: {
      on: { RETRY: "standby" },
      effect: () => {
        console.log("[async machine] entered success");
        return () => {
          console.log("[async machine] leaving success");
        };
      },
    },
    failed: {
      on: { RETRY: "standby" },
      effect: () => {
        console.log("[async machine] entered failed");
        return () => {
          console.log("[async machine] leaving failed");
        };
      },
    },
  },
} as WyrdMachineConfig<AsyncState, AsyncEvents>;

export default function AsyncExample() {
  const [state, send, reset] = useWyrdMachine<AsyncState, AsyncEvents>(machine);
  const [delayMs, setDelayMs] = React.useState<number>(900);
  const [asyncResult, setAsyncResult] = React.useState<string>(
    "No async transition sent yet.",
  );

  const runSequence = async () => {
    const accepted = await send.async("BEGIN_SEQUENCE", { delayMs });
    if (!accepted) {
      setAsyncResult("BEGIN_SEQUENCE was ignored.");
      return;
    }

    setAsyncResult("BEGIN_SEQUENCE completed and moved to requesting.");

    setTimeout(() => {
      const shouldResolve = Math.random() > 0.4;
      if (shouldResolve) {
        send("RESOLVE");
        setAsyncResult("Auto outcome: RESOLVE.");
        return;
      }

      send("REJECT");
      setAsyncResult("Auto outcome: REJECT.");
    }, 700);
  };

  return (
    <div className="mt-6 p-4 bg-slate-700 rounded-3xl">
      <h2 className="text-lg font-medium mb-2">Async transition demo</h2>
      <div className="mb-4 rounded-2xl bg-slate-900/50 p-4 text-sm text-slate-200 border border-slate-600/80">
        <p className="font-mono text-xs leading-relaxed">
          Async request lifecycle: standby → requesting → (success|failed).
          BEGIN_SEQUENCE(delayMs) uses send.async. From requesting: RESOLVE ends
          in success, REJECT in failed, ABORT returns to standby. RETRY loops
          both terminals back to standby.
        </p>
      </div>
      <p>
        State: <strong className="ml-2">{state.value}</strong>
      </p>
      <p className="mt-2 text-slate-200">
        Available events: {state.nextEvents.join(", ") || "none"}
      </p>

      <label className="mt-3 block text-sm text-slate-200" htmlFor="delay-ms">
        Async delay (ms)
      </label>
      <input
        id="delay-ms"
        className="mt-2 w-full accent-emerald-500"
        min={200}
        max={2000}
        step={100}
        type="range"
        value={delayMs}
        onChange={(event) => {
          setDelayMs(Number(event.target.value));
        }}
      />
      <p className="mt-2 text-sm text-slate-200">
        Current delay payload: {delayMs}ms
      </p>

      <div className="mt-3 flex items-center flex-wrap gap-3">
        <button
          className="bg-emerald-600 hover:bg-emerald-500 text-white py-1 px-3 rounded-xl hover:cursor-pointer"
          onClick={runSequence}
        >
          send.async(BEGIN_SEQUENCE)
        </button>
        <button
          className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 rounded-xl hover:cursor-pointer"
          onClick={() => {
            const didTransition = send("ABORT");
            setAsyncResult(
              `ABORT ${didTransition ? "transitioned" : "was ignored"}.`,
            );
          }}
        >
          ABORT
        </button>
        <button
          className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 rounded-xl hover:cursor-pointer"
          onClick={() => {
            const didTransition = send("RESOLVE");
            setAsyncResult(
              `RESOLVE ${didTransition ? "transitioned" : "was ignored"}.`,
            );
          }}
        >
          RESOLVE
        </button>
        <button
          className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 rounded-xl hover:cursor-pointer"
          onClick={() => {
            const didTransition = send("REJECT");
            setAsyncResult(
              `REJECT ${didTransition ? "transitioned" : "was ignored"}.`,
            );
          }}
        >
          REJECT
        </button>
        <button
          className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 rounded-xl hover:cursor-pointer"
          onClick={() => {
            const didTransition = send("RETRY");
            setAsyncResult(
              `RETRY ${didTransition ? "transitioned" : "was ignored"}.`,
            );
          }}
        >
          RETRY
        </button>
        <button
          className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 rounded-xl hover:cursor-pointer"
          onClick={() => {
            reset();
            setAsyncResult("reset() moved to standby.");
          }}
        >
          reset()
        </button>
        <button
          className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 rounded-xl hover:cursor-pointer"
          onClick={() => {
            reset("requesting");
            setAsyncResult('reset("requesting") moved to a named state.');
          }}
        >
          reset(&quot;requesting&quot;)
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-200">
        Latest async result: {asyncResult}
      </p>
    </div>
  );
}
