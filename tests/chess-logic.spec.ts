import { expect, test } from "@playwright/test";

import { calculateStandings, createInitialBoard, createPairings, movePiece, normalizeNames, pairingHistory } from "@/lib/chess";

test.describe("skak-klasselogik", () => {
  test("sætter et normalt startbræt og flytter en valgt brik", () => {
    const start = createInitialBoard();
    expect(start.e1).toEqual({ color: "white", kind: "king" });
    expect(start.e8).toEqual({ color: "black", kind: "king" });

    const moved = movePiece(start, "e2", "e4");
    expect(moved.e2).toBeNull();
    expect(moved.e4).toEqual({ color: "white", kind: "pawn" });
  });

  test("renser klasselisten og undgår samme modstander ved ny runde, når det er muligt", () => {
    const names = normalizeNames("Amina\n Jonas\nAmina\nSofia\nEmil");
    expect(names).toEqual(["Amina", "Jonas", "Sofia", "Emil"]);

    const firstRound = createPairings(names);
    const secondRound = createPairings(names, pairingHistory(firstRound));
    const firstPairs = pairingHistory(firstRound);
    const secondPairs = pairingHistory(secondRound);

    for (const pair of secondPairs) expect(firstPairs.has(pair)).toBeFalsy();
  });

  test("regner sejr og remis ind i den enkle stilling", () => {
    const standings = calculateStandings(["Amina", "Jonas", "Sofia", "Emil"], [
      { round: 1, board: 1, white: "Amina", black: "Jonas", result: "white" },
      { round: 1, board: 2, white: "Sofia", black: "Emil", result: "draw" },
    ]);

    expect(standings).toEqual([
      { name: "Amina", points: 1 },
      { name: "Emil", points: 0.5 },
      { name: "Sofia", points: 0.5 },
      { name: "Jonas", points: 0 },
    ]);
  });
});
