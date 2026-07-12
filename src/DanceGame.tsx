import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawingUtils, FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { normalizePose, predictKnn } from './ml';
import { DANCE_POSES, type DancePoseId } from './dancePoses';

const STORE_KEY = 'dance-pose-game-v1';
const TARGET_SAMPLES = 5;

type CameraState = 'off' | 'loading' | 'ready' | 'error';
type Phase = 'train' | 'play' | 'result';
type TrainingStore = Record<DancePoseId, number[][]>;

const EMPTY_STORE: TrainingStore = {
  tpose: [],
  ypose: [],
  touchdown: [],
  'left-up': [],
  'right-up': [],
};

export default function DanceGame() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const latestVector = useRef<number[] | null>(null);
  const lastVideoTime = useRef(-1);
  const holdStartRef = useRef<number | null>(null);
  const scoredTargetRef = useRef<DancePoseId | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [message, setMessage] = useState('Starte die Kamera und trainiere jede Pose ein paar Mal.');
  const [samples, setSamples] = useState<TrainingStore>(() => {
    try {
      return { ...EMPTY_STORE, ...(JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Partial<TrainingStore>) };
    } catch {
      return EMPTY_STORE;
    }
  });
  const [selected, setSelected] = useState<DancePoseId>('tpose');
  const [phase, setPhase] = useState<Phase>('train');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [targetId, setTargetId] = useState<DancePoseId>('tpose');
  const [recognizedId, setRecognizedId] = useState<DancePoseId | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(samples));
  }, [samples]);

  const classes = useMemo(
    () => DANCE_POSES.map((pose) => ({ id: pose.id, name: pose.name, action: 'neutral' as const, samples: samples[pose.id] })),
    [samples],
  );

  const trainedEnough = DANCE_POSES.every((pose) => samples[pose.id].length >= TARGET_SAMPLES);
  const targetPose = DANCE_POSES.find((pose) => pose.id === targetId) ?? DANCE_POSES[0];

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
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      setCameraState('ready');
      setMessage('Kamera bereit. Wähle eine Pose aus und nimm Beispiele auf.');
    } catch (error) {
      console.error(error);
      setCameraState('error');
      setMessage('Kamera oder Pose-Modell konnte nicht gestartet werden. Prüfe Kamerafreigabe und HTTPS.');
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

        if (phase === 'play' && latestVector.current) {
          const prediction = predictKnn(latestVector.current, classes);
          const predicted = (prediction?.classId as DancePoseId | undefined) ?? null;
          setRecognizedId(predicted);

          if (predicted === targetId && (prediction?.confidence ?? 0) >= 0.66) {
            const now = performance.now();
            if (holdStartRef.current === null) holdStartRef.current = now;
            const progress = Math.min(1, (now - holdStartRef.current) / 900);
            setHoldProgress(progress);

            if (progress >= 1 && scoredTargetRef.current !== targetId) {
              scoredTargetRef.current = targetId;
              setScore((old) => old + 1);
              setRound((old) => old + 1);
              const next = chooseNextTarget(targetId);
              setTargetId(next);
              holdStartRef.current = null;
              setHoldProgress(0);
            }
          } else {
            holdStartRef.current = null;
            setHoldProgress(0);
          }
        }
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [cameraState, classes, phase, targetId]);

  useEffect(() => {
    scoredTargetRef.current = null;
  }, [targetId]);

  useEffect(() => {
    if (phase !== 'play') return;
    if (timeLeft <= 0) {
      setPhase('result');
      setMessage('Die Tanzrunde ist beendet.');
      return;
    }
    const id = window.setTimeout(() => setTimeLeft((old) => old - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, timeLeft]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
  }, []);

  function chooseNextTarget(previous?: DancePoseId): DancePoseId {
    const pool = DANCE_POSES.map((pose) => pose.id).filter((id) => id !== previous);
    return pool[Math.floor(Math.random() * pool.length)] ?? 'tpose';
  }

  function recordSample() {
    const vector = latestVector.current;
    if (!vector) {
      setMessage('Noch keine sichere Pose erkannt. Zeige Oberkörper und Arme vollständig.');
      return;
    }
    setSamples((old) => ({ ...old, [selected]: [...old[selected], vector] }));
    setMessage('Beispiel gespeichert. Verändere Abstand oder Haltung leicht und nimm weitere auf.');
  }

  function clearSelected() {
    setSamples((old) => ({ ...old, [selected]: [] }));
  }

  function startGame() {
    setTargetId(chooseNextTarget());
    setScore(0);
    setRound(0);
    setTimeLeft(45);
    setRecognizedId(null);
    setHoldProgress(0);
    holdStartRef.current = null;
    scoredTargetRef.current = null;
    setPhase('play');
    setMessage('Tanze die angezeigte Pose nach und halte sie kurz.');
  }

  function resetTraining() {
    setSamples(EMPTY_STORE);
    setPhase('train');
    setMessage('Alle Trainingsdaten wurden gelöscht.');
  }

  return (
    <div className="number-app dance-app">
      <header>
        <div>
          <span className="eyebrow">KI-Werkstatt</span>
          <h1>Tanzspiel</h1>
        </div>
        <div className="dance-header-actions">
          <button className="secondary" onClick={resetTraining}>Training löschen</button>
          {phase !== 'play' && <button className="primary" disabled={!trainedEnough} onClick={startGame}>Spiel starten</button>}
        </div>
      </header>

      <main className="dance-main">
        <section className="camera-card">
          <div className="camera-wrap">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {cameraState !== 'ready' && <div className="camera-placeholder"><span>🕺</span><p>Kamera ist noch aus</p></div>}
          </div>
          {(cameraState === 'off' || cameraState === 'error') && <button className="primary big" onClick={startCamera}>Kamera starten</button>}
          <div className="status" role="status">{message}</div>
          <div className="dance-meta">
            <span>Zeit: <strong>{phase === 'train' ? '–' : `${timeLeft}s`}</strong></span>
            <span>Punkte: <strong>{score}</strong></span>
            <span>Erkannt: <strong>{recognizedId ? DANCE_POSES.find((pose) => pose.id === recognizedId)?.name : '–'}</strong></span>
          </div>
        </section>

        {phase === 'train' && (
          <section className="panel">
            <h2>Posen trainieren</h2>
            <p>Wähle eine Pose aus, ahme die Grafik nach und speichere mindestens fünf Beispiele.</p>
            <div className="dance-grid">
              {DANCE_POSES.map((pose) => (
                <button key={pose.id} className={`dance-card ${selected === pose.id ? 'active' : ''}`} onClick={() => setSelected(pose.id)}>
                  <div className="dance-figure">{pose.svg}</div>
                  <strong>{pose.name}</strong>
                  <small>{pose.tip}</small>
                  <span>{samples[pose.id].length} / {TARGET_SAMPLES} Beispiele</span>
                </button>
              ))}
            </div>
            <div className="actions">
              <button className="primary" disabled={cameraState !== 'ready'} onClick={recordSample}>Beispiel aufnehmen</button>
              <button className="secondary" onClick={clearSelected}>Ausgewählte Pose leeren</button>
            </div>
          </section>
        )}

        {phase === 'play' && (
          <section className="panel dance-play-panel">
            <div className="dance-play-top">
              <div><h2>Mach diese Pose nach</h2><p>{targetPose.tip}</p></div>
              <div className="dance-round-badge">Runde {round + 1}</div>
            </div>
            <div className="dance-target-wrap">
              <div className="dance-target-card">
                <div className="dance-target-svg">{targetPose.svg}</div>
                <strong>{targetPose.name}</strong>
              </div>
              <div className="dance-progress-wrap">
                <span>Pose halten</span>
                <div className="dance-progress"><div style={{ width: `${holdProgress * 100}%` }} /></div>
              </div>
            </div>
          </section>
        )}

        {phase === 'result' && (
          <section className="panel dance-result-panel">
            <h2>Geschafft</h2>
            <div className="dance-result-score">{score}</div>
            <p>Du hast in 45 Sekunden {score} Posen richtig nachgemacht.</p>
            <div className="actions">
              <button className="primary" onClick={startGame}>Nochmal spielen</button>
              <button className="secondary" onClick={() => setPhase('train')}>Zurück zum Training</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
