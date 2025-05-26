import React, { useEffect, useRef, useState } from 'react';
import * as tmImage from '@teachablemachine/image';

const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/VF81UgHnO/';

const ObjectScanner: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [model, setModel] = useState<tmImage.CustomMobileNet | null>(null);
    const [label, setLabel] = useState('');
    const [captured, setCaptured] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const loadedModel = await tmImage.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);
            setModel(loadedModel);

            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        };
        init();
    }, []);

    useEffect(() => {
        if (!model || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const detect = async () => {
            if (!ctx) return;

            const width = video.videoWidth;
            const height = video.videoHeight;
            canvas.width = width;
            canvas.height = height;

            const cropX = width / 2 - 100;
            const cropY = height / 2 - 100;
            const cropWidth = 200;
            const cropHeight = 200;

            // Draw blurred background using offscreen canvas
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = width;
            blurCanvas.height = height;
            const blurCtx = blurCanvas.getContext('2d');
            if (!blurCtx) return;

            blurCtx.filter = 'blur(10px)';
            blurCtx.drawImage(video, 0, 0, width, height);

            ctx.drawImage(blurCanvas, 0, 0);

            // Draw the crop region clear
            ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, cropX, cropY, cropWidth, cropHeight);

            // Highlight crop area
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);

            const predictions = await model.predict(canvas);
            const high = predictions.find(p => p.probability > 0.9);

            if (high) {
                ctx.strokeStyle = 'lime';
                ctx.lineWidth = 4;
                ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
                ctx.font = '20px sans-serif';
                ctx.fillStyle = 'lime';
                ctx.fillText(high.className, cropX + 10, cropY - 10);
                setLabel(high.className);
                capture();
            } else {
                setLabel('');
            }

            requestAnimationFrame(detect);
        };

        requestAnimationFrame(detect);
    }, [model]);

    const capture = () => {
        const video = videoRef.current;
        if (!video || !canvasRef.current) return;

        const cropX = video.videoWidth / 2 - 100;
        const cropY = video.videoHeight / 2 - 100;
        const cropWidth = 200;
        const cropHeight = 200;

        const offscreen = document.createElement('canvas');
        offscreen.width = cropWidth;
        offscreen.height = cropHeight;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        setCaptured(offscreen.toDataURL('image/png'));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 640, height: 480 }}>
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <canvas
                    ref={canvasRef}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                />
            </div>
            <p style={{ marginTop: 12 }}>Detected: <strong>{label || 'None'}</strong></p>
            {captured && (
                <div style={{ marginTop: '16px' }}>
                    <p>Captured Image:</p>
                    <img src={captured} alt="Captured" style={{ border: '1px solid #ccc', maxWidth: '100%' }} />
                </div>
            )}
        </div>
    );
};

export default ObjectScanner;
