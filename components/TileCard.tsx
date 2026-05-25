"use client";

import React, { useState, useRef, useEffect } from "react";
import { Tile, TileColor, COLORS } from "@/lib/okey-optimizer";

interface TileCardProps {
  tile: Tile;
  isSelected?: boolean;
  isLeftover?: boolean;
  interactive?: boolean;
  onChange?: (newColor: TileColor, newNumber: number, isSahteOkey: boolean) => void;
}

export default function TileCard({ tile, isSelected, isLeftover, interactive, onChange }: TileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    }
    if (isEditing) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  let cssClass = "tile ";
  if (tile.isSahteOkey) cssClass += "tile-joker ";
  else if (tile.isOkey) cssClass += "tile-okey ";
  else cssClass += `tile-${tile.color} `;

  if (isSelected) cssClass += "tile-selected ";
  if (isLeftover) cssClass += "tile-leftover ";
  if (interactive) cssClass += "tile-interactive ";

  const handleEditClick = () => {
    if (interactive) setIsEditing(!isEditing);
  };

  const handleSave = (color: TileColor, num: number, sahteOkey: boolean) => {
    if (onChange) onChange(color, num, sahteOkey);
    setIsEditing(false);
  };

  return (
    <div className="tile-edit-wrap">
      <div className={cssClass} onClick={handleEditClick} title={tile.id}>
        <div className="tile-number">{tile.isSahteOkey ? "J" : tile.number}</div>
        {!tile.isSahteOkey && !tile.isOkey && (
          <div className="tile-color-label">{tile.color}</div>
        )}
      </div>

      {isEditing && interactive && (
        <div className="tile-edit-dropdown" ref={dropdownRef}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Edit Tile</div>
          <div className="tile-edit-row">
            <select
              className="form-select"
              style={{ padding: "0.3rem", fontSize: "0.85rem", width: "100%" }}
              value={tile.isSahteOkey ? "joker" : tile.color}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "joker") handleSave("red", 1, true); // arbitrary color/num for joker, logic ignores it
                else handleSave(val as TileColor, tile.number, false);
              }}
            >
              <option value="red">Red</option>
              <option value="blue">Blue</option>
              <option value="black">Black</option>
              <option value="yellow">Yellow</option>
              <option value="joker">Sahte Okey (Joker)</option>
            </select>
          </div>
          {!tile.isSahteOkey && (
            <div className="tile-edit-row">
              <select
                className="form-select"
                style={{ padding: "0.3rem", fontSize: "0.85rem", width: "100%" }}
                value={tile.number}
                onChange={(e) => handleSave(tile.color, parseInt(e.target.value, 10), false)}
              >
                {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
