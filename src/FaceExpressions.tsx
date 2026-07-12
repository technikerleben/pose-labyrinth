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
          historyRef.current = [...historyRef.current.slice(-6), current.emoji];
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
  const average = (...values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

  const smile = average(s.mouthSmileLeft ?? 0, s.mouthSmileRight ?? 0);
  const jawOpen = s.jawOpen ?? 0;
  const eyeWide = average(s.eyeWideLeft ?? 0, s.eyeWideRight ?? 0);
  const browUp = s.browInnerUp ?? 0;
  const browDown = average(s.browDownLeft ?? 0, s.browDownRight ?? 0);
  const mouthPress = average(s.mouthPressLeft ?? 0, s.mouthPressRight ?? 0);
  const mouthFrown = average(s.mouthFrownLeft ?? 0, s.mouthFrownRight ?? 0);
  const mouthLowerDown = average(s.mouthLowerDownLeft ?? 0, s.mouthLowerDownRight ?? 0);
  const eyeSquint = average(s.eyeSquintLeft ?? 0, s.eyeSquintRight ?? 0);

  const surpriseScore = jawOpen * 0.65 + eyeWide * 0.25 + browUp * 0.1;
  const sadnessScore = mouthFrown * 0.55 + browUp * 0.25 + mouthLowerDown * 0.2;
  const angerScore = browDown * 0.6 + mouthPress * 0.25 + eyeSquint * 0.15;

  // Staunen zuerst prüfen: Ein offener Mund kann sonst fälschlich als Lächeln wirken.
  if (jawOpen > 0.42 && (eyeWide > 0.12 || browUp > 0.18) && surpriseScore > 0.34) {
    return { emoji: '😮', label: 'Überrascht' };
  }

  if (smile > 0.42 && mouthFrown < 0.22) {
    return { emoji: '🙂', label: 'Fröhlich' };
  }

  if (angerScore > 0.42 && browDown > 0.28) {
    return { emoji: '😠', label: 'Ärgerlich' };
  }

  // Traurigkeit wird vor allem über heruntergezogene Mundwinkel und angehobene innere Brauen erkannt.
  if ((mouthFrown > 0.28 && browUp > 0.12) || sadnessScore > 0.34) {
    return { emoji: '😢', label: 'Traurig' };
  }

  return NEUTRAL;
}
