import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingUtils, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { countExtendedFingers, isHeartGesture, isMiddleFingerGesture } from './handCounting';

type CameraState = 'off' | 'loading' | 'ready' | 'error';
type DisplayValue = number | 'heart' | 'stop' | null;

export default function HandNumbers() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);
  const historyRef = useRef<Array<number | 'heart' | 'stop'>>([]);

  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [displayValue, setDisplayValue] = useState<DisplayValue>(null);
  const [hands, setHands] = useState(0);
  const [message, setMessage] = useState('Starte die Kamera und halte eine oder zwei Hände gut sichtbar ins Bild.');

  const startCamera = useCallback(async () => {
    setCameraState('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
      );
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      setCameraState('ready');
      setMessage('Kamera bereit. Zeige eine Zahl mit einer oder zwei Händen.');
    } catch (error) {
      console.error(error);
      setCameraState('error');
      setMessage('Die Kamera oder das Handmodell konnte nicht gestartet werden. Prüfe die Kamerafreigabe und HTTPS.');
    }
  }, []);

  useEffect(() => {
    if (cameraState !== 'ready') return;

    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (video && canvas && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const result = landmarker.detectForVideo(video, performance.now());
        const context = canvas.getContext('2d');

        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          const drawing = new DrawingUtils(context);
          for (const landmarks of result.landmarks) {
            drawing.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { lineWidth: 4 });
            drawing.drawLandmarks(landmarks, { radius: 4 });
          }
        }

        const detectedHands = result.landmarks.length;
        setHands(detectedHands);
        if (detectedHands > 0) {
          let current: number | 'heart' | 'stop';
          if (isHeartGesture(result.landmarks)) {
            current = 'heart';
          } else if (result.landmarks.some((hand) => isMiddleFingerGesture(hand))) {
            current = 'stop';
          } else {
            current = result.landmarks.reduce((sum, hand) => sum + countExtendedFingers(hand), 0);
          }

          historyRef.current = [...historyRef.current.slice(-6), current];
          const counts = new Map<number | 'heart' | 'stop', number>();
          for (const value of historyRef.current) counts.set(value, (counts.get(value) ?? 0) + 1);
          const stable = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
          if (stable && stable[1] >= 3) setDisplayValue(stable[0]);
        } else {
          historyRef.current = [];
          setDisplayValue(null);
        }
      }
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [cameraState]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
  }, []);

  const shown = displayValue === 'heart' ? '❤️' : displayValue === 'stop' ? '🛑' : displayValue ?? '–';

  return (
    <div className="number-app">
      <header>
        <div>
          <span className="eyebrow">KI-Werkstatt</span>
          <h1>Zahlen mit Händen</h1>
        </div>
      </header>

      <main className="number-main">
        <section className="camera-card">
          <div className="camera-wrap">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {cameraState !== 'ready' && <div className="camera-placeholder"><span>✋</span><p>Kamera ist noch aus</p></div>}
          </div>
          {(cameraState === 'off' || cameraState === 'error') && <button className="primary big" onClick={startCamera}>Kamera starten</button>}
          <div className="status" role="status">{message}</div>
        </section>

        <section className="number-display" aria-live="polite">
          <span className="number-label">Ergebnis</span>
          <strong className={typeof shown === 'string' && shown.length > 1 ? 'gesture-symbol' : ''}>{shown}</strong>
          <span className="hand-status">{hands === 0 ? 'Keine Hand erkannt' : hands === 1 ? 'Eine Hand erkannt' : 'Zwei Hände erkannt'}</span>
        </section>
      </main>

      <footer>Die Handbilder werden ausschließlich live im Browser verarbeitet und nicht gespeichert.</footer>
    </div>
  );
}
