// ---------------------------------------------------------------------------
// doc_scheduler — scheduling engine core
//
// Pipeline (all pure, deterministic for a given seed):
//   1. buildProblem()      compile ScheduleInput -> index-based Problem
//   2. checkFeasibility()  Phase 0 — detect & explain impossible setups
//   3. construct()         Phase 1 — fair greedy seed (hard-feasible)
//   4. localSearch()       Phase 2 — simulated annealing toward fairness
//   5. buildReport()       explainable fairness stats for UI + Excel
//   solve() ties it together with multi-restart.
//
// Hard constraints (capacity, availability, rest/no-24h, never-alone, hard
// avoid) are kept feasible BY CONSTRUCTION — the move generator never creates
// a violating state. Everything fairness-related is a soft weighted penalty,
// so a feasible schedule always exists when Phase 0 passes.
// ---------------------------------------------------------------------------

import {
  Assignment,
  DEFAULT_WEIGHTS,
  FairnessReport,
  PersonStat,
  ScheduleInput,
  SolveResult,
  Weights,
} from "./types";
import { makeRng, randInt, Rng, shuffle } from "./rng";

const HARD_PENALTY = 1e9;

// ----------------------------- compiled model ------------------------------

interface Inst {
  date: string;
  dateIdx: number; // sorted index among duty dates (for grouping/targets)
  absDay: number; // real calendar day number (for rest timing & spacing)
  shiftIdx: number;
  startAbs: number; // absolute minutes (absDay*1440 + startMin)
  endAbs: number;
  isNight: boolean;
}

interface Problem {
  P: number;
  R: number;
  rooms: { id: string; name: string; capacity: number; twoUndesirable: boolean }[];
  shifts: { id: string; name: string; isNight: boolean }[];
  people: { id: string; name: string }[];
  difficult: boolean[];
  nDifficult: number;

  insts: Inst[];
  I: number;
  cap: number[]; // per room
  slotsInInst: number; // sum of capacities (== slots per inst)

  // slot arrays
  slotInst: Int32Array;
  slotRoom: Int32Array;
  slotsByInst: number[][];

  // availability[inst*P + p] = can p work inst i?
  avail: Uint8Array;
  availCountPerInst: number[];

  // pair rules (person indices)
  wantPairs: { a: number; b: number; w: number }[];
  avoidPairs: { a: number; b: number; w: number; hard: boolean }[];
  neverAlone: { a: number; b: number }[];

  restMin: number; // minutes
  maxDutiesPerDay: number;
  nDays: number;

  // targets
  totalSlots: number;
  slotsInRoom: number[]; // per room across horizon
  targetLoad: number;
  targetRoom: number[]; // per room, per person fair share
  hasBench: boolean;

  weights: Weights;
}

export function buildProblem(input: ScheduleInput): Problem {
  const people = input.people.map((p) => ({ id: p.id, name: p.name }));
  const P = people.length;
  const difficult = input.people.map((p) => !!p.isDifficult);
  const nDifficult = difficult.filter(Boolean).length;

  const rooms = input.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    twoUndesirable: !!r.twoPersonUndesirable,
  }));
  const R = rooms.length;
  const cap = rooms.map((r) => r.capacity);

  const shifts = input.shifts.map((s) => ({ id: s.id, name: s.name, isNight: !!s.isNight }));

  // sorted unique dates -> sorted ordinal + real calendar day number
  const dates = Array.from(new Set(input.dutyDates)).sort();
  const dayIdxOf = new Map<string, number>();
  const absDayOf = new Map<string, number>();
  dates.forEach((d, i) => {
    dayIdxOf.set(d, i);
    const y = +d.slice(0, 4);
    const m = +d.slice(5, 7);
    const day = +d.slice(8, 10);
    absDayOf.set(d, Math.floor(Date.UTC(y, m - 1, day) / 86400000));
  });
  const nDays = dates.length;

  const idToPerson = new Map(input.people.map((p, i) => [p.id, i]));
  const idToRoom = new Map(input.rooms.map((r, i) => [r.id, i]));
  const idToShift = new Map(input.shifts.map((s, i) => [s.id, i]));

  // build shift instances (one per date x shift)
  const insts: Inst[] = [];
  for (const d of dates) {
    const dateIdx = dayIdxOf.get(d)!;
    const absDay = absDayOf.get(d)!;
    for (let si = 0; si < input.shifts.length; si++) {
      const sh = input.shifts[si];
      const startAbs = absDay * 1440 + sh.startMin;
      insts.push({
        date: d,
        dateIdx,
        absDay,
        shiftIdx: si,
        startAbs,
        endAbs: startAbs + sh.durationMin,
        isNight: !!sh.isNight,
      });
    }
  }
  const I = insts.length;
  const slotsInInst = cap.reduce((a, b) => a + b, 0);

  // slots
  const slotInst: number[] = [];
  const slotRoom: number[] = [];
  const slotsByInst: number[][] = [];
  for (let i = 0; i < I; i++) {
    const list: number[] = [];
    for (let r = 0; r < R; r++) {
      for (let k = 0; k < cap[r]; k++) {
        list.push(slotInst.length);
        slotInst.push(i);
        slotRoom.push(r);
      }
    }
    slotsByInst.push(list);
  }

  // availability: default available; unavailability removes
  const avail = new Uint8Array(I * P).fill(1);
  for (const u of input.unavailability ?? []) {
    const p = idToPerson.get(u.personId);
    if (p === undefined) continue;
    for (let i = 0; i < I; i++) {
      if (insts[i].date !== u.date) continue;
      if (u.shiftId !== undefined && insts[i].shiftIdx !== idToShift.get(u.shiftId)) continue;
      avail[i * P + p] = 0;
    }
  }
  const availCountPerInst: number[] = [];
  for (let i = 0; i < I; i++) {
    let c = 0;
    for (let p = 0; p < P; p++) c += avail[i * P + p];
    availCountPerInst.push(c);
  }

  // pair rules
  const wantPairs: { a: number; b: number; w: number }[] = [];
  const avoidPairs: { a: number; b: number; w: number; hard: boolean }[] = [];
  const neverAlone: { a: number; b: number }[] = [];
  for (const pr of input.pairRules ?? []) {
    const a = idToPerson.get(pr.a);
    const b = idToPerson.get(pr.b);
    if (a === undefined || b === undefined || a === b) continue;
    const w = pr.weight ?? 1;
    if (pr.kind === "want") wantPairs.push({ a, b, w });
    else if (pr.kind === "avoid") avoidPairs.push({ a, b, w, hard: !!pr.hard });
    else if (pr.kind === "never_alone") neverAlone.push({ a, b });
  }

  const restMin = Math.round((input.restHoursMin ?? 24) * 60);
  const maxDutiesPerDay = input.maxDutiesPerDay ?? 1;

  const totalSlots = slotsInInst * I;
  const slotsInRoom = cap.map((c) => c * I);
  const targetLoad = totalSlots / P;
  const targetRoom = slotsInRoom.map((s) => s / P);
  const hasBench = availCountPerInst.some((c) => c > slotsInInst);

  const weights: Weights = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };

  return {
    P,
    R,
    rooms,
    shifts,
    people,
    difficult,
    nDifficult,
    insts,
    I,
    cap,
    slotsInInst,
    slotInst: Int32Array.from(slotInst),
    slotRoom: Int32Array.from(slotRoom),
    slotsByInst,
    avail,
    availCountPerInst,
    wantPairs,
    avoidPairs,
    neverAlone,
    restMin,
    maxDutiesPerDay,
    nDays,
    totalSlots,
    slotsInRoom,
    targetLoad,
    targetRoom,
    hasBench,
    weights,
  };
}

// ----------------------------- Phase 0: feasibility ------------------------

export function checkFeasibility(pb: Problem): string[] {
  const msgs: string[] = [];

  // 1. per-instance coverage: enough available, rested people to fill all slots
  for (let i = 0; i < pb.I; i++) {
    if (pb.availCountPerInst[i] < pb.slotsInInst) {
      const inst = pb.insts[i];
      msgs.push(
        `${inst.date} (${pb.shifts[inst.shiftIdx].name}): need ${pb.slotsInInst} people but only ${pb.availCountPerInst[i]} are available.`,
      );
    }
  }

  // 2. rest rule vs same-day shifts: if more shifts/day than maxDutiesPerDay can
  //    cover with the people available, flag it. (per-day total slots vs people)
  const byDate = new Map<string, number[]>();
  for (let i = 0; i < pb.I; i++) {
    const arr = byDate.get(pb.insts[i].date) ?? [];
    arr.push(i);
    byDate.set(pb.insts[i].date, arr);
  }
  for (const [date, instIdxs] of byDate) {
    const slotsThatDay = instIdxs.length * pb.slotsInInst;
    // people who could legally work that day (maxDutiesPerDay each)
    const peopleAvail = new Set<number>();
    for (const i of instIdxs)
      for (let p = 0; p < pb.P; p++) if (pb.avail[i * pb.P + p]) peopleAvail.add(p);
    const capacityThatDay = peopleAvail.size * pb.maxDutiesPerDay;
    if (capacityThatDay < slotsThatDay) {
      msgs.push(
        `${date}: ${slotsThatDay} slots across the day but at most ${capacityThatDay} can be worked (people x max duties/day). Add people, add a shift, or raise max duties/day.`,
      );
    }
  }

  // 3. never-alone making a 2-cap room unfillable everywhere
  for (const { a, b } of pb.neverAlone) {
    const aName = pb.people[a].name;
    const bName = pb.people[b].name;
    // contradiction with a hard avoid is fine (both forbid sharing); flag the
    // opposite: a "want" + "never_alone" is contradictory only softly. skip.
    void aName;
    void bName;
  }

  // 4. contradictory hard rules: want + hard-avoid on the same pair
  for (const w of pb.wantPairs) {
    for (const av of pb.avoidPairs) {
      if (av.hard && ((w.a === av.a && w.b === av.b) || (w.a === av.b && w.b === av.a))) {
        msgs.push(
          `${pb.people[w.a].name} & ${pb.people[w.b].name}: cannot both "want together" and "hard-avoid".`,
        );
      }
    }
  }

  return msgs;
}

// ----------------------------- evaluator -----------------------------------
// Reusable buffers so evaluate() allocates nothing in the hot loop.

class Evaluator {
  pb: Problem;
  roomCount: Int32Array;
  load: Int32Array;
  night: Int32Array;
  exposure: Int32Array;
  roomOf: Int32Array; // inst*P + p -> roomIdx or -1
  lastDay: Int32Array; // scratch for spacing
  membersScratch: number[][]; // per room, reused per inst

  constructor(pb: Problem) {
    this.pb = pb;
    this.roomCount = new Int32Array(pb.P * pb.R);
    this.load = new Int32Array(pb.P);
    this.night = new Int32Array(pb.P);
    this.exposure = new Int32Array(pb.P);
    this.roomOf = new Int32Array(pb.I * pb.P);
    this.lastDay = new Int32Array(pb.P);
    this.membersScratch = Array.from({ length: pb.R }, () => [] as number[]);
  }

  /** Cost = penalty + HARD_PENALTY*violations. Fills `detail` if provided.
   *  Single pass, no allocations in the hot path. */
  evaluate(slotPerson: Int32Array, detail?: Record<string, number>): {
    cost: number;
    penalty: number;
    hard: number;
  } {
    const pb = this.pb;
    const P = pb.P;
    const R = pb.R;
    const w = pb.weights;

    this.roomCount.fill(0);
    this.load.fill(0);
    this.night.fill(0);
    this.exposure.fill(0);
    this.roomOf.fill(-1);

    let unfilled = 0;
    for (let s = 0; s < slotPerson.length; s++) {
      const p = slotPerson[s];
      if (p < 0) {
        unfilled++;
        continue;
      }
      const i = pb.slotInst[s];
      const r = pb.slotRoom[s];
      this.roomCount[p * R + r]++;
      this.load[p]++;
      if (pb.insts[i].isNight) this.night[p]++;
      this.roomOf[i * P + p] = r;
    }

    // single per-instance pass: exposure + want/avoid + never-alone + two-room
    let wantShared = 0;
    let avoidShared = 0;
    let avoidHardBreaches = 0;
    let neverAloneViol = 0;
    let twoRoom = 0;
    for (let i = 0; i < pb.I; i++) {
      const base = i * P;
      for (let r = 0; r < R; r++) this.membersScratch[r].length = 0;
      for (const s of pb.slotsByInst[i]) {
        const p = slotPerson[s];
        if (p >= 0) this.membersScratch[pb.slotRoom[s]].push(p);
      }
      if (pb.nDifficult > 0) {
        for (let r = 0; r < R; r++) {
          const mem = this.membersScratch[r];
          if (mem.length < 2) continue;
          let diffInRoom = 0;
          for (const p of mem) if (pb.difficult[p]) diffInRoom++;
          if (diffInRoom === 0) continue;
          for (const p of mem) if (!pb.difficult[p]) this.exposure[p] += diffInRoom;
        }
      }
      for (const pr of pb.wantPairs) {
        const ra = this.roomOf[base + pr.a];
        if (ra >= 0 && ra === this.roomOf[base + pr.b]) wantShared += pr.w;
      }
      for (const pr of pb.avoidPairs) {
        const ra = this.roomOf[base + pr.a];
        if (ra >= 0 && ra === this.roomOf[base + pr.b]) {
          avoidShared += pr.w;
          if (pr.hard) avoidHardBreaches++;
        }
      }
      for (const pr of pb.neverAlone) {
        const ra = this.roomOf[base + pr.a];
        if (ra >= 0 && ra === this.roomOf[base + pr.b] && this.membersScratch[ra].length < 3) {
          neverAloneViol++;
        }
      }
      for (let r = 0; r < R; r++) {
        if (pb.rooms[r].twoUndesirable && this.membersScratch[r].length === 2) twoRoom++;
      }
    }

    // F_room
    let fRoom = 0;
    for (let p = 0; p < P; p++) {
      for (let r = 0; r < R; r++) {
        const d = this.roomCount[p * R + r] - pb.targetRoom[r];
        fRoom += d * d;
      }
    }

    // F_load
    let fLoad = 0;
    for (let p = 0; p < P; p++) {
      const d = this.load[p] - pb.targetLoad;
      fLoad += d * d;
    }

    // exposure terms (over non-difficult people)
    let fExpVar = 0;
    let fExpMax = 0;
    let maxExp = 0;
    const nNon = P - pb.nDifficult;
    if (pb.nDifficult > 0 && nNon > 0) {
      let totalExp = 0;
      for (let p = 0; p < P; p++) if (!pb.difficult[p]) totalExp += this.exposure[p];
      const targetExp = totalExp / nNon;
      for (let p = 0; p < P; p++) {
        if (pb.difficult[p]) continue;
        const e = this.exposure[p];
        const d = e - targetExp;
        fExpVar += d * d;
        if (e > maxExp) maxExp = e;
      }
      const over = Math.max(0, maxExp - targetExp);
      fExpMax = over * over;
    }

    // F_night
    let fNight = 0;
    let totalN = 0;
    for (let p = 0; p < P; p++) totalN += this.night[p];
    if (totalN > 0) {
      const tN = totalN / P;
      for (let p = 0; p < P; p++) {
        const d = this.night[p] - tN;
        fNight += d * d;
      }
    }

    // F_space: a person's duties on consecutive calendar days
    let fSpace = 0;
    this.lastDay.fill(-1);
    for (let i = 0; i < pb.I; i++) {
      const base = i * P;
      const absDay = pb.insts[i].absDay;
      for (let p = 0; p < P; p++) {
        if (this.roomOf[base + p] >= 0) {
          if (this.lastDay[p] >= 0 && absDay - this.lastDay[p] === 1) fSpace++;
          this.lastDay[p] = absDay;
        }
      }
    }

    const penalty =
      w.room * fRoom +
      w.load * fLoad +
      w.expVar * fExpVar +
      w.expMax * fExpMax +
      w.night * fNight +
      w.avoid * avoidShared -
      w.want * wantShared +
      w.twoRoom * twoRoom +
      w.spacing * fSpace;

    const hard = unfilled + neverAloneViol + avoidHardBreaches;
    const cost = penalty + HARD_PENALTY * hard;

    if (detail) {
      detail.room = w.room * fRoom;
      detail.load = w.load * fLoad;
      detail.expVar = w.expVar * fExpVar;
      detail.expMax = w.expMax * fExpMax;
      detail.night = w.night * fNight;
      detail.avoid = w.avoid * avoidShared;
      detail.want = -w.want * wantShared;
      detail.twoRoom = w.twoRoom * twoRoom;
      detail.spacing = w.spacing * fSpace;
      detail._wantShared = wantShared;
      detail._avoidShared = avoidShared;
      detail._neverAloneViol = neverAloneViol;
      detail._twoRoom = twoRoom;
      detail._maxExp = maxExp;
      detail._unfilled = unfilled;
    }

    return { cost, penalty, hard };
  }
}

// ----------------------------- Phase 1: construction -----------------------

export function construct(pb: Problem, rng: Rng): Int32Array {
  const P = pb.P;
  const R = pb.R;
  const slotPerson = new Int32Array(pb.slotInst.length).fill(-1);

  // running counters used to bias greedy picks
  const roomCount = new Int32Array(P * R);
  const load = new Int32Array(P);
  const exposure = new Int32Array(P);
  const lastEndAbs = new Int32Array(P).fill(-1 << 30);
  const dutiesOnDay = new Map<string, number>(); // `${p}:${dateIdx}`

  // rough exposure target for biasing
  const nNon = Math.max(1, P - pb.nDifficult);

  // process instances chronologically
  const order = pb.insts.map((_, i) => i).sort((x, y) => pb.insts[x].startAbs - pb.insts[y].startAbs);

  for (const i of order) {
    const inst = pb.insts[i];
    const placed = new Set<number>();
    const curMembers: number[][] = Array.from({ length: R }, () => []);

    // available pool for this instance
    const baseAvail: number[] = [];
    for (let p = 0; p < P; p++) {
      if (!pb.avail[i * P + p]) continue;
      const dk = `${p}:${inst.dateIdx}`;
      if ((dutiesOnDay.get(dk) ?? 0) >= pb.maxDutiesPerDay) continue;
      if (inst.startAbs - lastEndAbs[p] < pb.restMin) continue;
      baseAvail.push(p);
    }

    // fill rooms: singletons / smaller capacity first (scarcer)
    const roomOrder = pb.slotsByInst[i]
      .map((s) => pb.slotRoom[s])
      .filter((r, idx, a) => a.indexOf(r) === idx)
      .sort((r1, r2) => pb.cap[r1] - pb.cap[r2]);

    for (const r of roomOrder) {
      const slotsOfRoom = pb.slotsByInst[i].filter((s) => pb.slotRoom[s] === r);
      for (const s of slotsOfRoom) {
        // candidates
        let best = -1;
        let bestKey = Infinity;
        for (const p of baseAvail) {
          if (placed.has(p)) continue;
          if (!canPlace(pb, p, r, curMembers[r])) continue;

          let key = (roomCount[p * R + r] - pb.targetRoom[r]) * 2 + 1;
          key += (load[p] - pb.targetLoad) * 0.5;
          // exposure bias: placing into a room with a difficult member
          const roomHasDifficult = curMembers[r].some((q) => pb.difficult[q]);
          if (roomHasDifficult && !pb.difficult[p]) {
            key += (exposure[p] - 0) * 1.0; // prefer least-exposed so far
          }
          // soft pairing nudges
          for (const w of pb.wantPairs) {
            if ((w.a === p && curMembers[r].includes(w.b)) || (w.b === p && curMembers[r].includes(w.a)))
              key -= 0.3 * w.w;
          }
          for (const av of pb.avoidPairs) {
            if ((av.a === p && curMembers[r].includes(av.b)) || (av.b === p && curMembers[r].includes(av.a)))
              key += 0.5 * av.w;
          }
          key += rng() * 0.01;

          if (key < bestKey) {
            bestKey = key;
            best = p;
          }
        }

        if (best < 0) continue; // leave unfilled -> flagged by evaluator
        slotPerson[s] = best;
        placed.add(best);
        curMembers[r].push(best);
        roomCount[best * R + r]++;
        load[best]++;
        const dk = `${best}:${inst.dateIdx}`;
        dutiesOnDay.set(dk, (dutiesOnDay.get(dk) ?? 0) + 1);
        lastEndAbs[best] = inst.endAbs;
      }
    }

    // update exposure after the instance is filled
    if (pb.nDifficult > 0) {
      for (let r = 0; r < R; r++) {
        const mem = curMembers[r];
        let diffInRoom = 0;
        for (const q of mem) if (pb.difficult[q]) diffInRoom++;
        if (diffInRoom === 0) continue;
        for (const q of mem) if (!pb.difficult[q]) exposure[q] += diffInRoom;
      }
    }
    void nNon;
  }

  return slotPerson;
}

/** Can person p join room r given current members (never-alone + hard-avoid)? */
function canPlace(pb: Problem, p: number, r: number, members: number[]): boolean {
  const finalHeadcount = pb.cap[r];
  // hard avoid: never share a room
  for (const av of pb.avoidPairs) {
    if (!av.hard) continue;
    if (av.a === p && members.includes(av.b)) return false;
    if (av.b === p && members.includes(av.a)) return false;
  }
  // never-alone: forbidden only if the room can hold < 3 (would be "only two")
  if (finalHeadcount < 3) {
    for (const na of pb.neverAlone) {
      if (na.a === p && members.includes(na.b)) return false;
      if (na.b === p && members.includes(na.a)) return false;
    }
  }
  return true;
}

// ----------------------------- Phase 2: local search -----------------------

function membersOfRoomAtInst(pb: Problem, slotPerson: Int32Array, inst: number, room: number): number[] {
  const out: number[] = [];
  for (const s of pb.slotsByInst[inst]) {
    if (pb.slotRoom[s] === room) {
      const p = slotPerson[s];
      if (p >= 0) out.push(p);
    }
  }
  return out;
}

/** Validate a room's membership against never-alone + hard-avoid. */
function roomOk(pb: Problem, members: number[]): boolean {
  for (const av of pb.avoidPairs) {
    if (!av.hard) continue;
    if (members.includes(av.a) && members.includes(av.b)) return false;
  }
  if (members.length < 3) {
    for (const na of pb.neverAlone) {
      if (members.includes(na.a) && members.includes(na.b)) return false;
    }
  }
  return true;
}

/** Instances where person p currently works. */
function personWorkingInsts(pb: Problem, slotPerson: Int32Array, p: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pb.I; i++) {
    for (const s of pb.slotsByInst[i]) {
      if (slotPerson[s] === p) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

/** Would adding `addInst` to p's roster keep rest + max-duties-per-day valid? */
function restOkAdding(pb: Problem, slotPerson: Int32Array, p: number, addInst: number): boolean {
  const insts = personWorkingInsts(pb, slotPerson, p);
  if (!insts.includes(addInst)) insts.push(addInst);
  insts.sort((a, b) => pb.insts[a].startAbs - pb.insts[b].startAbs);
  const perDay = new Map<number, number>();
  for (const i of insts) {
    const d = pb.insts[i].absDay;
    const c = (perDay.get(d) ?? 0) + 1;
    if (c > pb.maxDutiesPerDay) return false;
    perDay.set(d, c);
  }
  for (let k = 1; k < insts.length; k++) {
    if (pb.insts[insts[k]].startAbs - pb.insts[insts[k - 1]].endAbs < pb.restMin) return false;
  }
  return true;
}

export function localSearch(
  pb: Problem,
  slotPerson: Int32Array,
  rng: Rng,
  iterations: number,
): { best: Int32Array; cost: number } {
  const ev = new Evaluator(pb);
  let curCost = ev.evaluate(slotPerson).cost;
  let best = Int32Array.from(slotPerson);
  let bestCost = curCost;

  // instances that have >= 2 occupied rooms (room-swap candidates)
  const swappableInsts = pb.insts
    .map((_, i) => i)
    .filter((i) => {
      const rooms = new Set(pb.slotsByInst[i].map((s) => pb.slotRoom[s]));
      return rooms.size >= 2 && pb.slotsByInst[i].length >= 2;
    });

  // per-instance available pool (for swap-in-out when there's a bench)
  const benchByInst: number[][] = [];
  for (let i = 0; i < pb.I; i++) {
    const list: number[] = [];
    for (let p = 0; p < pb.P; p++) if (pb.avail[i * pb.P + p]) list.push(p);
    benchByInst.push(list);
  }
  const benchInsts = pb.insts.map((_, i) => i).filter((i) => benchByInst[i].length > pb.slotsInInst);

  if (swappableInsts.length === 0 && benchInsts.length === 0) return { best, cost: bestCost };

  const T0 = Math.max(1, curCost * 0.0005);
  let T = T0;
  const cooling = Math.pow(0.02, 1 / Math.max(1, iterations)); // T0 -> ~2% of T0

  const accept = (newCost: number): boolean => {
    const d = newCost - curCost;
    if (d <= 0 || rng() < Math.exp(-d / Math.max(1e-9, T))) {
      curCost = newCost;
      if (newCost < bestCost) {
        bestCost = newCost;
        best = Int32Array.from(slotPerson);
      }
      return true;
    }
    return false;
  };

  for (let it = 0; it < iterations; it++, T *= cooling) {
    // swap-in-out: bench a working person, bring in an available one (rotation)
    if (benchInsts.length > 0 && (swappableInsts.length === 0 || rng() < 0.35)) {
      const i = benchInsts[randInt(rng, benchInsts.length)];
      const slots = pb.slotsByInst[i];
      const s = slots[randInt(rng, slots.length)];
      const pIn = slotPerson[s];
      if (pIn < 0) continue;
      const r = pb.slotRoom[s];
      const cand = benchByInst[i];
      const pOut = cand[randInt(rng, cand.length)];
      if (pOut === pIn) continue;
      let alreadyWorking = false;
      for (const ss of slots)
        if (slotPerson[ss] === pOut) {
          alreadyWorking = true;
          break;
        }
      if (alreadyWorking) continue;
      const members = membersOfRoomAtInst(pb, slotPerson, i, r).filter((x) => x !== pIn);
      members.push(pOut);
      if (!roomOk(pb, members)) continue;
      if (!restOkAdding(pb, slotPerson, pOut, i)) continue;
      slotPerson[s] = pOut;
      if (!accept(ev.evaluate(slotPerson).cost)) slotPerson[s] = pIn;
      continue;
    }

    if (swappableInsts.length === 0) continue;
    // swap-rooms: two people in the same instance exchange rooms
    const i = swappableInsts[randInt(rng, swappableInsts.length)];
    const slots = pb.slotsByInst[i];
    const s1 = slots[randInt(rng, slots.length)];
    const s2 = slots[randInt(rng, slots.length)];
    if (pb.slotRoom[s1] === pb.slotRoom[s2]) continue;
    const p1 = slotPerson[s1];
    const p2 = slotPerson[s2];
    if (p1 < 0 || p2 < 0 || p1 === p2) continue;
    const r1 = pb.slotRoom[s1];
    const r2 = pb.slotRoom[s2];
    const m1 = membersOfRoomAtInst(pb, slotPerson, i, r1).filter((x) => x !== p1);
    m1.push(p2);
    const m2 = membersOfRoomAtInst(pb, slotPerson, i, r2).filter((x) => x !== p2);
    m2.push(p1);
    if (!roomOk(pb, m1) || !roomOk(pb, m2)) continue;
    slotPerson[s1] = p2;
    slotPerson[s2] = p1;
    if (!accept(ev.evaluate(slotPerson).cost)) {
      slotPerson[s1] = p1;
      slotPerson[s2] = p2;
    }
  }

  return { best, cost: bestCost };
}

// ----------------------------- report --------------------------------------

export function buildReport(pb: Problem, slotPerson: Int32Array, infeasibilities: string[]): FairnessReport {
  const ev = new Evaluator(pb);
  const detail: Record<string, number> = {};
  const { penalty, hard } = ev.evaluate(slotPerson, detail);

  const perPerson: PersonStat[] = [];
  for (let p = 0; p < pb.P; p++) {
    const roomCount: Record<string, number> = {};
    for (let r = 0; r < pb.R; r++) roomCount[pb.rooms[r].id] = ev.roomCount[p * pb.R + r];
    perPerson.push({
      personId: pb.people[p].id,
      name: pb.people[p].name,
      load: ev.load[p],
      roomCount,
      difficultExposure: ev.exposure[p],
      nightCount: ev.night[p],
    });
  }

  // spreads
  const loads = perPerson.map((s) => s.load);
  const loadSpread = Math.max(...loads) - Math.min(...loads);
  let roomMaxSpread = 0;
  for (let r = 0; r < pb.R; r++) {
    const counts = perPerson.map((s) => s.roomCount[pb.rooms[r].id]);
    roomMaxSpread = Math.max(roomMaxSpread, Math.max(...counts) - Math.min(...counts));
  }
  const nonDiff = perPerson.filter((_, p) => !pb.difficult[p]).map((s) => s.difficultExposure);
  const expSpread = nonDiff.length ? Math.max(...nonDiff) - Math.min(...nonDiff) : 0;

  const targets = {
    load: pb.targetLoad,
    room: Object.fromEntries(pb.rooms.map((r, i) => [r.id, pb.targetRoom[i]])),
    exposure:
      pb.nDifficult > 0 && nonDiff.length ? nonDiff.reduce((a, b) => a + b, 0) / nonDiff.length : 0,
  };

  // fairness score 0-100 from relative spreads
  const rel = (spread: number, target: number) => (target > 0 ? Math.min(1, spread / (target * 2)) : 0);
  const parts: number[] = [];
  for (let r = 0; r < pb.R; r++) {
    const counts = perPerson.map((s) => s.roomCount[pb.rooms[r].id]);
    parts.push(rel(Math.max(...counts) - Math.min(...counts), pb.targetRoom[r]));
  }
  parts.push(rel(loadSpread, pb.targetLoad));
  if (pb.nDifficult > 0) parts.push(rel(expSpread, targets.exposure));
  const devIndex = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  const fairnessScore = Math.round(100 * Math.max(0, 1 - devIndex));

  return {
    feasible: hard === 0 && infeasibilities.length === 0,
    hardViolations: hard,
    penalty,
    fairnessScore,
    perPerson,
    targets,
    spreads: { load: loadSpread, roomMax: roomMaxSpread, exposure: expSpread },
    avoidViolations: detail._avoidShared ?? 0,
    neverAloneViolations: detail._neverAloneViol ?? 0,
    wantSatisfied: detail._wantShared ?? 0,
    twoRoomCount: detail._twoRoom ?? 0,
    breakdown: detail,
    infeasibilities,
  };
}

// ----------------------------- orchestrator --------------------------------

function toAssignments(pb: Problem, slotPerson: Int32Array): Assignment[] {
  const out: Assignment[] = [];
  // track slot index within (inst, room)
  const counter = new Map<string, number>();
  for (let s = 0; s < slotPerson.length; s++) {
    const p = slotPerson[s];
    if (p < 0) continue;
    const i = pb.slotInst[s];
    const r = pb.slotRoom[s];
    const inst = pb.insts[i];
    const key = `${i}:${r}`;
    const idx = counter.get(key) ?? 0;
    counter.set(key, idx + 1);
    out.push({
      date: inst.date,
      shiftId: pb.shifts[inst.shiftIdx].id,
      roomId: pb.rooms[r].id,
      slotIndex: idx,
      personId: pb.people[p].id,
    });
  }
  return out;
}

export function solve(input: ScheduleInput): SolveResult {
  const pb = buildProblem(input);
  const infeasibilities = checkFeasibility(pb);
  const seed = input.seed ?? 1;
  const restarts = input.restarts ?? 4;
  const iterations =
    input.iterations ?? Math.min(60_000, Math.max(15_000, pb.slotInst.length * 250));

  let bestSlots: Int32Array | null = null;
  let bestCost = Infinity;

  for (let r = 0; r < restarts; r++) {
    const rng = makeRng(seed + r * 7919);
    const seedSlots = construct(pb, rng);
    const { best, cost } = localSearch(pb, seedSlots, rng, iterations);
    if (cost < bestCost) {
      bestCost = cost;
      bestSlots = best;
    }
  }

  const finalSlots = bestSlots ?? construct(pb, makeRng(seed));
  const report = buildReport(pb, finalSlots, infeasibilities);

  return {
    assignments: toAssignments(pb, finalSlots),
    report,
    seed,
    iterations,
  };
}
