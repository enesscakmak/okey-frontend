"use client";

import React, { useState } from "react";
import { OptimizationResult as OptRes, TileSet, Tile } from "@/lib/okey-optimizer";
import TileCard from "./TileCard";

interface OptimizationResultProps {
  pointsResult: OptRes;
  doublesResult: OptRes;
  recommended: "points" | "doubles";
}

export default function OptimizationResult({ pointsResult, doublesResult, recommended }: OptimizationResultProps) {
  const [activeTab, setActiveTab] = useState<"points" | "doubles">(recommended);

  const res = activeTab === "points" ? pointsResult : doublesResult;

  return (
    <div className="fade-in" style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", justifyContent: "center" }}>
        <button 
          className={`btn ${activeTab === "points" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("points")}
        >
          {pointsResult.label} {recommended === "points" && "🌟"}
        </button>
        <button 
          className={`btn ${activeTab === "doubles" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("doubles")}
        >
          {doublesResult.label} {recommended === "doubles" && "🌟"}
        </button>
      </div>

      <div className={`result-panel ${recommended === activeTab ? "recommended" : ""} ${res.canOpen ? "can-open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div className={`result-badge ${res.canOpen ? "badge-open" : "badge-closed"}`}>
              {res.canOpen ? "✅ Açabilirsin" : "❌ Açamazsın"}
            </div>
            {recommended === activeTab && (
              <div className="result-badge badge-recommended" style={{ marginLeft: "0.5rem" }}>
                Tavsiye Edilen
              </div>
            )}
            <h3 className="result-title">{res.label}</h3>
          </div>
          
          <div className="result-stats">
            <div className="stat-item">
              <span className="stat-label">Toplam Puan</span>
              <span className={`stat-value ${activeTab === "points" && res.canOpen ? "success" : ""}`}>
                {res.totalPointsInSets}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Ceza Puanı</span>
              <span className={`stat-value ${res.penalty > 0 ? "danger" : "success"}`}>
                {res.penalty}
              </span>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        <div className="sets-section">
          <div style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Açılacak Setler ({res.sets.length}):
          </div>
          
          {res.sets.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-sm)" }}>
              Hiç set bulunamadı.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {res.sets.map((set, i) => (
                <div key={i} className="set-group">
                  <div className={`set-group-label ${set.type}-label`}>
                    {set.type.toUpperCase()} ({set.pointValue} pts)
                  </div>
                  <div className="set-tiles">
                    {set.tiles.map((t, j) => (
                      <TileCard key={j} tile={t} isSelected />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="leftover-section">
          <div className="leftover-label">Elde Kalan Taşlar ({res.leftover.length}):</div>
          <div className="leftover-tiles">
            {res.leftover.length === 0 ? (
              <span style={{ fontSize: "0.85rem", color: "var(--success)" }}>Hiç taş kalmadı! Mükemmel!</span>
            ) : (
              res.leftover.map((t, i) => (
                <TileCard key={i} tile={t} isLeftover />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
