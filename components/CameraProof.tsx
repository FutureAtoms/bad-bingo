import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ActiveBet, ProofMetadata } from '../types';
import { uploadProof, generateProofMetadata, createProofRecord, VIDEO_DURATION_LIMITS } from '../services/proofs';

interface CameraProofProps {
  bet: ActiveBet;
  userId: string; // Required for uploading to storage
  clashId: string; // Required for uploading to storage
  onClose: () => void;
  onSend: (storagePath: string, viewDurationHours: number, isViewOnce: boolean) => void;
  onError?: (error: string) => void;
}

// Map timer label to hours
const timerToHours: Record<string, number> = {
  '1H': 1,
  '6H': 6,
  '12H': 12,
};

type CaptureMode = 'photo' | 'video';

const CameraProof: React.FC<CameraProofProps> = ({ bet, userId, clashId, onClose, onSend, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [timer, setTimer] = useState<string>('12H');
  const [viewOnce, setViewOnce] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proofMetadata, setProofMetadata] = useState<ProofMetadata | null>(null);
  const [isCapturingMetadata, setIsCapturingMetadata] = useState(false);

  // Video recording states
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Initialize camera with audio for video mode
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: captureMode === 'video' // Only request audio in video mode
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera access denied", err);
        // Fallback for web without camera access (simulated)
      }
    };
    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [captureMode]);

  // Cleanup video preview URL when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Auto-stop recording when max duration reached
  useEffect(() => {
    if (isRecording && recordingDuration >= VIDEO_DURATION_LIMITS.MAX) {
      stopRecording();
    }
  }, [recordingDuration, isRecording]);

  const captureMetadataAsync = async (): Promise<ProofMetadata> => {
    setIsCapturingMetadata(true);
    try {
      const metadata = await generateProofMetadata();
      setProofMetadata(metadata);
      return metadata;
    } catch (err) {
      // If metadata generation fails, create minimal metadata
      const minimalMetadata: ProofMetadata = {
        capturedAt: new Date().toISOString(),
        locationVerified: false,
      };
      setProofMetadata(minimalMetadata);
      return minimalMetadata;
    } finally {
      setIsCapturingMetadata(false);
    }
  };

  const capture = async () => {
    // Start capturing metadata (location, timestamp) immediately
    setIsCapturingMetadata(true);

    // Capture the image
    let dataUrl: string | null = null;
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        dataUrl = canvasRef.current.toDataURL('image/jpeg');
      }
    }

    if (!dataUrl) {
      // Fallback for demo
      dataUrl = 'https://picsum.photos/seed/proof/400/600';
    }

    setCapturedImage(dataUrl);

    // Generate proof metadata (location, timestamp, device info)
    await captureMetadataAsync();
  };

  const startRecording = useCallback(async () => {
    if (!stream) return;

    recordedChunksRef.current = [];
    setRecordingDuration(0);

    // Capture metadata at the start of recording
    captureMetadataAsync();

    // Check if MediaRecorder supports mp4
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setCapturedVideo(blob);

        // Create preview URL
        const url = URL.createObjectURL(blob);
        setVideoPreviewUrl(url);

        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      onError?.('Failed to start video recording');
    }
  }, [stream, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, []);

  const handleRecordButtonPress = () => {
    if (isRecording) {
      // Check minimum duration
      if (recordingDuration < VIDEO_DURATION_LIMITS.MIN) {
        onError?.(`Video must be at least ${VIDEO_DURATION_LIMITS.MIN} seconds`);
        return;
      }
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleCaptureMode = () => {
    if (isRecording) return; // Don't allow mode switch while recording

    // Reset captured content when switching modes
    resetCapture();
    setCaptureMode(prev => prev === 'photo' ? 'video' : 'photo');
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setCapturedVideo(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    setUploadError(null);
    setRecordingDuration(0);
    setProofMetadata(null);
  };

  const handleSend = async () => {
    setIsUploading(true);
    setUploadError(null);

    try {
      let file: Blob | null = null;
      let proofType: 'photo' | 'video' = 'photo';

      if (captureMode === 'video' && capturedVideo) {
        file = capturedVideo;
        proofType = 'video';
      } else if (captureMode === 'photo' && capturedImage) {
        // Convert data URL to blob for photo
        if (capturedImage.startsWith('data:')) {
          const arr = capturedImage.split(',');
          const mime = arr[0].match(/:(.*?);/)![1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          file = new Blob([u8arr], { type: mime });
        } else {
          // Fallback URL - fetch it
          const response = await fetch(capturedImage);
          file = await response.blob();
        }
        proofType = 'photo';
      }

      if (!file) {
        setUploadError('No content to upload');
        return;
      }

      // Upload the file to Supabase Storage
      const { path, error } = await uploadProof(userId, clashId, file, proofType);

      if (error || !path) {
        const errorMsg = error || 'Failed to upload proof';
        setUploadError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      // Create proof record in database with metadata
      const viewDurationHours = timerToHours[timer] || 12;
      const finalMetadata = proofMetadata || {
        capturedAt: new Date().toISOString(),
        locationVerified: false,
      };

      // Create proof record with metadata in bb_proofs table
      const { error: recordError } = await createProofRecord(
        clashId,
        userId,
        path,
        proofType,
        viewDurationHours,
        viewOnce,
        finalMetadata
      );

      if (recordError) {
        // Log the error but don't block - the proof is already uploaded
        console.warn('Failed to create proof record:', recordError);
      }

      // Call onSend with the storage path
      onSend(path, viewDurationHours, viewOnce);
    } catch (err) {
      const errorMsg = 'Failed to upload proof. Please try again.';
      setUploadError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const hasCapturedContent = captureMode === 'photo' ? !!capturedImage : !!capturedVideo;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingProgress = (): number => {
    return (recordingDuration / VIDEO_DURATION_LIMITS.MAX) * 100;
  };

  // Render metadata overlay for both photo and video previews
  const renderMetadataOverlay = () => (
    <>
      {/* Top metadata overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* Timestamp overlay */}
        <div className="bg-black/60 rounded px-2 py-1 backdrop-blur-sm">
          <div className="text-acid-green font-mono text-xs">
            {proofMetadata?.capturedAt
              ? new Date(proofMetadata.capturedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : 'Capturing...'}
          </div>
        </div>

        {/* Location verification status */}
        <div className={`flex items-center gap-1 rounded px-2 py-1 backdrop-blur-sm ${
          isCapturingMetadata
            ? 'bg-yellow-500/20 text-yellow-400'
            : proofMetadata?.locationVerified
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
        }`}>
          {isCapturingMetadata ? (
            <>
              <i className="fas fa-spinner fa-spin text-xs"></i>
              <span className="font-mono text-xs">GPS...</span>
            </>
          ) : proofMetadata?.locationVerified ? (
            <>
              <i className="fas fa-map-marker-alt text-xs"></i>
              <i className="fas fa-check text-xs"></i>
              <span className="font-mono text-xs">GPS</span>
            </>
          ) : (
            <>
              <i className="fas fa-map-marker-alt text-xs"></i>
              <i className="fas fa-times text-xs"></i>
              <span className="font-mono text-xs">NO GPS</span>
            </>
          )}
        </div>
      </div>

      {/* Bottom metadata bar */}
      {proofMetadata && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-none">
          <div className="flex justify-between items-end">
            <div className="text-white/70 font-mono text-xs">
              {captureMode === 'video' ? 'VIDEO EVIDENCE' : 'EVIDENCE CAPTURED'}
            </div>
            {proofMetadata.locationVerified && proofMetadata.locationLat && proofMetadata.locationLng && (
              <div className="text-green-400 font-mono text-xs">
                {proofMetadata.locationLat.toFixed(4)}, {proofMetadata.locationLng.toFixed(4)}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!hasCapturedContent ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {!stream && <div className="text-white text-center">Opening your crime camera...</div>}

            {/* HUD Overlay */}
            <div className="absolute inset-0 border-2 border-white/20 m-4 rounded-lg pointer-events-none flex flex-col justify-between p-4">
              <div className="text-acid-green font-mono text-xs">EVIDENCE :: {bet.scenario}</div>
              <div className="text-white/50 font-mono text-xs self-end">No lies. Prove it.</div>
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white font-mono text-lg">{formatDuration(recordingDuration)}</span>
                  <span className="text-white/50 font-mono text-sm">/ {VIDEO_DURATION_LIMITS.MAX}s</span>
                </div>
                {/* Progress bar */}
                <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${recordingDuration < VIDEO_DURATION_LIMITS.MIN ? 'bg-yellow-500' : 'bg-acid-green'}`}
                    style={{ width: `${getRecordingProgress()}%` }}
                  />
                </div>
                {recordingDuration < VIDEO_DURATION_LIMITS.MIN && (
                  <span className="text-yellow-500 text-xs font-mono">Min {VIDEO_DURATION_LIMITS.MIN}s required</span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="relative w-full h-full">
            {captureMode === 'photo' && capturedImage && (
              <img src={capturedImage} alt="Proof" className="w-full h-full object-cover" />
            )}
            {captureMode === 'video' && videoPreviewUrl && (
              <video
                ref={previewVideoRef}
                src={videoPreviewUrl}
                autoPlay
                loop
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            {renderMetadataOverlay()}
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="h-56 bg-black flex flex-col p-4">
        {hasCapturedContent ? (
          <div className="flex flex-col h-full justify-between">
            {/* Video duration badge */}
            {captureMode === 'video' && (
              <div className="flex justify-center mb-2">
                <span className="bg-hot-pink/20 text-hot-pink px-3 py-1 rounded-full text-xs font-mono">
                  VIDEO: {formatDuration(recordingDuration)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                {['1H', '6H', '12H'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTimer(t)}
                    className={`px-3 py-1 rounded text-xs border ${timer === t ? 'bg-acid-green text-black border-acid-green' : 'bg-transparent text-gray-500 border-gray-700'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setViewOnce(!viewOnce)}
                className={`w-10 h-10 rounded-full flex items-center justify-center border ${viewOnce ? 'bg-hot-pink text-white border-hot-pink' : 'text-gray-500 border-gray-700'}`}
              >
                <i className="fas fa-fire-alt"></i>
              </button>
            </div>
            {uploadError && (
              <div className="text-red-500 text-xs text-center mb-2">{uploadError}</div>
            )}
            <div className="flex gap-4">
              <button
                onClick={resetCapture}
                className="flex-1 bg-gray-800 text-white py-3 rounded font-bold"
                disabled={isUploading}
              >
                TRY AGAIN
              </button>
              <button
                onClick={handleSend}
                className={`flex-1 py-3 rounded font-bold ${isUploading ? 'bg-gray-600 text-gray-400' : 'bg-acid-green text-black'}`}
                disabled={isUploading}
              >
                {isUploading ? 'UPLOADING...' : 'SUBMIT EVIDENCE'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={toggleCaptureMode}
                disabled={isRecording}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  captureMode === 'photo'
                    ? 'bg-acid-green text-black'
                    : 'bg-transparent text-gray-500 border border-gray-700'
                } ${isRecording ? 'opacity-50' : ''}`}
              >
                <i className="fas fa-camera mr-2"></i>PHOTO
              </button>
              <button
                onClick={toggleCaptureMode}
                disabled={isRecording}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  captureMode === 'video'
                    ? 'bg-hot-pink text-white'
                    : 'bg-transparent text-gray-500 border border-gray-700'
                } ${isRecording ? 'opacity-50' : ''}`}
              >
                <i className="fas fa-video mr-2"></i>VIDEO
              </button>
            </div>

            <div className="flex items-center justify-center gap-8">
              <button onClick={onClose} className="text-white text-sm" disabled={isRecording}>
                CHICKEN OUT
              </button>

              {captureMode === 'photo' ? (
                <button
                  onClick={capture}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white active:scale-95 transition-all"
                />
              ) : (
                <button
                  onClick={handleRecordButtonPress}
                  className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
                    isRecording
                      ? 'border-red-500 bg-red-500/20'
                      : 'border-hot-pink bg-hot-pink/20 active:bg-hot-pink active:scale-95'
                  }`}
                >
                  {isRecording ? (
                    <div className="w-8 h-8 rounded-sm bg-red-500" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-hot-pink" />
                  )}
                </button>
              )}

              <div className="w-10"></div>
            </div>

            {/* Video mode hint */}
            {captureMode === 'video' && !isRecording && (
              <p className="text-gray-500 text-xs text-center">
                Tap to record ({VIDEO_DURATION_LIMITS.MIN}-{VIDEO_DURATION_LIMITS.MAX} seconds)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraProof;
