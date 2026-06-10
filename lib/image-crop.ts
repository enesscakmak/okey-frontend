import { USER_ERRORS } from "@/lib/user-errors";

export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Çekim çerçevesi en/boy oranı (genişlik / yükseklik). */
export const GUIDE_ASPECT_RATIO = 1 / 2.3;

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
	guideElement: HTMLElement,
	paddingRatio = 0.05,
): Promise<Blob> {
	if (video.videoWidth === 0 || video.videoHeight === 0) {
		throw new Error(USER_ERRORS.cameraNotReady);
	}

	const displayRect = guideElement.getBoundingClientRect();
	const baseCrop = mapDisplayRectToVideoCoords(video, displayRect);
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

/** Dosyadan gelen görseli aynı oranlı çerçeveye göre kırpar */
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

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(b) =>
				b
					? resolve(b)
					: reject(new Error(USER_ERRORS.photoCaptureFailed)),
			"image/jpeg",
			0.92,
		);
	});

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
