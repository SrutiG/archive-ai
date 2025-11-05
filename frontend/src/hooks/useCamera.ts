import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCameraReturn {
  isCameraOpen: boolean;
  isVideoReady: boolean;
  countdown: number | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  openCamera: () => Promise<void>;
  closeCamera: () => void;
  startCapture: (onCapture: (file: File, dataUrl: string) => void) => void;
  handleVideoReady: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useCamera = (): UseCameraReturn => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attach stream to video element once it's rendered
  useEffect(() => {
    if (isCameraOpen && streamRef.current) {
      // Use a small delay to ensure the video element is rendered
      const timer = setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          console.log('Stream attached to video element');
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isCameraOpen]);

  const openCamera = useCallback(async () => {
    try {
      setIsVideoReady(false);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
      setIsCameraOpen(false);
    }
  }, []);

  const closeCamera = useCallback(() => {
    // Clear any active countdown
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsVideoReady(false);
  }, []);

  const capturePhoto = useCallback((onCapture: (file: File, dataUrl: string) => void) => {
    if (!videoRef.current) {
      console.error('Video element not found');
      setError('Camera not available. Please try again.');
      return;
    }

    const video = videoRef.current;
    // Ensure video has valid dimensions
    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;
    
    if (width === 0 || height === 0) {
      console.error('Video not ready - dimensions are 0');
      setError('Video not ready. Please wait a moment and try again.');
      return;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Failed to get canvas context');
      setError('Failed to capture photo. Please try again.');
      return;
    }

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Convert to blob and create File
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        onCapture(file, dataUrl);
      } else {
        console.error('Failed to create blob from canvas');
        setError('Failed to capture photo. Please try again.');
      }
    }, 'image/jpeg', 0.8);
  }, []);

  const startCapture = useCallback((onCapture: (file: File, dataUrl: string) => void) => {
    // Clear any existing countdown
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // Start countdown from 3
    setCountdown(3);
    
    let currentCount = 3;
    countdownTimerRef.current = setInterval(() => {
      currentCount -= 1;
      if (currentCount > 0) {
        setCountdown(currentCount);
      } else {
        // Countdown finished, capture photo
        setCountdown(null);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        capturePhoto(onCapture);
      }
    }, 1000);
  }, [capturePhoto]);

  // Handle video metadata loaded
  const handleVideoReady = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      const width = video.videoWidth || video.clientWidth;
      const height = video.videoHeight || video.clientHeight;
      if (width > 0 && height > 0) {
        setIsVideoReady(true);
        console.log(`Video ready: ${width}x${height}`);
      }
    }
  }, []);

  return {
    isCameraOpen,
    isVideoReady,
    countdown,
    videoRef,
    streamRef,
    openCamera,
    closeCamera,
    startCapture,
    handleVideoReady,
    error,
    setError
  };
};

