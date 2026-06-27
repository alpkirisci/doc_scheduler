"use client";

import { useCallback } from "react";
import type { ScheduleInput, SolveResult } from "./types";
import { solve } from "./engine";

type WorkerReply = { ok: true; result: SolveResult } | { ok: false; error: string };

/**
 * Returns a function that solves a schedule in a Web Worker (off the main
 * thread). Falls back to solving inline if Workers aren't available.
 */
export function useSolver() {
  return useCallback((input: ScheduleInput): Promise<SolveResult> => {
    if (typeof Worker === "undefined") {
      return Promise.resolve(solve(input));
    }
    return new Promise<SolveResult>((resolve, reject) => {
      const worker = new Worker(new URL("./worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<WorkerReply>) => {
        const data = e.data;
        worker.terminate();
        if (data.ok) resolve(data.result);
        else reject(new Error(data.error));
      };
      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };
      worker.postMessage(input);
    });
  }, []);
}
