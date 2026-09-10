"use client";

import { files, ranks, type ChessBoardState, type ChessPiece } from "@/lib/chess";

type ChessBoardProps = {
  board: ChessBoardState;
  coordinates?: boolean;
  flipped?: boolean;
  lastMove?: { from: string; to: string } | null;
  onMove?: (from: string, to: string) => void;
  onSquareEdit?: (square: string) => void;
  selectedSquare?: string | null;
};

const pieceSymbols: Record<ChessPiece["color"], Record<ChessPiece["kind"], string>> = {
  white: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  black: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" },
};

const pieceNames: Record<ChessPiece["kind"], string> = {
  king: "konge",
  queen: "dronning",
  rook: "tårn",
  bishop: "løber",
  knight: "springer",
  pawn: "bonde",
};

export default function ChessBoard({
  board,
  coordinates = true,
  flipped = false,
  lastMove,
  onMove,
  onSquareEdit,
  selectedSquare,
}: ChessBoardProps) {
  const visibleFiles = flipped ? [...files].reverse() : [...files];
  const visibleRanks = flipped ? [...ranks].reverse() : [...ranks];

  const handleSquareClick = (square: string) => {
    if (onSquareEdit) {
      onSquareEdit(square);
      return;
    }
    if (!onMove || !selectedSquare) return;
    onMove(selectedSquare, square);
  };

  return (
    <div className="w-full max-w-[min(82vh,48rem)]" data-testid="chess-board">
      <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-xl border-4 border-[var(--skolegps-deep-navy)] bg-[var(--skolegps-deep-navy)] shadow-[0_24px_60px_rgba(7,26,58,0.24)]">
        {visibleRanks.flatMap((rank, rowIndex) =>
          visibleFiles.map((file, columnIndex) => {
            const square = `${file}${rank}`;
            const piece = board[square];
            const isLight = (rowIndex + columnIndex) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isLastMove = lastMove?.from === square || lastMove?.to === square;
            const label = piece
              ? `${piece.color === "white" ? "Hvid" : "Sort"} ${pieceNames[piece.kind]} på ${square}`
              : `Tomt felt ${square}`;

            return (
              <button
                key={square}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => handleSquareClick(square)}
                className={`relative flex min-h-0 min-w-0 items-center justify-center text-[clamp(1.65rem,7.4vw,5rem)] leading-none transition focus-visible:z-10 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-sky-500 ${
                  isLight ? "bg-[#f5e6c8] text-[#183450]" : "bg-[#729768] text-[#102f27]"
                } ${isSelected ? "ring-4 ring-inset ring-amber-400" : ""} ${
                  isLastMove ? "after:absolute after:inset-1 after:border-2 after:border-amber-400/90 after:content-['']" : ""
                }`}
              >
                {coordinates && columnIndex === 0 ? (
                  <span className={`absolute top-1 left-1 text-[clamp(0.5rem,1.4vw,0.76rem)] font-black ${isLight ? "text-[#729768]" : "text-[#f5e6c8]"}`}>
                    {rank}
                  </span>
                ) : null}
                {coordinates && rowIndex === 7 ? (
                  <span className={`absolute right-1 bottom-0.5 text-[clamp(0.5rem,1.4vw,0.76rem)] font-black lowercase ${isLight ? "text-[#729768]" : "text-[#f5e6c8]"}`}>
                    {file}
                  </span>
                ) : null}
                <span aria-hidden="true" className="relative z-[1] drop-shadow-[0_2px_1px_rgba(255,255,255,0.38)]">
                  {piece ? pieceSymbols[piece.color][piece.kind] : ""}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
