import { USER_ERRORS } from "@/lib/user-errors";

export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Yatay isteke çerçevesi en/boy oranı (genişlik ÷ yükseklik). */
export const GUIDE_ASPECT_RATIO = 2.3;

/** Kamera çerçevesi saat yönünde döndürme (derece). */
export const GUIDE_ROTATION_DEG = 90;

export function computeGuideSize(
	viewportWidth: number,
	viewportHeight: number,
	aspectRatio = GUIDE_ASPECT_RATIO,
): { width: number; height: number } {
	let guideW = viewportWidth * 0.88;
	let guideH = guideW / aspectRatio;

	if (guideH > viewportHeight * 0.72) {
		guideH = viewportHeight * 0.72;
		guideW = guideH * aspectRatio;
	}

	return {
		width: Math.round(guideW),
		height: Math.round(guideH),
	};
}

export function isLandscapeOrientation(): boolean {
	if (typeof window === "undefined") return true;
	return window.innerWidth > window.innerHeight;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob
					? resolve(blob)
					: reject(new Error(USER_ERRORS.photoCaptureFailed)),
			"image/jpeg",
			0.92,
		);
	});
}

/** object-fit: cover ile gösterilen video koordinatlarını gerçek piksel alanına çevirir. */
export function mapDisplayRectToVideoCoords(
	video: HTMLVideoElement,
	displayRect: DOMRect,
): CropRect {
	const { videoWidth, videoHeight } = video;
	const { clientWidth, clientHeight } = video;

	const scale = Math.max(
		clientWidth / videoWidth,
		clientHeight / videoHeight,
	);
	const displayedWidth = videoWidth * scale;
	const displayedHeight = videoHeight * scale;
	const offsetX = (clientWidth - displayedWidth) / 2;
	const offsetY = (clientHeight - displayedHeight) / 2;

	const videoRect = video.getBoundingClientRect();

	const relLeft = displayRect.left - videoRect.left - offsetX;
	const relTop = displayRect.top - videoRect.top - offsetY;

	const x = (relLeft / displayedWidth) * videoWidth;
	const y = (relTop / displayedHeight) * videoHeight;
	const width = (displayRect.width / displayedWidth) * videoWidth;
	const height = (displayRect.height / displayedHeight) * videoHeight;

	return { x, y, width, height };
}

/** Viewport merkezindeki dikdörtgeni video koordinatlarına çevirir. */
export function mapCenteredRectToVideoCoords(
	video: HTMLVideoElement,
	container: HTMLElement,
	width: number,
	height: number,
): CropRect {
	const containerRect = container.getBoundingClientRect();
	const centerX = containerRect.left + containerRect.width / 2;
	const centerY = containerRect.top + containerRect.height / 2;
	const displayRect = new DOMRect(
		centerX - width / 2,
		centerY - height / 2,
		width,
		height,
	);
	return mapDisplayRectToVideoCoords(video, displayRect);
}

function rotateCanvas(
	source: HTMLCanvasElement,
	degrees: 90 | -90,
): HTMLCanvasElement {
	const rotated = document.createElement("canvas");
	const swap = Math.abs(degrees) === 90;
	rotated.width = swap ? source.height : source.width;
	rotated.height = swap ? source.width : source.height;

	const ctx = rotated.getContext("2d");
	if (!ctx) throw new Error(USER_ERRORS.imageProcessFailed);

	ctx.translate(rotated.width / 2, rotated.height / 2);
	ctx.rotate((degrees * Math.PI) / 180);
	ctx.drawImage(source, -source.width / 2, -source.height / 2);

	return rotated;
}

export function expandCropRect(
	rect: CropRect,
	paddingRatio: number,
	maxWidth: number,
	maxHeight: number,
): CropRect {
	const padX = rect.width * paddingRatio;
	const padY = rect.height * paddingRatio;

	let x = rect.x - padX;
	let y = rect.y - padY;
	let width = rect.width + padX * 2;
	let height = rect.height + padY * 2;

	if (x < 0) {
		width += x;
		x = 0;
	}
	if (y < 0) {
		height += y;
		y = 0;
	}
	if (x + width > maxWidth) width = maxWidth - x;
	if (y + height > maxHeight) height = maxHeight - y;

	return {
		x: Math.max(0, Math.round(x)),
		y: Math.max(0, Math.round(y)),
		width: Math.max(1, Math.round(width)),
		height: Math.max(1, Math.round(height)),
	};
}

export async function captureAndCropVideoFrame(
	video: HTMLVideoElement,
	container: HTMLElement,
	logicalWidth: number,
	logicalHeight: number,
	paddingRatio = 0.05,
	rotationDeg = GUIDE_ROTATION_DEG,
): Promise<Blob> {
	if (video.videoWidth === 0 || video.videoHeight === 0) {
		throw new Error(USER_ERRORS.cameraNotReady);
	}

	const cropW = rotationDeg % 180 === 90 ? logicalHeight : logicalWidth;
	const cropH = rotationDeg % 180 === 90 ? logicalWidth : logicalHeight;

	const baseCrop = mapCenteredRectToVideoCoords(
		video,
		container,
		cropW,
		cropH,
	);
	const crop = expandCropRect(
		baseCrop,
		paddingRatio,
		video.videoWidth,
		video.videoHeight,
	);

	const canvas = document.createElement("canvas");
	canvas.width = crop.width;
	canvas.height = crop.height;

	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error(USER_ERRORS.imageProcessFailed);

	ctx.drawImage(
		video,
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		0,
		0,
		crop.width,
		crop.height,
	);

	const output =
		rotationDeg === 90 && canvas.height > canvas.width
			? rotateCanvas(canvas, -90)
			: canvas;

	return canvasToBlob(output);
}

/** Dosyadan gelen görseli yatay isteke çerçevesine göre kırpar. */
export async function cropImageFile(
	file: File,
	aspectRatio = GUIDE_ASPECT_RATIO,
	paddingRatio = 0.05,
): Promise<File> {
	const img = await loadImageFromFile(file);
	const imgW = img.naturalWidth;
	const imgH = img.naturalHeight;

	let cropW = imgW * 0.88;
	let cropH = cropW / aspectRatio;
	if (cropH > imgH * 0.88) {
		cropH = imgH * 0.88;
		cropW = cropH * aspectRatio;
	}

	const base: CropRect = {
		x: (imgW - cropW) / 2,
		y: (imgH - cropH) / 2,
		width: cropW,
		height: cropH,
	};

	const crop = expandCropRect(base, paddingRatio, imgW, imgH);

	const canvas = document.createElement("canvas");
	canvas.width = crop.width;
	canvas.height = crop.height;

	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error(USER_ERRORS.imageProcessFailed);

	ctx.drawImage(
		img,
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		0,
		0,
		crop.width,
		crop.height,
	);

	const blob = await canvasToBlob(canvas);

	return new File([blob], `isteke-${Date.now()}.jpg`, { type: "image/jpeg" });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(USER_ERRORS.imageLoadFailed));
		};
		img.src = url;
	});
}
