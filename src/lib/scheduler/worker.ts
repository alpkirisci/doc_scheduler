/// <reference lib="webworker" />
// Runs the (CPU-heavy) solver off the main thread so the UI stays responsive.

import { solve } from "./engine";
import type { ScheduleInput } from "./types";
import { errorMessage } from "@/lib/errors";

self.onmessage = (e: MessageEvent<ScheduleInput>) => {
  try {
    const result = solve(e.data);
    (self as DedicatedWorkerGlobalScope).postMessage({ ok: true, result });
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({ ok: false, error: errorMessage(err) });
  }
};
