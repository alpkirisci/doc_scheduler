// ---------------------------------------------------------------------------
// doc_scheduler — scheduling engine: public types
//
// The engine is intentionally framework-free (no React / Supabase / DOM deps)
// so it can run in a Web Worker, in Node for tests, or anywhere else.
// ---------------------------------------------------------------------------

/** A time block within a day (e.g. a 24h on-call, or Day 08–20 / Night 20–08). */
export interface Shift {
  id: string;
  name: string;
  /** Minutes from local midnight when the shift starts (e.g. 8*60 = 480). */
  startMin: number;
  /** Length of the shift in minutes (e.g. 12*60 = 720, or 24*60 = 1440). */
  durationMin: number;
  /** Marks the shift as "undesirable time" so the load of it is balanced too. */
  isNight?: boolean;
}

/** A place that must be staffed, with a fixed number of people per shift. */
export interface Room {
  id: string;
  name: string;
  /** People required in this room per shift (Green1=1, Green2=2, Yellow=3 …). */
  capacity: number;
  /** If true, the optimiser is nudged away from staffing this 2-cap room with 2. */
  twoPersonUndesirable?: boolean;
}

export interface Person {
  id: string;
  name: string;
  /** Flag "hard to work with" people; exposure to them is shared equally. */
  isDifficult?: boolean;
}

export type PairKind = "want" | "avoid" | "never_alone";

/**
 * A relationship rule between two people.
 *  - want:        soft reward for sharing a room
 *  - avoid:       soft penalty for sharing a room (hard => never share)
 *  - never_alone: HARD — a & b may never be the only two people in a room
 */
export interface PairRule {
  a: string;
  b: string;
  kind: PairKind;
  /** Soft strength (defaults to 1). Ignored for never_alone (always hard). */
  weight?: number;
  /** For want/avoid: promote to a hard constraint. */
  hard?: boolean;
}

/** A person cannot work on this date (whole day if shiftId omitted). */
export interface Unavailability {
  personId: string;
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  shiftId?: string;
}

/** Objective weights. Higher = the optimiser cares more. Tier-separated. */
export interface Weights {
  /** Equal time in each room (pain #1). */
  room: number;
  /** Equal total number of duties. */
  load: number;
  /** Spread difficult-colleague exposure evenly (variance term, pain #3). */
  expVar: number;
  /** Crush the worst-case difficult-colleague exposure (max term, pain #3). */
  expMax: number;
  /** Penalty per shift an "avoid" pair shares a room (pain #2). */
  avoid: number;
  /** Reward per shift a "want" pair shares a room (pain #2). */
  want: number;
  /** Penalty per undesirable 2-person room actually staffed by 2 (pain #4). */
  twoRoom: number;
  /** Penalty for clustering a person's duties tighter than the ideal rhythm. */
  spacing: number;
  /** Equal share of night / undesirable shifts. */
  night: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  expMax: 120,
  expVar: 120,
  room: 100,
  load: 80,
  night: 30,
  avoid: 40,
  want: 20,
  spacing: 8,
  twoRoom: 10,
};

/** Everything the engine needs to produce a schedule. */
export interface ScheduleInput {
  people: Person[];
  rooms: Room[];
  shifts: Shift[];
  /** The dates duties occur on, ISO "YYYY-MM-DD". Each gets every shift. */
  dutyDates: string[];
  unavailability?: Unavailability[];
  pairRules?: PairRule[];
  /** Minimum rest (hours) between a person's consecutive shifts. Default 24. */
  restHoursMin?: number;
  /** Max duties a person may do in one calendar day. Default 1 (no 24h chains). */
  maxDutiesPerDay?: number;
  weights?: Partial<Weights>;
  /** Seed for reproducible runs. Default 1. */
  seed?: number;
  /** Local-search moves per restart. Default chosen from instance size. */
  iterations?: number;
  /** Number of independent restarts; best is kept. Default 6. */
  restarts?: number;
}

/** One placed cell of the final schedule. */
export interface Assignment {
  date: string;
  shiftId: string;
  roomId: string;
  slotIndex: number;
  personId: string;
}

export interface PersonStat {
  personId: string;
  name: string;
  load: number;
  /** roomId -> number of duties in that room. */
  roomCount: Record<string, number>;
  difficultExposure: number;
  nightCount: number;
}

export interface FairnessReport {
  feasible: boolean;
  hardViolations: number;
  penalty: number;
  /** 0–100 headline number; higher = more balanced. */
  fairnessScore: number;
  perPerson: PersonStat[];
  targets: {
    load: number;
    /** roomId -> fair share per person. */
    room: Record<string, number>;
    exposure: number;
  };
  spreads: {
    load: number;
    roomMax: number;
    exposure: number;
  };
  avoidViolations: number;
  neverAloneViolations: number;
  wantSatisfied: number;
  twoRoomCount: number;
  /** Contribution of each objective term, for the "why" panel. */
  breakdown: Record<string, number>;
  /** Plain-language reasons a setup is impossible (empty if feasible). */
  infeasibilities: string[];
}

export interface SolveResult {
  assignments: Assignment[];
  report: FairnessReport;
  seed: number;
  iterations: number;
}
