import React, { useEffect, useRef, useState } from 'react';
import * as tmImage from '@teachablemachine/image';

const MODEL_URL = '/model/';

type Crop = { x: number; y: number; width: number; height: number };
type InputEvent = React.MouseEvent<HTMLCanvasElement> | Touch;
const HANDLE_SIZE = 10;

const WebcamCapture: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });
  const [crop, setCrop] = useState<Crop>({ x: (640 - 300) / 2, y: (480 - 100) / 2, width: 300, height: 100 });
  const dragging = useRef<null | string>(null);
  const dragStart = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  const [model, setModel] = useState<tmImage.CustomMobileNet | null>(null); // used in detection useEffect
  const [label, setLabel] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [hasCaptured, setHasCaptured] = useState(false);

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
          setCrop(prev => ({ ...prev, x: (width - prev.width) / 2, y: (height - prev.height) / 2 }));
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

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const detect = async () => {
      if (!videoRef.current || !model) return;
      const { x, y, width, height } = crop;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = width;
      cropCanvas.height = height;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return;

      cropCtx.drawImage(videoRef.current, x, y, width, height, 0, 0, width, height);
      const predictions = await model.predict(cropCanvas);
      const high = predictions.find(p => p.probability > 0.9);

      if (high && videoRef.current) {
        setLabel(high.className);
        setConfidence(Math.round(high.probability * 100));

        // Always capture for testing
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        if (finalCtx) {
          finalCtx.drawImage(videoRef.current, x, y, width, height, 0, 0, width, height);
          const imgData = finalCanvas.toDataURL('image/png');
          console.log('Captured Image:', imgData);
          setCapturedImage(imgData);
          setHasCaptured(true);
        }
          
      } else {
        setLabel('');
        setConfidence(0);
      }

      if (label === 'RazorHead') {
        requestAnimationFrame(detect);
      } else {
        setTimeout(() => requestAnimationFrame(detect), 200);
      }
  };
    requestAnimationFrame(detect);
  }, [model, crop, hasCaptured]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      if (video.readyState >= 2) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.filter = 'blur(8px)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        const { x, y, width, height } = crop;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(video, x, y, width, height, 0, 0, width, height);
          ctx.drawImage(tempCanvas, x, y);
        }

        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        const handles = getHandles(crop);
        ctx.fillStyle = 'yellow';
        handles.forEach(({ x, y }) => {
          ctx.fillRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        });
      }
      video.requestVideoFrameCallback(drawFrame);
    };
    video.requestVideoFrameCallback(drawFrame);
  }, [crop]);

  const getHandles = (c: Crop) => [
    { x: c.x, y: c.y },
    { x: c.x + c.width, y: c.y },
    { x: c.x, y: c.y + c.height },
    { x: c.x + c.width, y: c.y + c.height },
  ];

  const getRelativePos = (e: InputEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    return {
      x: (clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (clientY - rect.top) * (canvasRef.current!.height / rect.height),
    };
  };

  const isInHandle = (pos: { x: number; y: number }, handle: { x: number; y: number }) =>
    pos.x >= handle.x - HANDLE_SIZE &&
    pos.x <= handle.x + HANDLE_SIZE &&
    pos.y >= handle.y - HANDLE_SIZE &&
    pos.y <= handle.y + HANDLE_SIZE;

  const detectHandle = (pos: { x: number; y: number }) => {
    const handles = [
      { x: crop.x, y: crop.y, name: 'nw' },
      { x: crop.x + crop.width, y: crop.y, name: 'ne' },
      { x: crop.x, y: crop.y + crop.height, name: 'sw' },
      { x: crop.x + crop.width, y: crop.y + crop.height, name: 'se' },
    ];
    for (const handle of handles) {
      if (isInHandle(pos, handle)) return handle.name;
    }
    if (
      pos.x > crop.x &&
      pos.x < crop.x + crop.width &&
      pos.y > crop.y &&
      pos.y < crop.y + crop.height
    )
      return 'move';
    return null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | Touch) => {
    const pos = getRelativePos(e);
    const handle = detectHandle(pos);
    if (handle) {
      dragging.current = handle;
      dragStart.current = { x: pos.x, y: pos.y, crop };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | Touch) => {
    if (!dragging.current) return;
    const pos = getRelativePos(e);
    const start = dragStart.current;
    if (!start) return;
    const dx = pos.x - start.x;
    const dy = pos.y - start.y;

    let newCrop = { ...start.crop };

    switch (dragging.current) {
      case 'move':
        newCrop.x = Math.max(0, Math.min(start.crop.x + dx, videoSize.width - start.crop.width));
        newCrop.y = Math.max(0, Math.min(start.crop.y + dy, videoSize.height - start.crop.height));
        break;
      case 'nw':
        newCrop.x = Math.min(start.crop.x + dx, start.crop.x + start.crop.width - 20);
        newCrop.y = Math.min(start.crop.y + dy, start.crop.y + start.crop.height - 20);
        newCrop.width = start.crop.width - (newCrop.x - start.crop.x);
        newCrop.height = start.crop.height - (newCrop.y - start.crop.y);
        break;
      case 'ne':
        newCrop.y = Math.min(start.crop.y + dy, start.crop.y + start.crop.height - 20);
        newCrop.width = Math.max(20, start.crop.width + dx);
        newCrop.height = start.crop.height - (newCrop.y - start.crop.y);
        break;
      case 'sw':
        newCrop.x = Math.min(start.crop.x + dx, start.crop.x + start.crop.width - 20);
        newCrop.width = start.crop.width - (newCrop.x - start.crop.x);
        newCrop.height = Math.max(20, start.crop.height + dy);
        break;
      case 'se':
        newCrop.width = Math.max(20, start.crop.width + dx);
        newCrop.height = Math.max(20, start.crop.height + dy);
        break;
    }

    newCrop.x = Math.max(0, newCrop.x);
    newCrop.y = Math.max(0, newCrop.y);
    newCrop.width = Math.min(newCrop.width, videoSize.width - newCrop.x);
    newCrop.height = Math.min(newCrop.height, videoSize.height - newCrop.y);

    setCrop(newCrop);
  };

  const onMouseUp = () => {
    dragging.current = null;
    dragStart.current = null;
  };

  const reset = () => {
    setCapturedImage(null);
    setLabel('');
    setConfidence(0);
    setHasCaptured(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: videoSize.width, height: videoSize.height }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none', cursor: dragging.current ? 'grabbing' : 'default' }}
          onTouchStart={(e) => e.touches.length > 0 && onMouseDown(e.touches[0] as Touch)}
          onTouchMove={(e) => e.touches.length > 0 && onMouseMove(e.touches[0] as Touch)}
          onTouchEnd={onMouseUp}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>
      <p style={{ marginTop: 12 }}>Detected: <strong>{label || 'None'}</strong></p>
      <p>Confidence: {confidence}%</p>
      {capturedImage !== null && capturedImage !== '' && (
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
