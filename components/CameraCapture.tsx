"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  captureAndCropVideoFrame,
  computeGuideSize,
  isLandscapeOrientation,
} from "@/lib/image-crop";
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
  const [isLandscape, setIsLandscape] = useState(true);
  const [guideSize, setGuideSize] = useState({ width: 0, height: 0 });

  const updateLayout = useCallback(() => {
    setIsLandscape(isLandscapeOrientation());

    const viewport = viewportRef.current;
    if (!viewport) return;

    const { clientWidth, clientHeight } = viewport;
    if (clientWidth === 0 || clientHeight === 0) return;

    setGuideSize(computeGuideSize(clientWidth, clientHeight));
  }, []);

  useEffect(() => {
    if (!open) return;

    updateLayout();

    window.addEventListener("resize", updateLayout);
    window.addEventListener("orientationchange", updateLayout);

    const viewport = viewportRef.current;
    const observer =
      viewport && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateLayout)
        : null;
    if (viewport && observer) observer.observe(viewport);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("orientationchange", updateLayout);
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
    const guide = guideRef.current;
    if (!video || !guide || !isReady || isCapturing || !isLandscape) return;

    setIsCapturing(true);
    setError(null);

    try {
      const blob = await captureAndCropVideoFrame(video, guide, 0.05);
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
            {isLandscape
              ? "İstekeyi yatay çerçeveye hizalayın, taşlar net görünsün"
              : "Çekim için telefonu yatay çevirin"}
          </span>
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
          disabled={!isReady || isCapturing || !isLandscape}
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
