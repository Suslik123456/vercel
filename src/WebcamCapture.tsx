import React, { useEffect, useRef, useState } from 'react';
import * as tmImage from '@teachablemachine/image';

const MODEL_URL = '/model/';

type Crop = { x: number; y: number; width: number; height: number };

const WebcamCapture: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });
  const [crop, setCrop] = useState<Crop>({ x: 170, y: 190, width: 300, height: 100 });

  const [model, setModel] = useState<tmImage.CustomMobileNet | null>(null);
  // const [label, setLabel] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [hasCaptured, setHasCaptured] = useState(false);
  const delayRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      const loadedModel = await tmImage.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);
      setModel(loadedModel);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          const width = videoRef.current!.videoWidth;
          const height = videoRef.current!.videoHeight;
          setVideoSize({ width, height });
          setCrop({ x: (width - 300) / 2, y: (height - 100) / 2, width: 300, height: 100 });
        };
      }
    };
    init();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !model) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const detect = async () => {
      if (!videoRef.current || !model) return;
      if (delayRef.current) {
        setTimeout(() => requestAnimationFrame(detect), 300);
        return;
      }

      const { x, y, width, height } = crop;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = width;
      cropCanvas.height = height;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return;

      cropCtx.drawImage(videoRef.current, x, y, width, height, 0, 0, width, height);
      const predictions = await model.predict(cropCanvas);
      const high = predictions.find(p => p.className === 'RazorHead' && p.probability >= 0.998);

      if (high) {
        setLabel(high.className);
        setConfidence(Math.round(high.probability * 100));

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        if (finalCtx) {
          finalCtx.drawImage(videoRef.current, x, y, width, height, 0, 0, width, height);
          const imgData = finalCanvas.toDataURL('image/png');
          setCapturedImage(imgData);
          setHasCaptured(true);
        }

        delayRef.current = true;
        setTimeout(() => {
          delayRef.current = false;
        }, 10000);
      } else {
        setLabel('');
        setConfidence(0);
      }

      requestAnimationFrame(detect);
    };

    requestAnimationFrame(detect);
  }, [model, crop]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw full blurred background
        ctx.save();
        ctx.filter = 'blur(8px)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw clear crop area
        const { x, y, width, height } = crop;
        ctx.drawImage(video, x, y, width, height, x, y, width, height);

        // Outline the crop area
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
      }
      video.requestVideoFrameCallback(drawFrame);
    };
    video.requestVideoFrameCallback(drawFrame);
  }, [crop]);

  const reset = () => {
    setCapturedImage(null);
    setLabel('');
    setConfidence(0);
    setHasCaptured(false);
    setCrop({
      x: (videoSize.width - 300) / 2,
      y: (videoSize.height - 100) / 2,
      width: 300,
      height: 100
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100vw', minHeight: '100vh', padding: '16px 0', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '100%', aspectRatio: '4 / 3' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'default' }}
        />
      </div>

      <p>Confidence: <strong>{confidence}%</strong></p>
      <div style={{ width: '100%', maxWidth: 300, height: 10, backgroundColor: 'red', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          width: `${confidence}%`,
          height: '100%',
          backgroundColor: confidence >= 99.8 ? 'limegreen' : confidence > 80 ? 'orange' : 'red',
          transition: 'width 0.5s ease-in-out, background-color 0.3s ease-in-out'
        }} />
      </div>

      {capturedImage && (
        <div style={{ marginTop: '16px' }}>
          <p>Captured Image:</p>
          <img src={capturedImage} alt="Captured" style={{ border: '1px solid #ccc', maxWidth: '100%' }} />
        </div>
      )}
      {hasCaptured && (
        <button onClick={reset} style={{ marginTop: '12px', padding: '8px 16px' }}>
          Scan Again
        </button>
      )}
    </div>
  );
};

export default WebcamCapture;
