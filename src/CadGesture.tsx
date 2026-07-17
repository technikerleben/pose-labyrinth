import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingUtils, FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

type CameraState = 'off' | 'loading' | 'ready' | 'error';

type HandControl = {
  active: boolean;
  openness: number;
  rotationX: number;
  rotationY: number;
};

const INITIAL_CONTROL: HandControl = {
  active: false,
  openness: 0,
  rotationX: -18,
  rotationY: 28,
};

export default function CadGesture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const baselineOpenRef = useRef(0.85);
  const activeRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [message, setMessage] = useState('Starte die Kamera und forme mit einer Hand ein leicht geöffnetes C.');
  const [control, setControl] = useState<HandControl>(INITIAL_CONTROL);

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
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      setCameraState('ready');
      setMessage('Hand erkannt. Forme ein C, um die 3D-Steuerung zu aktivieren.');
    } catch (error) {
      console.error(error);
      setCameraState('error');
      setMessage('Kamera oder Handmodell konnte nicht gestartet werden. Prüfe Kamerafreigabe und HTTPS.');
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
        const landmarks = result.landmarks[0];
        const context = canvas.getContext('2d');

        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          if (landmarks) {
            const drawing = new DrawingUtils(context);
            drawing.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { lineWidth: 4 });
            drawing.drawLandmarks(landmarks, { radius: 4 });
          }
        }

        if (landmarks) updateFromHand(landmarks);
        else {
          lastCenterRef.current = null;
          if (activeRef.current) setMessage('Hand kurz aus dem Bild. Halte sie wieder vollständig vor die Kamera.');
        }
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [cameraState]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
  }, []);

  function updateFromHand(hand: NormalizedLandmark[]) {
    const center = handCenter(hand);
    const openness = handOpenness(hand);
    const cGesture = isCGesture(hand);

    if (!activeRef.current) {
      if (cGesture) {
        activeRef.current = true;
        baselineOpenRef.current = openness;
        lastCenterRef.current = center;
        setControl((old) => ({ ...old, active: true, openness: 0 }));
        setMessage('Steuerung aktiv: Hand bewegen zum Drehen, weiter öffnen zum Auseinanderziehen.');
      }
      return;
    }

    const previous = lastCenterRef.current;
    lastCenterRef.current = center;

    const explosion = clamp((openness - baselineOpenRef.current + 0.08) / 0.75, 0, 1);
    setControl((old) => ({
      active: true,
      openness: old.openness * 0.72 + explosion * 0.28,
      rotationY: previous ? old.rotationY + (center.x - previous.x) * 230 : old.rotationY,
      rotationX: previous ? clamp(old.rotationX - (center.y - previous.y) * 180, -70, 70) : old.rotationX,
    }));
  }

  function resetView() {
    activeRef.current = false;
    lastCenterRef.current = null;
    setControl(INITIAL_CONTROL);
    setMessage('Ansicht zurückgesetzt. Forme erneut ein C, um die Steuerung zu aktivieren.');
  }

  const explode = Math.round(control.openness * 100);
  const assemblyStyle = {
    '--rotate-x': `${control.rotationX}deg`,
    '--rotate-y': `${control.rotationY}deg`,
    '--explode': `${control.openness}`,
  } as React.CSSProperties;

  return (
    <div className="number-app cad-app">
      <header>
        <div>
          <span className="eyebrow">KI-Werkstatt</span>
          <h1>Gesten-CAD</h1>
        </div>
        <button className="secondary" onClick={resetView}>Ansicht zurücksetzen</button>
      </header>

      <main className="cad-main">
        <section className="camera-card cad-camera">
          <div className="camera-wrap">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {cameraState !== 'ready' && <div className="camera-placeholder"><span>🤏</span><p>Kamera ist noch aus</p></div>}
          </div>
          {(cameraState === 'off' || cameraState === 'error') && <button className="primary big" onClick={startCamera}>Kamera starten</button>}
          <div className="status" role="status">{message}</div>
          <div className="cad-readout">
            <span className={control.active ? 'active' : ''}>{control.active ? 'Steuerung aktiv' : 'Warte auf C-Geste'}</span>
            <strong>Explosion {explode}%</strong>
          </div>
        </section>

        <section className="panel cad-stage-panel">
          <div className="cad-stage" aria-label="Dreidimensionale technische Baugruppe">
            <div className="cad-grid-floor" />
            <div className="cad-assembly" style={assemblyStyle}>
              <div className="cad-part cad-shaft" />
              <div className="cad-part cad-backplate" />
              <div className="cad-part cad-bearing cad-bearing-back"><i /></div>
              <div className="cad-part cad-gear"><i /></div>
              <div className="cad-part cad-bearing cad-bearing-front"><i /></div>
              <div className="cad-part cad-frontplate" />
              <div className="cad-part cad-cap" />
            </div>
          </div>
          <div className="cad-legend">
            <div><span className="cad-dot start" /><strong>1. Start</strong><small>Hand leicht als C öffnen.</small></div>
            <div><span className="cad-dot rotate" /><strong>2. Drehen</strong><small>C-Hand seitlich oder nach oben bewegen.</small></div>
            <div><span className="cad-dot explode" /><strong>3. Explodieren</strong><small>Hand weiter öffnen oder wieder schließen.</small></div>
          </div>
        </section>
      </main>
      <footer>Die Handbewegungen werden ausschließlich live im Browser ausgewertet.</footer>
    </div>
  );
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function handCenter(hand: NormalizedLandmark[]) {
  const points = [hand[0], hand[5], hand[9], hand[13], hand[17]];
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function handOpenness(hand: NormalizedLandmark[]) {
  const palm = Math.max(distance(hand[5], hand[17]), 0.02);
  const fingertips = [4, 8, 12, 16, 20];
  return fingertips.reduce((sum, index) => sum + distance(hand[0], hand[index]) / palm, 0) / fingertips.length;
}

function isCGesture(hand: NormalizedLandmark[]) {
  const palm = Math.max(distance(hand[5], hand[17]), 0.02);
  const thumbIndexGap = distance(hand[4], hand[8]) / palm;
  const thumbMiddleGap = distance(hand[4], hand[12]) / palm;
  const indexBent = distance(hand[8], hand[5]) / palm;
  const middleBent = distance(hand[12], hand[9]) / palm;
  return thumbIndexGap > 0.28 && thumbIndexGap < 1.15 && thumbMiddleGap < 1.45 && indexBent < 1.45 && middleBent < 1.55;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
