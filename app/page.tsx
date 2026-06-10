"use client";

import React, { useState, useRef, useCallback } from "react";
import {
	TileColor,
	COLOR_LABELS,
	Tile,
	OptimizationResult as OptRes,
} from "@/lib/okey-optimizer";
import RackDisplay from "@/components/RackDisplay";
import OptimizationResult from "@/components/OptimizationResult";

export default function Home() {
	const [gostergeColor, setGostergeColor] = useState<TileColor>("red");
	const [gostergeNumber, setGostergeNumber] = useState<number>(4);
	const [gostergeFlagged, setGostergeFlagged] = useState<boolean>(false);

	const [imageFile, setImageFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Results
	const [tiles, setTiles] = useState<Tile[] | null>(null);
	const [okey, setOkey] = useState<{
		color: TileColor;
		number: number;
	} | null>(null);
	const [results, setResults] = useState<{
		points: OptRes;
		doubles: OptRes;
		recommended: "points" | "doubles";
	} | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const derivedOkeyNumber = gostergeNumber === 13 ? 1 : gostergeNumber + 1;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const file = e.target.files[0];
			setImageFile(file);
			setPreviewUrl(URL.createObjectURL(file));
			// Reset state for new photo
			setTiles(null);
			setResults(null);
			setError(null);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.currentTarget.classList.add("drag-over");
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.currentTarget.classList.remove("drag-over");
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.currentTarget.classList.remove("drag-over");
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file.type.startsWith("image/")) {
				setImageFile(file);
				setPreviewUrl(URL.createObjectURL(file));
				setTiles(null);
				setResults(null);
				setError(null);
			}
		}
	};

	const clearImage = () => {
		setImageFile(null);
		setPreviewUrl(null);
		setTiles(null);
		setResults(null);
		setError(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const analyzeRack = async (overrideTiles?: Tile[]) => {
		if (!imageFile && !overrideTiles) return;

		setIsAnalyzing(true);
		setError(null);

		try {
			let tileLabels: string[] = [];

			if (overrideTiles) {
				// Send just the tile labels for re-optimization without hitting Python again
				tileLabels = overrideTiles.map((t) =>
					t.isSahteOkey ? "joker" : `${t.color}_${t.number}`,
				);
			} else if (imageFile) {
				// 1. Call the Flask backend DIRECTLY from the browser to bypass Netlify's 10-second timeout
				const FLASK_URL =
					process.env.NEXT_PUBLIC_FLASK_URL ||
					"http://localhost:5001";
				const flaskForm = new FormData();
				flaskForm.append("image", imageFile);

				let flaskRes: Response;
				try {
					flaskRes = await fetch(`${FLASK_URL}/predict`, {
						method: "POST",
						body: flaskForm,
					});
				} catch (err) {
					throw new Error(
						"Yapay zeka sunucusuna erişilemedi. Lütfen sunucunun açık ve internete bağlı olduğundan emin olun.",
					);
				}

				if (!flaskRes.ok) {
					const errData = await flaskRes.json();
					throw new Error(
						errData.error || "Yapay zeka sunucusu hata verdi.",
					);
				}

				const flaskData = await flaskRes.json();
				tileLabels = flaskData.tiles as string[];
			}

			// 2. Now call our Next.js api to run the fast solver logic with the tile labels
			const formData = new FormData();
			formData.append("gostergeColor", gostergeColor);
			formData.append("gostergeNumber", gostergeNumber.toString());
			formData.append(
				"gostergeFlagged",
				gostergeFlagged ? "true" : "false",
			);
			formData.append("tilesOverride", JSON.stringify(tileLabels));

			const res = await fetch("/api/analyze", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Optimizasyon sunucu hatası.");
			}

			const data = await res.json();

			// We must reconstruct the Tile objects from the response labels so that UI updates correctly
			import("@/lib/okey-optimizer").then((m) => {
				const reconstructedTiles = data.tiles.map(
					(label: string, i: number) =>
						m.parseTileLabel(
							label,
							i,
							data.okey.color,
							data.okey.number,
						),
				);
				setTiles(reconstructedTiles);
				setOkey(data.okey);
				setResults(data.optimization);
			});
		} catch (err: unknown) {
			setError(
				err instanceof Error
					? err.message
					: "Bilinmeyen bir hata oluştu.",
			);
		} finally {
			setIsAnalyzing(false);
		}
	};

	return (
		<main className="container">
			<section className="hero">
				<div className="hero-logo">
					<div className="hero-logo-icon">🀄</div>
				</div>
				<h1>Okey Oyun Asistanı</h1>
				<p>
					İsteka'nızın fotoğrafını çekin, yapay zeka en uygun açılış
					stratejisini hesaplasın.
				</p>
			</section>

			<div className="page-grid">
				{/* Step 1: Game Rules Setup */}
				<div className="glass-card">
					<div className="section-header">
						<span className="section-badge">1</span>
						<h2 className="section-title">Oyun Durumu</h2>
					</div>

					<div className="form-row">
						<div className="form-group">
							<label className="form-label">Gösterge Rengi</label>
							<select
								className="form-select"
								value={gostergeColor}
								onChange={(e) =>
									setGostergeColor(
										e.target.value as TileColor,
									)
								}
							>
								<option value="red">Kırmızı</option>
								<option value="blue">Mavi</option>
								<option value="black">Siyah</option>
								<option value="yellow">Sarı</option>
							</select>
						</div>
						<div className="form-group">
							<label className="form-label">
								Gösterge Sayısı
							</label>
							<select
								className="form-select"
								value={gostergeNumber}
								onChange={(e) =>
									setGostergeNumber(Number(e.target.value))
								}
							>
								{Array.from(
									{ length: 13 },
									(_, i) => i + 1,
								).map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
						</div>

						<div className="form-group">
							<div className="okey-derived">
								<span>Okey Taşı:</span>{" "}
								<strong>
									{COLOR_LABELS[gostergeColor]}{" "}
									{derivedOkeyNumber}
								</strong>
							</div>
						</div>
					</div>

					<div
						className="divider"
						style={{ margin: "1.25rem 0" }}
					></div>

					<label className="checkbox-row">
						<input
							type="checkbox"
							checked={gostergeFlagged}
							onChange={(e) =>
								setGostergeFlagged(e.target.checked)
							}
						/>
						<span className="checkbox-label">
							Göstergeyi bildirdiniz mi? (Çifte giderken joker
							taşı olarak kullanılır)
						</span>
					</label>
				</div>

				{/* Step 2: Upload */}
				<div className="glass-card">
					<div className="section-header">
						<span className="section-badge">2</span>
						<h2 className="section-title">İsteka Fotoğrafı</h2>
					</div>

					{!previewUrl ? (
						<div
							className="upload-zone"
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onClick={() => fileInputRef.current?.click()}
						>
							<span className="upload-zone-icon">📸</span>
							<div className="upload-zone-text">
								Fotoğrafı buraya sürükleyin veya seçmek için
								tıklayın
							</div>
							<div className="upload-zone-sub">
								JPG, PNG (en fazla 10 MB)
							</div>

							<div
								className="upload-buttons"
								onClick={(e) => e.stopPropagation()}
							>
								<button
									className="btn btn-primary"
									onClick={() =>
										fileInputRef.current?.click()
									}
								>
									Dosya Seç
								</button>
								<label className="btn btn-camera">
									Kamera ile Çek
									<input
										type="file"
										accept="image/*"
										capture="environment"
										style={{ display: "none" }}
										onChange={handleFileChange}
									/>
								</label>
							</div>
							<input
								type="file"
								ref={fileInputRef}
								accept="image/*"
								style={{ display: "none" }}
								onChange={handleFileChange}
							/>
						</div>
					) : (
						<div style={{ textAlign: "center" }}>
							<div className="preview-container">
								<img
									src={previewUrl}
									alt="İsteka önizlemesi"
									className="preview-img"
								/>
								<button
									className="preview-remove"
									onClick={clearImage}
									title="Kaldır"
								>
									✕
								</button>
							</div>

							<div style={{ marginTop: "1.5rem" }}>
								<button
									className="btn btn-primary btn-lg"
									onClick={() => analyzeRack()}
									disabled={isAnalyzing}
								>
									{isAnalyzing ? (
										<>
											<span className="spinner"></span>{" "}
											Yapay Zeka Analiz Ediyor...
										</>
									) : (
										"İstekayı Analiz Et"
									)}
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Error State */}
				{error && (
					<div className="banner banner-error fade-in">
						<strong>Hata:</strong> {error}
						<div>
							Sorun devam ederse yapay zeka sunucusunun
							(start_server.bat) çalıştığından emin olun.
						</div>
					</div>
				)}

				{/* Step 3: Tiles & Optimization */}
				{tiles && okey && (
					<div className="glass-card fade-in">
						<div className="section-header">
							<span className="section-badge">3</span>
							<h2 className="section-title">Sonuçlar</h2>
						</div>

						<RackDisplay
							tiles={tiles}
							okeyColor={okey.color}
							okeyNumber={okey.number}
							onTilesChange={(newTiles) => {
								setTiles(newTiles);
								analyzeRack(newTiles); // Re-run optimizer locally
							}}
						/>

						{results && (
							<OptimizationResult
								pointsResult={results.points}
								doublesResult={results.doubles}
								recommended={results.recommended}
							/>
						)}
					</div>
				)}
			</div>
		</main>
	);
}
