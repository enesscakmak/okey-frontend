export const USER_ERRORS = {
	generic: "Bir sorun oluştu. Lütfen tekrar deneyin.",
	network:
		"Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
	analysisUnavailable:
		"Analiz şu an kullanılamıyor. Lütfen biraz sonra tekrar deneyin.",
	analysisFailed:
		"Fotoğraf analiz edilemedi. Daha net bir görüntü ile tekrar deneyin.",
	optimizationFailed: "Sonuç hesaplanamadı. Lütfen tekrar deneyin.",
	missingPhoto: "Lütfen önce bir fotoğraf yükleyin veya çekin.",
	invalidGosterge: "Lütfen gösterge rengi ve sayısını kontrol edin.",
	cameraUnsupported: "Bu cihazda kamera kullanılamıyor.",
	cameraPermission:
		"Kameraya erişilemedi. Tarayıcı ayarlarından kamera iznini açın.",
	photoCaptureFailed: "Fotoğraf çekilemedi. Lütfen tekrar deneyin.",
	cameraNotReady:
		"Kamera henüz hazır değil. Birkaç saniye bekleyip tekrar deneyin.",
	imageProcessFailed: "Görüntü işlenemedi. Lütfen tekrar deneyin.",
	imageLoadFailed:
		"Görüntü yüklenemedi. Lütfen başka bir fotoğraf deneyin.",
	retryHint:
		"Sorun devam ederse daha aydınlık bir ortamda, farklı bir açıdan yeni bir fotoğraf deneyin.",
} as const;

const KNOWN_USER_MESSAGES = new Set<string>(Object.values(USER_ERRORS));

export function getUserErrorMessage(
	err: unknown,
	fallback: string = USER_ERRORS.generic,
): string {
	if (err instanceof Error && KNOWN_USER_MESSAGES.has(err.message)) {
		return err.message;
	}
	return fallback;
}

export function getApiErrorMessage(
	error: string | undefined,
	fallback: string = USER_ERRORS.generic,
): string {
	if (error && KNOWN_USER_MESSAGES.has(error)) return error;
	return fallback;
}
