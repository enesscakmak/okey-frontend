/** Okey açılış optimizasyonu: seri/grup/çift kuralları, 101 puan veya 5 çift açılışı. */

export type TileColor = "red" | "blue" | "black" | "yellow";
export const COLORS: TileColor[] = ["red", "blue", "black", "yellow"];

export const COLOR_LABELS: Record<TileColor, string> = {
  red: "Kırmızı",
  blue: "Mavi",
  black: "Siyah",
  yellow: "Sarı",
};

export interface Tile {
  id: string;
  color: TileColor;
  number: number;
  isOkey: boolean;
  isSahteOkey: boolean;
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
  pointValue: number;
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
  gostergeFlagged: boolean;
}

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

  if (isOkeyRaw) {
    color = okeyColor;
    number = okeyNumber;
  }

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

function pipValue(tile: Tile): number {
  if (tile.isSahteOkey) return tile.resolvedNumber ?? 0;
  if (tile.isOkey) return tile.number;
  return tile.number;
}

function resolved(tile: Tile): { color: TileColor; number: number } {
  return {
    color: tile.resolvedColor ?? tile.color,
    number: tile.resolvedNumber ?? tile.number,
  };
}

function isSeri(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 5) return false;
  const nonWild = tiles.filter((t) => !t.isOkey);
  const wilds = tiles.filter((t) => t.isOkey);

  if (nonWild.length === 0) return false;

  const colors = new Set(nonWild.map((t) => resolved(t).color));
  if (colors.size > 1) return false;

  const numbers = nonWild.map((t) => resolved(t).number).sort((a, b) => a - b);

  const min = numbers[0];
  const max = numbers[numbers.length - 1];
  const span = max - min + 1;

  if (span > 5) return false;
  if (span < tiles.length - wilds.length) return false;

  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return false;

  const gaps = span - numbers.length;
  return gaps <= wilds.length;
}

function isGrup(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const nonWild = tiles.filter((t) => !t.isOkey);

  if (nonWild.length === 0) return false;

  const numbers = new Set(nonWild.map((t) => resolved(t).number));
  if (numbers.size > 1) return false;

  const colors = nonWild.map((t) => resolved(t).color);
  const uniqueColors = new Set(colors);
  if (uniqueColors.size !== colors.length) return false;

  const wilds = tiles.filter((t) => t.isOkey);
  if (uniqueColors.size + wilds.length > 4) return false;

  return true;
}

function isCift(a: Tile, b: Tile): boolean {
  const ra = resolved(a);
  const rb = resolved(b);
  return ra.color === rb.color && ra.number === rb.number;
}

function generateCandidateSets(tiles: Tile[]): TileSet[] {
  const candidates: TileSet[] = [];

  for (let size = 3; size <= 5; size++) {
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

type TileKey = string;
type StateKey = string;

const memo = new Map<StateKey, { sets: TileSet[]; points: number }>();

function stateKey(remaining: Tile[]): StateKey {
  return remaining
    .map((t) => t.id)
    .sort()
    .join("|");
}

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

function findMaxCift(tiles: Tile[], gostergeFlagged: boolean, gosterge?: { color: TileColor; number: number }): [Tile, Tile][] {
  const used = new Set<string>();
  const pairs: [Tile, Tile][] = [];

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

export function optimize(
  rawTiles: Tile[],
  gostergeFlagged: boolean,
  gosterge?: { color: TileColor; number: number }
): { points: OptimizationResult; doubles: OptimizationResult; recommended: "points" | "doubles" } {
  memo.clear();

  const tiles = rawTiles;
  const candidates = generateCandidateSets(tiles);

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

  const pairs = findMaxCift(tiles, gostergeFlagged, gosterge);
  const usedInPairs = new Set(pairs.flat().map((t) => t.id));

  // Çifte açılışta yalnızca çiftler geçerli; seri/grup eklenemez.
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

  let recommended: "points" | "doubles" = "points";
  if (canOpenDoubles && !canOpenPoints) recommended = "doubles";
  else if (canOpenPoints && canOpenDoubles) {
    recommended = pointPenalty <= doublesPenalty ? "points" : "doubles";
  } else if (!canOpenPoints && !canOpenDoubles) {
    recommended = pointPenalty <= doublesPenalty ? "points" : "doubles";
  }

  return { points: pointsResult, doubles: doublesResult, recommended };
}
