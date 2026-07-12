import type { Action } from './types';

export const MAZE = [
  '############',
  '#S   #     #',
  '# ## # ### #',
  '#    # #   #',
  '####   # # #',
  '#        #Z#',
  '############',
];

export type Point = { x: number; y: number };

export function findCell(char: string): Point {
  for (let y = 0; y < MAZE.length; y += 1) {
    const x = MAZE[y].indexOf(char);
    if (x >= 0) return { x, y };
  }
  return { x: 1, y: 1 };
}

export function move(point: Point, action: Action): Point {
  const delta = {
    left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], neutral: [0, 0],
  }[action];
  const next = { x: point.x + delta[0], y: point.y + delta[1] };
  if (MAZE[next.y]?.[next.x] && MAZE[next.y][next.x] !== '#') return next;
  return point;
}
