import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawingUtils, FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { normalizePose, predictKnn } from './ml';
import { findCell, MAZE, move, type Point } from './maze';
import type { Action, PoseClass, Prediction } from './types';

const DEFAULT_CLASSES: PoseClass[] = [
  { id: 'left', name: 'Links', action: 'left', samples: [] },
  { id: 'right', name: 'Rechts', action: 'right', samples: [] },
  { id: 'up', name: 'Hoch', action: 'up', samples: [] },
  { id: 'down', name: 'Runter', action: 'down', samples: [] },
  { id: 'neutral', name: 'Neutral', action: 'neutral', samples: [] },
];

type Mode = 'train' | 'test' | 'play';
const STORE_KEY = 'pose-labyrinth-v1';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const latestVector = useRef<number[] | null>(null);
  const lastVideoTime = useRef(-1);
  const historyRef = useRef<Prediction[]>([]);
  const lastMoveAt = useRef(0);

  const [mode, setMode] = useState<Mode>('train');
  const [classes, setClasses] = useState<PoseClass[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '') || DEFAULT_CLASSES; } catch { return DEFAULT_CLASSES; }
  });
  const [selectedId, setSelectedId] = useState('left');
  const [cameraState, setCameraState] = useState<'off' | 'loading' | 'ready' | 'error'>('off');
  const [message, setMessage] = useState('Starte die Kamera, um Trainingsbeispiele aufzunehmen.');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [player, setPlayer] = useState<Point>(() => findCell('S'));
  const goal = useMemo(() => findCell('Z'), []);

  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(classes)); }, [classes]);

  const startCamera = useCallback(async () => {
    setCameraState('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
      );
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.55, minPosePresenceConfidence: 0.55, minTrackingConfidence: 0.55,
      });
      setCameraState('ready');
      setMessage('Kamera bereit. Stelle dich so hin, dass dein Oberkörper gut sichtbar ist.');
    } catch (error) {
      console.error(error);
      setCameraState('error');
      setMessage('Die Kamera konnte nicht gestartet werden. Prüfe die Kamerafreigabe und öffne die Seite über HTTPS.');
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
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const draw = new DrawingUtils(ctx);
          for (const landmarks of result.landmarks) {
            draw.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { lineWidth: 3 });
            draw.drawLandmarks(landmarks, { radius: 3 });
          }
        }
        const landmarks: NormalizedLandmark[] | undefined = result.landmarks[0];
        latestVector.current = landmarks ? normalizePose(landmarks) : null;
        if (mode !== 'train' && latestVector.current) {
          const raw = predictKnn(latestVector.current, classes);
          if (raw) {
            historyRef.current = [...historyRef.current.slice(-4), raw];
            const matching = historyRef.current.filter((p) => p.classId === raw.classId).length;
            const stable = matching >= 3 ? raw : null;
            setPrediction(stable);
            if (mode === 'play' && stable && stable.confidence >= 0.65 && stable.action !== 'neutral') {
              const now = performance.now();
              if (now - lastMoveAt.current > 650) {
                setPlayer((old) => move(old, stable.action));
                lastMoveAt.current = now;
              }
            }
          }
        }
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [cameraState, classes, mode]);

  useEffect(() => {
    if (player.x === goal.x && player.y === goal.y) setMessage('Ziel erreicht! Das Modell hat das Labyrinth geschafft.');
  }, [goal, player]);

  function recordSample() {
    const vector = latestVector.current;
    if (!vector) { setMessage('Noch keine sichere Körperpose erkannt. Zeige deinen Oberkörper vollständig.'); return; }
    setClasses((old) => old.map((c) => c.id === selectedId ? { ...c, samples: [...c.samples, vector] } : c));
    setMessage('Beispiel gespeichert. Verändere die Pose oder deinen Abstand leicht und nimm ein weiteres auf.');
  }

  function clearSelected() {
    setClasses((old) => old.map((c) => c.id === selectedId ? { ...c, samples: [] } : c));
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify({ version: 1, classes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pose-labyrinth-projekt.json'; a.click();
    URL.revokeObjectURL(url);
  }

  const enoughData = classes.every((c) => c.samples.length >= 5);

  return (
    <div className="app">
      <header>
        <div><span className="eyebrow">KI-Werkstatt</span><h1>Pose-Labyrinth</h1></div>
        <button className="secondary" onClick={exportProject}>Projekt exportieren</button>
      </header>

      <nav aria-label="Arbeitsbereiche">
        {(['train', 'test', 'play'] as Mode[]).map((item, index) => (
          <button key={item} className={mode === item ? 'active' : ''} disabled={item !== 'train' && !enoughData}
            onClick={() => { setMode(item); historyRef.current = []; setPrediction(null); }}>
            {index + 1}. {item === 'train' ? 'Trainieren' : item === 'test' ? 'Testen' : 'Spielen'}
          </button>
        ))}
      </nav>

      <main>
        <section className="camera-card">
          <div className="camera-wrap">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {cameraState !== 'ready' && <div className="camera-placeholder"><span>◉</span><p>Kamera ist noch aus</p></div>}
          </div>
          {cameraState === 'off' || cameraState === 'error' ? <button className="primary big" onClick={startCamera}>Kamera starten</button> : null}
          <div className="status" role="status">{message}</div>
          {mode !== 'train' && <div className="prediction"><span>Erkannt</span><strong>{prediction?.name ?? '–'}</strong><small>{prediction ? `${Math.round(prediction.confidence * 100)} %` : 'Pose kurz halten'}</small></div>}
        </section>

        {mode === 'train' && <section className="panel">
          <h2>Trainingsklasse wählen</h2>
          <div className="class-list">
            {classes.map((c) => <button key={c.id} className={selectedId === c.id ? 'class active' : 'class'} onClick={() => setSelectedId(c.id)}>
              <span>{arrow(c.action)}</span><strong>{c.name}</strong><small>{c.samples.length} Beispiele</small>
            </button>)}
          </div>
          <div className="actions">
            <button className="primary" disabled={cameraState !== 'ready'} onClick={recordSample}>Beispiel aufnehmen</button>
            <button className="secondary" onClick={clearSelected}>Klasse leeren</button>
          </div>
          <p className="hint">Für den ersten Test genügen 5 Beispiele pro Klasse. Zuverlässiger wird es ab etwa 20 unterschiedlichen Beispielen.</p>
        </section>}

        {mode === 'test' && <section className="panel test-panel">
          <h2>Modell testen</h2>
          <p>Zeige nacheinander jede trainierte Pose. Die Erkennung erscheint unter dem Kamerabild.</p>
          <div className="quality-grid">{classes.map((c) => <div key={c.id}><strong>{c.name}</strong><span>{c.samples.length}</span><small>Beispiele</small></div>)}</div>
        </section>}

        {mode === 'play' && <section className="panel game-panel">
          <div className="game-title"><div><h2>Labyrinth</h2><p>Halte eine Pose kurz, um ein Feld zu gehen.</p></div><button className="secondary" onClick={() => setPlayer(findCell('S'))}>Neu starten</button></div>
          <div className="maze" style={{ gridTemplateColumns: `repeat(${MAZE[0].length}, 1fr)` }}>
            {MAZE.flatMap((row, y) => [...row].map((cell, x) => {
              const isPlayer = player.x === x && player.y === y;
              return <div key={`${x}-${y}`} className={`cell ${cell === '#' ? 'wall' : 'floor'} ${cell === 'Z' ? 'goal' : ''}`}>{isPlayer ? '●' : cell === 'Z' ? '★' : ''}</div>;
            }))}
          </div>
        </section>}
      </main>
      <footer>Die Kamerabilder werden nur live auf diesem Gerät verarbeitet. Gespeichert werden ausschließlich Körperkoordinaten.</footer>
    </div>
  );
}

function arrow(action: Action) {
  return ({ left: '←', right: '→', up: '↑', down: '↓', neutral: '•' })[action];
}
