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

function fingerExtended(hand: NormalizedLandmark[], mcp: number, pip: number, tip: number): boolean {
  const straight = angle(hand[mcp], hand[pip], hand[tip]) > 155;
  const tipFartherFromWrist = distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.08;
  return straight && tipFartherFromWrist;
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
    if (fingerExtended(hand, mcp, pip, tip)) count += 1;
  }

  const thumbStraight = angle(hand[2], hand[3], hand[4]) > 145;
  const thumbOpen = distance(hand[4], hand[5]) > distance(hand[3], hand[5]) * 1.18;
  if (thumbStraight && thumbOpen) count += 1;

  return count;
}

export function isMiddleFingerGesture(hand: NormalizedLandmark[]): boolean {
  if (hand.length < 21) return false;
  const index = fingerExtended(hand, 5, 6, 8);
  const middle = fingerExtended(hand, 9, 10, 12);
  const ring = fingerExtended(hand, 13, 14, 16);
  const pinky = fingerExtended(hand, 17, 18, 20);
  return middle && !index && !ring && !pinky;
}

export function isHeartGesture(hands: NormalizedLandmark[][]): boolean {
  if (hands.length !== 2) return false;
  const [a, b] = hands;
  if (a.length < 21 || b.length < 21) return false;

  const palmScale = (distance(a[0], a[9]) + distance(b[0], b[9])) / 2;
  if (palmScale < 0.03) return false;

  const indexTipsClose = distance(a[8], b[8]) < palmScale * 0.75;
  const thumbTipsClose = distance(a[4], b[4]) < palmScale * 0.75;
  const wristsApart = distance(a[0], b[0]) > palmScale * 1.35;
  const indexAboveThumbs = (a[8].y + b[8].y) / 2 < (a[4].y + b[4].y) / 2;
  const handsFaceEachOther = distance(a[5], b[5]) < distance(a[17], b[17]);

  return indexTipsClose && thumbTipsClose && wristsApart && indexAboveThumbs && handsFaceEachOther;
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
