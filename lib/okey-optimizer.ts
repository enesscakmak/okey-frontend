/**
 * Okey Game Optimizer
 *
 * Rules modelled:
 * - 4 colors: red, blue, black, yellow; numbers 1–13 (×2 per color = 104 + 2 jokers = 106 tiles)
 * - Gösterge → Okey (next number, same color; 13 wraps to 1)
 * - Sahte Okey (joker printed tile) represents the same tile as Okey
 * - Okey tile in hand = universal wild (substitutes any tile in any set)
 * - Sahte Okey = joker tile = acts like the okey tile VALUE (not universal wild)
 *   (e.g. if okey = red_5, sahte okey acts as red_5 in sets)
 * - 2 Sahte Okey tiles are identical → can form a çift (double) together
 *
 * Set types:
 * - Seri (run):  3–5 consecutive numbers, SAME color
 * - Grup (group): 3–5 same numbers, DIFFERENT colors (max 4)
 * - Çift (double): exactly 2 tiles of same number AND same color
 *
 * Opening methods:
 * 1. 101+ points: total pip value of tiles in valid sets ≥ 101
 * 2. 5+ çift: at least 5 çift; penalty = leftover × 2
 */

export type TileColor = "red" | "blue" | "black" | "yellow";
export const COLORS: TileColor[] = ["red", "blue", "black", "yellow"];

export const COLOR_LABELS: Record<TileColor, string> = {
  red: "Kırmızı",
  blue: "Mavi",
  black: "Siyah",
  yellow: "Sarı",
};

export interface Tile {
  id: string;          // unique id e.g. "red_5_0"
  color: TileColor;
  number: number;      // 1–13
  isOkey: boolean;     // true = universal wild (the actual okey tile)
  isSahteOkey: boolean; // true = printed joker tile
  // Resolved value when sahte okey is in play
  resolvedColor?: TileColor;
  resolvedNumber?: number;
}

export type SetType = "seri" | "grup" | "cift";

export const SET_TYPE_LABELS: Record<SetType, string> = {
  seri: "Seri",
  grup: "Grup",
  cift: "Çift",
};

export interface TileSet {
  type: SetType;
  tiles: Tile[];
  pointValue: number; // sum of pip values
  usesOkey: boolean;
  usesSahteOkey: boolean;
}

export interface OptimizationResult {
  method: "points" | "doubles";
  sets: TileSet[];
  leftover: Tile[];
  penalty: number;
  totalPointsInSets: number;
  canOpen: boolean;
  label: string;
}

export interface OptimizerInput {
  tiles: Tile[];
  gostergeFlagged: boolean; // gösterge tile is on the floor and acts as wild for doubles
}

// ── Tile parsing ─────────────────────────────────────────────────────────────

export function parseTileLabel(
  label: string,
  index: number,
  okeyColor: TileColor,
  okeyNumber: number
): Tile {
  const isSahteOkey = label === "joker";
  const isOkeyRaw = label === "okey";

  let color: TileColor = "red";
  let number = 1;

  if (!isSahteOkey && !isOkeyRaw) {
    const parts = label.split("_");
    color = parts[0] as TileColor;
    number = parseInt(parts[1], 10);
  }

  // "okey" label from detector means the actual okey tile (red_5 etc)
  if (isOkeyRaw) {
    color = okeyColor;
    number = okeyNumber;
  }

  // Sahte okey resolves to the okey tile's color+number
  const resolvedColor = isSahteOkey ? okeyColor : color;
  const resolvedNumber = isSahteOkey ? okeyNumber : number;

  const isOkey = !isSahteOkey && color === okeyColor && number === okeyNumber;

  return {
    id: `${label}_${index}`,
    color,
    number,
    isOkey,
    isSahteOkey,
    resolvedColor,
    resolvedNumber,
  };
}

export function deriveOkey(gostergeColor: TileColor, gostergeNumber: number): { color: TileColor; number: number } {
  const nextNumber = gostergeNumber === 13 ? 1 : gostergeNumber + 1;
  return { color: gostergeColor, number: nextNumber };
}

// Tile pip value
function pipValue(tile: Tile): number {
  if (tile.isSahteOkey) return tile.resolvedNumber ?? 0;
  if (tile.isOkey) return tile.number; // okey tile counts as its own number
  return tile.number;
}

// ── Set generation ────────────────────────────────────────────────────────────

/**
 * Returns resolved (color, number) for a tile for set-matching purposes.
 * Okey (universal wild) is handled separately.
 */
function resolved(tile: Tile): { color: TileColor; number: number } {
  return {
    color: tile.resolvedColor ?? tile.color,
    number: tile.resolvedNumber ?? tile.number,
  };
}

/**
 * Check if a set of tiles forms a valid SERI (run).
 * Seri: 3–5 tiles, same color, consecutive numbers (no okey wilds handled separately)
 */
function isSeri(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 5) return false;
  const nonWild = tiles.filter((t) => !t.isOkey);
  const wilds = tiles.filter((t) => t.isOkey);

  if (nonWild.length === 0) return false;

  // All non-wild must be same color (using resolved color)
  const colors = new Set(nonWild.map((t) => resolved(t).color));
  if (colors.size > 1) return false;

  const numbers = nonWild.map((t) => resolved(t).number).sort((a, b) => a - b);

  // Must be a valid run when wilds fill gaps
  // Find min and max with wilds considered
  const min = numbers[0];
  const max = numbers[numbers.length - 1];
  const span = max - min + 1;

  if (span > 5) return false;
  if (span < tiles.length - wilds.length) return false;

  // Check for duplicates among non-wild
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return false;

  // Wilds must be able to fill the gaps
  const gaps = span - numbers.length;
  return gaps <= wilds.length;
}

/**
 * Check if a set of tiles forms a valid GRUP (group).
 * Grup: 3–4 tiles, same number, different colors (sahte okey acts as okey's resolved value).
 * Max is 4 because there are only 4 colors; an okey wild replaces a missing color, not a 5th one.
 */
function isGrup(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false; // max 4: one tile per color (red/blue/black/yellow)
  const nonWild = tiles.filter((t) => !t.isOkey);

  if (nonWild.length === 0) return false;

  // All non-wild must have same number (resolved)
  const numbers = new Set(nonWild.map((t) => resolved(t).number));
  if (numbers.size > 1) return false;

  // Colors must all be different
  const colors = nonWild.map((t) => resolved(t).color);
  const uniqueColors = new Set(colors);
  if (uniqueColors.size !== colors.length) return false;

  // With wilds: total unique colors should not exceed 4
  const wilds = tiles.filter((t) => t.isOkey);
  if (uniqueColors.size + wilds.length > 4) return false;

  return true;
}

/**
 * Check if two tiles form a valid ÇIFT (double).
 * Same number AND same color (using resolved values).
 */
function isCift(a: Tile, b: Tile): boolean {
  const ra = resolved(a);
  const rb = resolved(b);
  return ra.color === rb.color && ra.number === rb.number;
}

// ── Candidate set finder ──────────────────────────────────────────────────────

/**
 * Generate all valid sets (seri + grup) of sizes 3–5 from a given tile list.
 * Brute force with pruning; hand has ≤22 tiles so this is feasible.
 */
function generateCandidateSets(tiles: Tile[]): TileSet[] {
  const candidates: TileSet[] = [];
  const n = tiles.length;

  for (let size = 3; size <= 5; size++) {
    // Generate combinations of `size` from tiles
    const combos = combinations(tiles, size);
    for (const combo of combos) {
      if (isSeri(combo) || isGrup(combo)) {
        const pts = combo.reduce((s, t) => s + pipValue(t), 0);
        candidates.push({
          type: isSeri(combo) ? "seri" : "grup",
          tiles: combo,
          pointValue: pts,
          usesOkey: combo.some((t) => t.isOkey),
          usesSahteOkey: combo.some((t) => t.isSahteOkey),
        });
      }
    }
  }

  return candidates;
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// ── Main optimizer ────────────────────────────────────────────────────────────

type TileKey = string; // tile.id
type StateKey = string; // sorted join of remaining tile ids

const memo = new Map<StateKey, { sets: TileSet[]; points: number }>();

function stateKey(remaining: Tile[]): StateKey {
  return remaining
    .map((t) => t.id)
    .sort()
    .join("|");
}

/**
 * DFS + memoization to maximize total point value of tiles placed in valid sets.
 */
function solvePoints(
  remaining: Tile[],
  candidates: TileSet[],
  usedIds: Set<TileKey>
): { sets: TileSet[]; points: number } {
  const key = stateKey(remaining);
  if (memo.has(key)) return memo.get(key)!;

  let best: { sets: TileSet[]; points: number } = { sets: [], points: 0 };

  const remainingIds = new Set(remaining.map((t) => t.id));

  for (const candidate of candidates) {
    // Can we place this set? All tile ids must be in remaining
    if (!candidate.tiles.every((t) => remainingIds.has(t.id))) continue;

    const newRemaining = remaining.filter(
      (t) => !candidate.tiles.find((ct) => ct.id === t.id)
    );

    const sub = solvePoints(newRemaining, candidates, usedIds);
    const total = candidate.pointValue + sub.points;

    if (total > best.points) {
      best = { sets: [candidate, ...sub.sets], points: total };
    }
  }

  memo.set(key, best);
  return best;
}

/**
 * Find maximum number of çift (doubles) in the hand.
 * Returns array of [tileA, tileB] pairs.
 */
function findMaxCift(tiles: Tile[], gostergeFlagged: boolean, gosterge?: { color: TileColor; number: number }): [Tile, Tile][] {
  const used = new Set<string>();
  const pairs: [Tile, Tile][] = [];

  // Group by resolved color+number
  const groups = new Map<string, Tile[]>();
  for (const tile of tiles) {
    const r = resolved(tile);
    const key = `${r.color}_${r.number}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tile);
  }

  for (const [, group] of groups) {
    let i = 0;
    while (i + 1 < group.length) {
      const a = group[i];
      const b = group[i + 1];
      if (!used.has(a.id) && !used.has(b.id)) {
        pairs.push([a, b]);
        used.add(a.id);
        used.add(b.id);
        i += 2;
      } else {
        i++;
      }
    }
  }

  return pairs;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function optimize(
  rawTiles: Tile[],
  gostergeFlagged: boolean,
  gosterge?: { color: TileColor; number: number }
): { points: OptimizationResult; doubles: OptimizationResult; recommended: "points" | "doubles" } {
  memo.clear();

  const tiles = rawTiles;
  const candidates = generateCandidateSets(tiles);

  // ── Method 1: Point opening ──────────────────────────────────────────────
  const pointSolution = solvePoints(tiles, candidates, new Set());
  const pointLeftover = tiles.filter(
    (t) => !pointSolution.sets.flatMap((s) => s.tiles).find((st) => st.id === t.id)
  );
  const pointPenalty = pointLeftover.reduce((s, t) => s + pipValue(t), 0);
  const canOpenPoints = pointSolution.points >= 101;

  const pointsResult: OptimizationResult = {
    method: "points",
    sets: pointSolution.sets,
    leftover: pointLeftover,
    penalty: pointPenalty,
    totalPointsInSets: pointSolution.points,
    canOpen: canOpenPoints,
    label: "101+ Puan Açılışı",
  };

  // ── Method 2: Doubles opening ──────────────────────────────────────────
  const pairs = findMaxCift(tiles, gostergeFlagged, gosterge);
  const usedInPairs = new Set(pairs.flat().map((t) => t.id));
  const remainingAfterPairs = tiles.filter((t) => !usedInPairs.has(t.id));

  // Doubles opening ONLY uses doubles (çift). Normal sets are not allowed alongside doubles.
  const doublesUsedIds = new Set(usedInPairs);
  const doublesLeftover = tiles.filter((t) => !doublesUsedIds.has(t.id));
  const doublesPenalty = doublesLeftover.reduce((s, t) => s + pipValue(t), 0) * 2;
  const canOpenDoubles = pairs.length >= 5;

  const pairSets: TileSet[] = pairs.map(([a, b]) => ({
    type: "cift",
    tiles: [a, b],
    pointValue: pipValue(a) + pipValue(b),
    usesOkey: a.isOkey || b.isOkey,
    usesSahteOkey: a.isSahteOkey || b.isSahteOkey,
  }));

  const doublesResult: OptimizationResult = {
    method: "doubles",
    sets: pairSets,
    leftover: doublesLeftover,
    penalty: doublesPenalty,
    totalPointsInSets: pairSets.reduce((s, p) => s + p.pointValue, 0),
    canOpen: canOpenDoubles,
    label: "5 Çift Açılışı",
  };

  // ── Recommend the better opening ─────────────────────────────────────────
  // Prefer the one that CAN open; if both can, prefer lower penalty
  let recommended: "points" | "doubles" = "points";
  if (canOpenDoubles && !canOpenPoints) recommended = "doubles";
  else if (canOpenPoints && canOpenDoubles) {
    recommended = pointPenalty <= doublesPenalty ? "points" : "doubles";
  } else if (!canOpenPoints && !canOpenDoubles) {
    // Neither opens — recommend whichever has less penalty
    recommended = pointPenalty <= doublesPenalty ? "points" : "doubles";
  }

  return { points: pointsResult, doubles: doublesResult, recommended };
}
