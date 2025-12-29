import React, { useRef, useState, useEffect } from 'react';
import { ActiveBet } from '../types';

interface CameraProofProps {
  bet: ActiveBet;
  onClose: () => void;
  onSend: (proofUrl: string) => void;
}

const CameraProof: React.FC<CameraProofProps> = ({ bet, onClose, onSend }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [timer, setTimer] = useState<string>('12H');
  const [viewOnce, setViewOnce] = useState(false);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
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
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    } else {
        // Fallback for demo
        setCapturedImage('https://picsum.photos/seed/proof/400/600');
    }
  };

  const handleSend = () => {
      if (capturedImage) {
          onSend(capturedImage);
      }
  };

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!capturedImage ? (
            <>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-cover"
                />
                {!stream && <div className="text-white text-center">Requesting Camera Access...</div>}
                
                {/* HUD Overlay */}
                <div className="absolute inset-0 border-2 border-white/20 m-4 rounded-lg pointer-events-none flex flex-col justify-between p-4">
                     <div className="text-acid-green font-mono text-xs">REC :: {bet.scenario}</div>
                     <div className="text-white/50 font-mono text-xs self-end">EVIDENCE LOCK</div>
                </div>
            </>
        ) : (
            <img src={capturedImage} alt="Proof" className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="h-48 bg-black flex flex-col p-4">
        {capturedImage ? (
             <div className="flex flex-col h-full justify-between">
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
                <div className="flex gap-4">
                    <button onClick={() => setCapturedImage(null)} className="flex-1 bg-gray-800 text-white py-3 rounded font-bold">RETAKE</button>
                    <button onClick={handleSend} className="flex-1 bg-acid-green text-black py-3 rounded font-bold">SEND PROOF</button>
                </div>
             </div>
        ) : (
            <div className="flex items-center justify-center h-full gap-8">
                <button onClick={onClose} className="text-white text-sm">CANCEL</button>
                <button 
                    onClick={capture}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white active:scale-95 transition-all"
                ></button>
                <div className="w-10"></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CameraProof;
