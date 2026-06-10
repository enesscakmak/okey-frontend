import { NextRequest, NextResponse } from "next/server";
import {
  parseTileLabel,
  deriveOkey,
  optimize,
  TileColor,
  COLORS,
} from "@/lib/okey-optimizer";
import { USER_ERRORS } from "@/lib/user-errors";

const FLASK_URL = process.env.FLASK_URL || "http://localhost:5001";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const gostergeColor = formData.get("gostergeColor") as TileColor;
    const gostergeNumber = parseInt(formData.get("gostergeNumber") as string, 10);
    const gostergeFlagged = formData.get("gostergeFlagged") === "true";
    const tilesOverrideRaw = formData.get("tilesOverride") as string | null;

    if (!imageFile && !tilesOverrideRaw) {
      return NextResponse.json({ error: USER_ERRORS.missingPhoto }, { status: 400 });
    }

    if (!gostergeColor || !COLORS.includes(gostergeColor) || isNaN(gostergeNumber)) {
      return NextResponse.json({ error: USER_ERRORS.invalidGosterge }, { status: 400 });
    }

    const okey = deriveOkey(gostergeColor, gostergeNumber);

    let tileLabels: string[] = [];

    if (tilesOverrideRaw) {
      try {
        tileLabels = JSON.parse(tilesOverrideRaw);
      } catch {
        return NextResponse.json({ error: USER_ERRORS.generic }, { status: 400 });
      }
    } else if (imageFile) {
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
      } catch (err) {
        console.error("[/api/analyze] detection service unreachable", err);
        return NextResponse.json(
          { error: USER_ERRORS.analysisUnavailable },
          { status: 503 }
        );
      }

      if (!flaskRes.ok) {
        console.error("[/api/analyze] detection service error", flaskRes.status);
        return NextResponse.json(
          { error: USER_ERRORS.analysisFailed },
          { status: 500 }
        );
      }

      const flaskData = await flaskRes.json();
      tileLabels = flaskData.tiles as string[];
    }

    const tiles = tileLabels.map((label, i) =>
      parseTileLabel(label, i, okey.color, okey.number)
    );

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
      { error: USER_ERRORS.generic },
      { status: 500 }
    );
  }
}
