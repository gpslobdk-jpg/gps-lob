export type ChessColor = "white" | "black";
export type ChessPieceKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

export type ChessPiece = {
  color: ChessColor;
  kind: ChessPieceKind;
};

export type ChessBoardState = Record<string, ChessPiece | null>;

export type Pairing = {
  board: number;
  white: string;
  black: string | null;
};

export type MatchResult = "white" | "black" | "draw";

export type TournamentMatch = Pairing & {
  round: number;
  result?: MatchResult;
};

export const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const ranks = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export function createEmptyBoard(): ChessBoardState {
  return Object.fromEntries(files.flatMap((file) => ranks.map((rank) => [`${file}${rank}`, null])));
}

export function createInitialBoard(): ChessBoardState {
  const board = createEmptyBoard();
  const backRank: ChessPieceKind[] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  files.forEach((file, index) => {
    board[`${file}8`] = { color: "black", kind: backRank[index] };
    board[`${file}7`] = { color: "black", kind: "pawn" };
    board[`${file}2`] = { color: "white", kind: "pawn" };
    board[`${file}1`] = { color: "white", kind: backRank[index] };
  });

  return board;
}

export function movePiece(board: ChessBoardState, from: string, to: string): ChessBoardState {
  const piece = board[from];
  if (!piece || from === to) return board;

  return { ...board, [from]: null, [to]: piece };
}

export function setPiece(board: ChessBoardState, square: string, piece: ChessPiece | null): ChessBoardState {
  return { ...board, [square]: piece };
}

export function flipSquare(square: string): string {
  const fileIndex = files.indexOf(square[0] as (typeof files)[number]);
  const rank = Number(square[1]);
  return `${files[files.length - 1 - fileIndex]}${9 - rank}`;
}

export function normalizeNames(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name) => name.length > 0)
    .filter((name) => {
      const key = name.toLocaleLowerCase("da-DK");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function keyForPair(first: string, second: string) {
  return [first.toLocaleLowerCase("da-DK"), second.toLocaleLowerCase("da-DK")].sort().join("|");
}

/** Makes balanced classroom pairs and postpones prior opponents whenever possible. */
export function createPairings(names: string[], priorPairs: Set<string> = new Set()): Pairing[] {
  const waiting = [...names];
  const pairings: Pairing[] = [];

  while (waiting.length > 1) {
    const white = waiting.shift()!;
    const nextIndex = waiting.findIndex((candidate) => !priorPairs.has(keyForPair(white, candidate)));
    const black = waiting.splice(nextIndex >= 0 ? nextIndex : 0, 1)[0];
    pairings.push({ board: pairings.length + 1, white, black });
  }

  if (waiting.length === 1) {
    pairings.push({ board: pairings.length + 1, white: waiting[0], black: null });
  }

  return pairings;
}

export function pairingHistory(pairings: Pairing[]): Set<string> {
  return new Set(
    pairings
      .filter((pairing): pairing is Pairing & { black: string } => Boolean(pairing.black))
      .map((pairing) => keyForPair(pairing.white, pairing.black))
  );
}

export function calculateStandings(names: string[], matches: TournamentMatch[]) {
  const points = new Map(names.map((name) => [name, 0]));

  matches.forEach((match) => {
    if (!match.black || !match.result) return;
    if (match.result === "white") points.set(match.white, (points.get(match.white) ?? 0) + 1);
    if (match.result === "black") points.set(match.black, (points.get(match.black) ?? 0) + 1);
    if (match.result === "draw") {
      points.set(match.white, (points.get(match.white) ?? 0) + 0.5);
      points.set(match.black, (points.get(match.black) ?? 0) + 0.5);
    }
  });

  return names
    .map((name) => ({ name, points: points.get(name) ?? 0 }))
    .sort((first, second) => second.points - first.points || first.name.localeCompare(second.name, "da-DK"));
}
