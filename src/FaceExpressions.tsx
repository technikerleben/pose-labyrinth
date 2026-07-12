import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

type CameraState = 'off' | 'loading' | 'ready' | 'error';
type Expression = { emoji: string; label: string };

const NEUTRAL: Expression = { emoji: '😐', label: 'Neutral' };

export default function FaceExpressions() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);
  const historyRef = useRef<string[]>([]);
  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [expression, setExpression] = useState<Expression>(NEUTRAL);
  const [message, setMessage] = useState('Starte die Kamera und zeige einen deutlichen Gesichtsausdruck.');

  const startCamera = useCallback(async () => {
    setCameraState('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.55, minFacePresenceConfidence: 0.55, minTrackingConfidence: 0.55,
      });
      setCameraState('ready');
      setMessage('Gesicht erkannt. Probiere Lächeln, Staunen, Ärger oder Traurigkeit.');
    } catch (error) {
      console.error(error);
      setCameraState('error');
      setMessage('Kamera oder Gesichtsmodell konnte nicht gestartet werden. Prüfe Kamerafreigabe und HTTPS.');
    }
  }, []);

  useEffect(() => {
    if (cameraState !== 'ready') return;
    const loop = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        const result = landmarker.detectForVideo(video, performance.now());
        const categories = result.faceBlendshapes[0]?.categories ?? [];
        if (categories.length) {
          const scores = Object.fromEntries(categories.map((c) => [c.categoryName, c.score]));
          const current = classify(scores);
          historyRef.current = [...historyRef.current.slice(-5), current.emoji];
          const count = historyRef.current.filter((value) => value === current.emoji).length;
          if (count >= 3) setExpression(current);
        } else {
          historyRef.current = [];
          setExpression(NEUTRAL);
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

  return <div className="number-app face-app">
    <header><div><span className="eyebrow">KI-Werkstatt</span><h1>Gesichtsausdrücke</h1></div></header>
    <main className="number-main">
      <section className="camera-card">
        <div className="camera-wrap">
          <video ref={videoRef} playsInline muted />
          {cameraState !== 'ready' && <div className="camera-placeholder"><span>🙂</span><p>Kamera ist noch aus</p></div>}
        </div>
        {(cameraState === 'off' || cameraState === 'error') && <button className="primary big" onClick={startCamera}>Kamera starten</button>}
        <div className="status" role="status">{message}</div>
      </section>
      <section className="number-display" aria-live="polite">
        <span className="number-label">Erkannter Ausdruck</span>
        <strong className="gesture-symbol">{expression.emoji}</strong>
        <span className="hand-status">{expression.label}</span>
        <p>Die App unterscheidet fünf einfache Ausdrücke: 🙂 😐 😮 😠 😢. Sie erkennt keine Person und speichert keine Gesichtsbilder.</p>
      </section>
    </main>
    <footer>Die Auswertung findet ausschließlich live im Browser statt.</footer>
  </div>;
}

function classify(s: Record<string, number>): Expression {
  const smile = Math.max(s.mouthSmileLeft ?? 0, s.mouthSmileRight ?? 0);
  const surprise = (s.jawOpen ?? 0) + (s.eyeWideLeft ?? 0) + (s.eyeWideRight ?? 0);
  const anger = (s.browDownLeft ?? 0) + (s.browDownRight ?? 0) + (s.mouthPressLeft ?? 0) + (s.mouthPressRight ?? 0);
  const sadness = (s.mouthFrownLeft ?? 0) + (s.mouthFrownRight ?? 0) + (s.browInnerUp ?? 0);
  if (smile > 0.55) return { emoji: '🙂', label: 'Fröhlich' };
  if (surprise > 1.15 && (s.jawOpen ?? 0) > 0.35) return { emoji: '😮', label: 'Überrascht' };
  if (anger > 1.25) return { emoji: '😠', label: 'Ärgerlich' };
  if (sadness > 0.9) return { emoji: '😢', label: 'Traurig' };
  return NEUTRAL;
}
