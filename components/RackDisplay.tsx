"use client";

import React from "react";
import TileCard from "./TileCard";
import { Tile, TileColor, parseTileLabel } from "@/lib/okey-optimizer";

interface RackDisplayProps {
  tiles: Tile[];
  onTilesChange?: (tiles: Tile[]) => void;
  okeyColor: TileColor;
  okeyNumber: number;
}

export default function RackDisplay({ tiles, onTilesChange, okeyColor, okeyNumber }: RackDisplayProps) {
  const handleTileChange = (index: number, color: TileColor, num: number, sahteOkey: boolean) => {
    if (!onTilesChange) return;
    
    // Convert back to string label to re-parse (easiest way to get full derived states)
    const label = sahteOkey ? "joker" : `${color}_${num}`;
    const newTiles = [...tiles];
    newTiles[index] = parseTileLabel(label, index, okeyColor, okeyNumber);
    
    onTilesChange(newTiles);
  };

  if (!tiles || tiles.length === 0) return null;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="rack-count">
        <span>Detected Tiles ({tiles.length})</span>
        {onTilesChange && (
          <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>
            Click any tile to correct its value if detected wrong.
          </span>
        )}
      </div>
      <div className="rack-container">
        {tiles.map((tile, index) => (
          <TileCard
            key={tile.id}
            tile={tile}
            interactive={!!onTilesChange}
            onChange={(c, n, isSahte) => handleTileChange(index, c, n, isSahte)}
          />
        ))}
      </div>
    </div>
  );
}
