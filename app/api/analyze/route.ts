import { NextRequest, NextResponse } from "next/server";
import {
  parseTileLabel,
  deriveOkey,
  optimize,
  TileColor,
  COLORS,
} from "@/lib/okey-optimizer";

const FLASK_URL = "http://localhost:5001";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const gostergeColor = formData.get("gostergeColor") as TileColor;
    const gostergeNumber = parseInt(formData.get("gostergeNumber") as string, 10);
    const gostergeFlagged = formData.get("gostergeFlagged") === "true";
    // Optional: user-overridden tiles after correction
    const tilesOverrideRaw = formData.get("tilesOverride") as string | null;

    if (!imageFile && !tilesOverrideRaw) {
      return NextResponse.json({ error: "No image or tiles provided" }, { status: 400 });
    }

    // Validate gösterge
    if (!gostergeColor || !COLORS.includes(gostergeColor) || isNaN(gostergeNumber)) {
      return NextResponse.json({ error: "Invalid gösterge tile" }, { status: 400 });
    }

    // Derive okey
    const okey = deriveOkey(gostergeColor, gostergeNumber);

    let tileLabels: string[] = [];

    if (tilesOverrideRaw) {
      // User has manually corrected tiles — use them directly
      tileLabels = JSON.parse(tilesOverrideRaw);
    } else if (imageFile) {
      // Forward image to Flask pipeline
      const flaskForm = new FormData();
      const arrayBuffer = await imageFile.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: imageFile.type });
      flaskForm.append("image", blob, imageFile.name);

      let flaskRes: Response;
      try {
        flaskRes = await fetch(`${FLASK_URL}/predict`, {
          method: "POST",
          body: flaskForm,
        });
      } catch {
        return NextResponse.json(
          {
            error:
              "Cannot reach the Python detection server. Please start start_server.bat first.",
          },
          { status: 503 }
        );
      }

      if (!flaskRes.ok) {
        const err = await flaskRes.json();
        return NextResponse.json({ error: err.error ?? "Flask error" }, { status: 500 });
      }

      const flaskData = await flaskRes.json();
      tileLabels = flaskData.tiles as string[];
    }

    // Parse tile labels into Tile objects
    const tiles = tileLabels.map((label, i) =>
      parseTileLabel(label, i, okey.color, okey.number)
    );

    // Run optimizer
    const result = optimize(tiles, gostergeFlagged, {
      color: gostergeColor,
      number: gostergeNumber,
    });

    return NextResponse.json({
      tiles: tileLabels,
      okey,
      gosterge: { color: gostergeColor, number: gostergeNumber },
      optimization: result,
    });
  } catch (err: unknown) {
    console.error("[/api/analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
