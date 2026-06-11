"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  captureAndCropVideoFrame,
  computeGuideSize,
  GUIDE_ROTATION_DEG,
} from "@/lib/image-crop";
import {
  isOrientationLockSupported,
  lockPortraitOrientation,
  unlockPortraitOrientation,
} from "@/lib/orientation-lock";
import { USER_ERRORS, getUserErrorMessage } from "@/lib/user-errors";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onFallback?: () => void;
}

export default function CameraCapture({
  open,
  onClose,
  onCapture,
  onFallback,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [orientationLocked, setOrientationLocked] = useState(false);
  const [guideSize, setGuideSize] = useState({ width: 0, height: 0 });

  const updateLayout = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { clientWidth, clientHeight } = viewport;
    if (clientWidth === 0 || clientHeight === 0) return;

    setGuideSize(computeGuideSize(clientWidth, clientHeight));
  }, []);

  useEffect(() => {
    if (!open) return;

    let active = true;

    void lockPortraitOrientation().then((locked) => {
      if (active) setOrientationLocked(locked);
    });

    updateLayout();

    window.addEventListener("resize", updateLayout);
    const viewport = viewportRef.current;
    const observer =
      viewport && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateLayout)
        : null;
    if (viewport && observer) observer.observe(viewport);

    return () => {
      active = false;
      unlockPortraitOrientation();
      setOrientationLocked(false);
      window.removeEventListener("resize", updateLayout);
      observer?.disconnect();
    };
  }, [open, updateLayout]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsReady(false);
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setIsReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(USER_ERRORS.cameraUnsupported);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
        updateLayout();
      }
    } catch {
      setError(USER_ERRORS.cameraPermission);
    }
  }, [updateLayout]);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setIsCapturing(false);
      return;
    }

    startStream();
    return () => stopStream();
  }, [open, startStream, stopStream]);

  const handleCapture = async () => {
    const video = videoRef.current;
    const viewport = viewportRef.current;
    if (!video || !viewport || !isReady || isCapturing) return;
    if (guideSize.width === 0 || guideSize.height === 0) return;

    setIsCapturing(true);
    setError(null);

    try {
      const blob = await captureAndCropVideoFrame(
        video,
        viewport,
        guideSize.width,
        guideSize.height,
        0.05,
        GUIDE_ROTATION_DEG,
      );
      const file = new File([blob], `isteke-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      stopStream();
      onCapture(file);
      onClose();
    } catch (err) {
      setError(getUserErrorMessage(err, USER_ERRORS.photoCaptureFailed));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Kamera">
      <div className="camera-header">
        <button
          type="button"
          className="btn btn-ghost camera-close-btn"
          onClick={handleClose}
          aria-label="Kapat"
        >
          ✕
        </button>
        <div className="camera-header-text">
          <strong>Telefonu Yatay Tutun</strong>
          <span>
            Ekran dikey kalır; telefonu yan çevirip istekeyi çerçeveye hizalayın
          </span>
          {!orientationLocked && isOrientationLockSupported() === false && (
            <span className="camera-orientation-hint">
              Ekran kilidi bu tarayıcıda desteklenmiyor; uygulamayı dikey tutun
            </span>
          )}
        </div>
      </div>

      <div className="camera-viewport" ref={viewportRef}>
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          playsInline
          muted
        />

        <div className="camera-overlay" aria-hidden="true">
          <div
            ref={guideRef}
            className="camera-guide"
            style={{
              width: guideSize.width || undefined,
              height: guideSize.height || undefined,
              transform: `rotate(${GUIDE_ROTATION_DEG}deg)`,
            }}
          >
            <span className="camera-guide-label">Çekim alanı</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="camera-error banner banner-error">
          <div>{error}</div>
          {onFallback && (
            <button
              type="button"
              className="btn btn-secondary camera-fallback-btn"
              onClick={() => {
                handleClose();
                onFallback();
              }}
            >
              Sistem Kamerasını Kullan
            </button>
          )}
        </div>
      )}

      <div className="camera-controls">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleClose}
        >
          İptal
        </button>
        <button
          type="button"
          className="btn btn-primary camera-shutter-btn"
          onClick={handleCapture}
          disabled={!isReady || isCapturing}
        >
          {isCapturing ? (
            <>
              <span className="spinner" /> İşleniyor...
            </>
          ) : (
            "Fotoğraf Çek"
          )}
        </button>
      </div>
    </div>
  );
}
