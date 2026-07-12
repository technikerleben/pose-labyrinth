import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { PoseClass, Prediction } from './types';

const USED = [0, 11, 12, 13, 14, 15, 16, 23, 24];

export function normalizePose(points: NormalizedLandmark[]): number[] | null {
  if (!points || points.length < 25) return null;
  const ls = points[11];
  const rs = points[12];
  const lh = points[23];
  const rh = points[24];
  const visibility = USED.map((i) => points[i].visibility ?? 1);
  if (Math.min(...visibility) < 0.35) return null;

  const cx = (lh.x + rh.x) / 2;
  const cy = (lh.y + rh.y) / 2;
  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  const torsoHeight = Math.hypot((ls.x + rs.x) / 2 - cx, (ls.y + rs.y) / 2 - cy);
  const scale = Math.max(shoulderWidth, torsoHeight, 0.08);

  const vector: number[] = [];
  for (const i of USED) {
    vector.push((points[i].x - cx) / scale, (points[i].y - cy) / scale);
  }
  return vector;
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function predictKnn(vector: number[], classes: PoseClass[], k = 5): Prediction | null {
  const neighbors = classes.flatMap((poseClass) =>
    poseClass.samples.map((sample) => ({ poseClass, d: distance(vector, sample) })),
  );
  if (!neighbors.length) return null;
  neighbors.sort((a, b) => a.d - b.d);
  const nearest = neighbors.slice(0, Math.min(k, neighbors.length));
  const votes = new Map<string, { count: number; distance: number; poseClass: PoseClass }>();
  for (const item of nearest) {
    const current = votes.get(item.poseClass.id) ?? { count: 0, distance: 0, poseClass: item.poseClass };
    current.count += 1;
    current.distance += item.d;
    votes.set(item.poseClass.id, current);
  }
  const winner = [...votes.values()].sort((a, b) => b.count - a.count || a.distance - b.distance)[0];
  const voteShare = winner.count / nearest.length;
  const closeness = 1 / (1 + winner.distance / winner.count);
  return {
    classId: winner.poseClass.id,
    name: winner.poseClass.name,
    action: winner.poseClass.action,
    confidence: Math.min(0.99, voteShare * 0.75 + closeness * 0.25),
  };
}
