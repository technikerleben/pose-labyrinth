import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingUtils, FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

type CameraState = 'off' | 'loading' | 'ready' | 'error';

export default function RaisedHands() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);
  const historyRef = useRef<number[]>([]);

  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [raisedCount, setRaisedCount] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [message, setMessage] = useState('Richte das iPad so aus, dass möglichst viele Oberkörper und Arme sichtbar sind.');

  const startCamera = useCallback(async () => {
    setCameraState('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 10,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      setCameraState('ready');
      setMessage('Kamera bereit. Gezählt wird jede erkannte Person mit mindestens einer deutlich gehobenen Hand.');
    } catch (error) {
      console.error(error);
      setCameraState('error');
      setMessage('Kamera oder Mehrpersonenerkennung konnte nicht gestartet werden. Prüfe Kamerafreigabe und HTTPS.');
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
        let currentRaised = 0;

        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          const drawing = new DrawingUtils(context);
          result.landmarks.forEach((landmarks, index) => {
            const raised = hasRaisedHand(landmarks);
            if (raised) currentRaised += 1;
            drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
              lineWidth: raised ? 5 : 2,
              color: raised ? '#7DBB6F' : '#D0DCE6',
            });
            drawing.drawLandmarks(landmarks, {
              radius: raised ? 5 : 3,
              color: raised ? '#4D8B3F' : '#6A8599',
            });
            const head = landmarks[0];
            if (head && (head.visibility ?? 1) > 0.35) {
              context.save();
              context.fillStyle = raised ? '#4D8B3F' : '#243746';
              context.font = '700 28px system-ui';
              context.textAlign = 'center';
              context.fillText(raised ? '✋' : String(index + 1), head.x * canvas.width, Math.max(30, head.y * canvas.height - 22));
              context.restore();
            }
          });
        } else {
          currentRaised = result.landmarks.filter(hasRaisedHand).length;
        }

        setPeopleCount(result.landmarks.length);
        historyRef.current = [...historyRef.current.slice(-7), currentRaised];
        const frequencies = new Map<number, number>();
        for (const value of historyRef.current) frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
        const stable = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0];
        if (stable && stable[1] >= 3) setRaisedCount(stable[0]);
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

  return (
    <div className="number-app raised-app">
      <header>
        <div><span className="eyebrow">KI-Werkstatt</span><h1>Meldungen zählen</h1></div>
      </header>

      <main className="raised-main">
        <section className="camera-card room-camera">
          <div className="camera-wrap room-view">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {cameraState !== 'ready' && <div className="camera-placeholder"><span>✋</span><p>Raumkamera ist noch aus</p></div>}
          </div>
          {(cameraState === 'off' || cameraState === 'error') && <button className="primary big" onClick={startCamera}>Raumkamera starten</button>}
          <div className="status" role="status">{message}</div>
        </section>

        <section className="number-display raised-display" aria-live="polite">
          <span className="number-label">Gehobene Hände</span>
          <strong>{raisedCount}</strong>
          <span className="hand-status">{peopleCount} {peopleCount === 1 ? 'Person erkannt' : 'Personen erkannt'}</span>
          <p>Eine Person wird höchstens einmal gezählt – auch wenn sie beide Hände hebt.</p>
        </section>
      </main>

      <section className="privacy-note">
        <strong>Hinweis:</strong> Die App erkennt nur Körperpunkte und zählt Meldungen. Sie identifiziert keine Kinder und speichert keine Bilder.
      </section>
    </div>
  );
}

function hasRaisedHand(pose: NormalizedLandmark[]): boolean {
  if (pose.length < 25) return false;
  return armRaised(pose, 11, 13, 15) || armRaised(pose, 12, 14, 16);
}

function armRaised(pose: NormalizedLandmark[], shoulderIndex: number, elbowIndex: number, wristIndex: number): boolean {
  const shoulder = pose[shoulderIndex];
  const elbow = pose[elbowIndex];
  const wrist = pose[wristIndex];
  const visible = Math.min(shoulder.visibility ?? 1, elbow.visibility ?? 1, wrist.visibility ?? 1);
  if (visible < 0.35) return false;

  const torsoWidth = Math.max(Math.abs(pose[11].x - pose[12].x), 0.04);
  const wristClearlyAboveShoulder = wrist.y < shoulder.y - torsoWidth * 0.16;
  const elbowSupportsRaise = elbow.y < shoulder.y + torsoWidth * 0.4;
  const armNotCollapsed = Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y) > torsoWidth * 0.75;
  return wristClearlyAboveShoulder && elbowSupportsRaise && armNotCollapsed;
}
