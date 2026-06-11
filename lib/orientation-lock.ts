type OrientationLockType =
	| "portrait-primary"
	| "portrait"
	| "portrait-secondary";

type OrientableScreen = ScreenOrientation & {
	lock?: (orientation: OrientationLockType) => Promise<void>;
};

let lockDepth = 0;

function getOrientationApi(): OrientableScreen | null {
	if (typeof screen === "undefined" || !("orientation" in screen)) {
		return null;
	}
	return screen.orientation as OrientableScreen;
}

/** Ekranı dikey kilitler; fiziksel döndürmede arayüz sabit kalır. */
export async function lockPortraitOrientation(): Promise<boolean> {
	lockDepth += 1;
	if (lockDepth > 1) return true;

	const orientation = getOrientationApi();
	if (!orientation?.lock) return false;

	const modes: OrientationLockType[] = [
		"portrait-primary",
		"portrait",
		"portrait-secondary",
	];

	for (const mode of modes) {
		try {
			await orientation.lock(mode);
			return true;
		} catch {
			// Sonraki modu dene
		}
	}

	lockDepth = Math.max(0, lockDepth - 1);
	return false;
}

export function unlockPortraitOrientation(): void {
	lockDepth = Math.max(0, lockDepth - 1);
	if (lockDepth > 0) return;

	try {
		getOrientationApi()?.unlock();
	} catch {
		// Tarayıcı desteklemiyorsa sessizce geç
	}
}

export function isOrientationLockSupported(): boolean {
	return typeof getOrientationApi()?.lock === "function";
}
