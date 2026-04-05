// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as sm from "..";
import { useStateMachine } from "..";
import type { StateMachineConfig } from "..";

describe("module exports", () => {
  it("exports useStateMachine", () => {
    expect(typeof (sm as { useStateMachine: unknown }).useStateMachine).toBe(
      "function",
    );
  });
});

describe("reset behavior", () => {
  it("returns false and keeps current state when reset target is invalid", () => {
    type DemoState = "idle" | "working";
    type DemoEvents = {
      START: undefined;
      STOP: undefined;
    };

    const machine = {
      initial: "idle",
      states: {
        idle: { on: { START: "working" } },
        working: { on: { STOP: "idle" } },
      },
    } as const;

    const { result } = renderHook(() =>
      useStateMachine<DemoState, DemoEvents>(
        machine as unknown as sm.StateMachineConfig<DemoState, DemoEvents>,
      ),
    );

    let didReset = true;
    act(() => {
      didReset = result.current[2]("missing" as unknown as DemoState);
    });

    expect(didReset).toBe(false);
    expect(result.current[0].value).toBe("idle");
  });
});

describe("regular machine flow", () => {
  it("should execute full state machine with effects and named transitions", () => {
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
        },
        ready: {
          on: {
            SUBMIT_SIGNAL: (payload) => {
              if (!payload || payload.strength < 60) {
                return undefined;
              }
              return "processing";
            },
            CANCEL: "idle",
          },
        },
        processing: {
          on: {
            MARK_COMPLETE: "complete",
            CANCEL: "idle",
          },
        },
        complete: {
          on: { REOPEN: "ready" },
        },
      },
    } as StateMachineConfig<DemoState, DemoEvents>;

    const { result } = renderHook(() =>
      useStateMachine<DemoState, DemoEvents>(machine),
    );

    // Initial state
    expect(result.current[0].value).toBe("idle");
    expect(result.current[0].nextEvents).toEqual(["PREPARE"]);

    // Transition: idle -> ready
    act(() => {
      result.current[1]("PREPARE");
    });
    expect(result.current[0].value).toBe("ready");
    expect(result.current[0].nextEvents).toEqual(["SUBMIT_SIGNAL", "CANCEL"]);

    // Function transition with payload validation (should be cancelled: strength < 60)
    act(() => {
      result.current[1]("SUBMIT_SIGNAL", { strength: 45 });
    });
    expect(result.current[0].value).toBe("ready"); // State unchanged
    expect(result.current[0].nextEvents).toEqual(["SUBMIT_SIGNAL", "CANCEL"]);

    // Function transition that succeeds (strength >= 60)
    act(() => {
      result.current[1]("SUBMIT_SIGNAL", { strength: 75 });
    });
    expect(result.current[0].value).toBe("processing");
    expect(result.current[0].nextEvents).toEqual(["MARK_COMPLETE", "CANCEL"]);

    // Transition: processing -> complete
    act(() => {
      result.current[1]("MARK_COMPLETE");
    });
    expect(result.current[0].value).toBe("complete");
    expect(result.current[0].nextEvents).toEqual(["REOPEN"]);

    // Transition: complete -> ready (named transition)
    act(() => {
      result.current[1]("REOPEN");
    });
    expect(result.current[0].value).toBe("ready");
    expect(result.current[0].nextEvents).toEqual(["SUBMIT_SIGNAL", "CANCEL"]);

    // Reset to initial state
    act(() => {
      result.current[2]("idle");
    });
    expect(result.current[0].value).toBe("idle");
    expect(result.current[0].nextEvents).toEqual(["PREPARE"]);
  });

  it("should handle CANCEL transition from processing back to idle", () => {
    type DemoState = "idle" | "ready" | "processing";
    type DemoEvents = {
      PREPARE: undefined;
      SUBMIT_SIGNAL: { strength: number } | undefined;
      CANCEL: undefined;
    };

    const machine = {
      initial: "idle",
      states: {
        idle: {
          on: { PREPARE: "ready" },
        },
        ready: {
          on: {
            SUBMIT_SIGNAL: (payload) => {
              if (!payload || payload.strength < 60) {
                return undefined;
              }
              return "processing";
            },
            CANCEL: "idle",
          },
        },
        processing: {
          on: {
            CANCEL: "idle",
          },
        },
      },
    } as StateMachineConfig<DemoState, DemoEvents>;

    const { result } = renderHook(() =>
      useStateMachine<DemoState, DemoEvents>(machine),
    );

    // Move through states
    act(() => {
      result.current[1]("PREPARE");
    });
    act(() => {
      result.current[1]("SUBMIT_SIGNAL", { strength: 80 });
    });
    expect(result.current[0].value).toBe("processing");

    // Cancel from processing
    act(() => {
      result.current[1]("CANCEL");
    });
    expect(result.current[0].value).toBe("idle");
  });
});

describe("async machine flow", () => {
  it("should handle async transitions with send.async", async () => {
    type AsyncState = "standby" | "requesting" | "success";
    type AsyncEvents = {
      BEGIN_SEQUENCE: { delayMs: number } | undefined;
      RESOLVE: undefined;
      RETRY: undefined;
    };

    const machine = {
      initial: "standby",
      states: {
        standby: {
          on: {
            BEGIN_SEQUENCE: async (payload) => {
              const delayMs = payload?.delayMs ?? 100;
              await new Promise((resolve) => {
                setTimeout(resolve, delayMs);
              });
              return "requesting";
            },
          },
        },
        requesting: {
          on: {
            RESOLVE: "success",
            RETRY: "standby",
          },
        },
        success: {
          on: { RETRY: "standby" },
        },
      },
    } as StateMachineConfig<AsyncState, AsyncEvents>;

    const { result } = renderHook(() =>
      useStateMachine<AsyncState, AsyncEvents>(machine),
    );

    // Initial state
    expect(result.current[0].value).toBe("standby");

    // Start async transition
    let asyncAccepted = false;
    await act(async () => {
      asyncAccepted = await result.current[1].async("BEGIN_SEQUENCE", {
        delayMs: 50,
      });
    });

    expect(asyncAccepted).toBe(true);
    expect(result.current[0].value).toBe("requesting");

    // Resolve the request
    act(() => {
      result.current[1]("RESOLVE");
    });
    expect(result.current[0].value).toBe("success");
    expect(result.current[0].nextEvents).toEqual(["RETRY"]);
  });

  it("should handle async transition failure path", async () => {
    type AsyncState = "standby" | "requesting" | "failed";
    type AsyncEvents = {
      BEGIN_SEQUENCE: { delayMs: number } | undefined;
      REJECT: undefined;
      RETRY: undefined;
    };

    const machine = {
      initial: "standby",
      states: {
        standby: {
          on: {
            BEGIN_SEQUENCE: async (payload) => {
              const delayMs = payload?.delayMs ?? 50;
              await new Promise((resolve) => {
                setTimeout(resolve, delayMs);
              });
              return "requesting";
            },
          },
        },
        requesting: {
          on: {
            REJECT: "failed",
          },
        },
        failed: {
          on: { RETRY: "standby" },
        },
      },
    } as StateMachineConfig<AsyncState, AsyncEvents>;

    const { result } = renderHook(() =>
      useStateMachine<AsyncState, AsyncEvents>(machine),
    );

    // Start async transition
    await act(async () => {
      await result.current[1].async("BEGIN_SEQUENCE", { delayMs: 50 });
    });
    expect(result.current[0].value).toBe("requesting");

    // Reject the request
    act(() => {
      result.current[1]("REJECT");
    });
    expect(result.current[0].value).toBe("failed");
    expect(result.current[0].nextEvents).toEqual(["RETRY"]);

    // Retry - go back to standby
    act(() => {
      result.current[1]("RETRY");
    });
    expect(result.current[0].value).toBe("standby");
  });

  it("should handle abort during async transition request phase", async () => {
    type AsyncState = "standby" | "requesting" | "failed";
    type AsyncEvents = {
      BEGIN_SEQUENCE: { delayMs: number } | undefined;
      ABORT: undefined;
    };

    const machine = {
      initial: "standby",
      states: {
        standby: {
          on: {
            BEGIN_SEQUENCE: async (payload) => {
              const delayMs = payload?.delayMs ?? 50;
              await new Promise((resolve) => {
                setTimeout(resolve, delayMs);
              });
              return "requesting";
            },
          },
        },
        requesting: {
          on: {
            ABORT: "standby",
          },
        },
      },
    } as StateMachineConfig<AsyncState, AsyncEvents>;

    const { result } = renderHook(() =>
      useStateMachine<AsyncState, AsyncEvents>(machine),
    );

    // Start async transition
    await act(async () => {
      await result.current[1].async("BEGIN_SEQUENCE", { delayMs: 50 });
    });
    expect(result.current[0].value).toBe("requesting");

    // Abort back to standby
    act(() => {
      result.current[1]("ABORT");
    });
    expect(result.current[0].value).toBe("standby");
    expect(result.current[0].nextEvents).toEqual(["BEGIN_SEQUENCE"]);
  });
});
