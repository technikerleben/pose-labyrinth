import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

function angle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const lengths = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!lengths) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / lengths))) * 180 / Math.PI;
}

export function countExtendedFingers(hand: NormalizedLandmark[]): number {
  if (hand.length < 21) return 0;

  let count = 0;
  const fingers = [
    [5, 6, 8],
    [9, 10, 12],
    [13, 14, 16],
    [17, 18, 20],
  ];

  for (const [mcp, pip, tip] of fingers) {
    const straight = angle(hand[mcp], hand[pip], hand[tip]) > 155;
    const tipFartherFromWrist = distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.08;
    if (straight && tipFartherFromWrist) count += 1;
  }

  const thumbStraight = angle(hand[2], hand[3], hand[4]) > 145;
  const thumbOpen = distance(hand[4], hand[5]) > distance(hand[3], hand[5]) * 1.18;
  if (thumbStraight && thumbOpen) count += 1;

  return count;
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
