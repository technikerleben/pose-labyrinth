import type { Action } from './types';

export type Point = { x: number; y: number };
export type Maze = string[];

export function generateMaze(width = 17, height = 11): Maze {
  const w = width % 2 === 0 ? width + 1 : width;
  const h = height % 2 === 0 ? height + 1 : height;
  const grid = Array.from({ length: h }, () => Array(w).fill('#'));
  const stack: Point[] = [{ x: 1, y: 1 }];
  grid[1][1] = ' ';

  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = [
      { x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 },
    ].map((d) => ({ x: current.x + d.x, y: current.y + d.y, dx: d.x, dy: d.y }))
      .filter((n) => n.x > 0 && n.y > 0 && n.x < w - 1 && n.y < h - 1 && grid[n.y][n.x] === '#');

    if (!options.length) {
      stack.pop();
      continue;
    }

    const next = options[Math.floor(Math.random() * options.length)];
    grid[current.y + next.dy / 2][current.x + next.dx / 2] = ' ';
    grid[next.y][next.x] = ' ';
    stack.push({ x: next.x, y: next.y });
  }

  grid[1][1] = 'S';
  grid[h - 2][w - 2] = 'Z';
  return grid.map((row) => row.join(''));
}

export function findCell(maze: Maze, char: string): Point {
  for (let y = 0; y < maze.length; y += 1) {
    const x = maze[y].indexOf(char);
    if (x >= 0) return { x, y };
  }
  return { x: 1, y: 1 };
}

export function move(maze: Maze, point: Point, action: Action): Point {
  const delta = {
    left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], neutral: [0, 0],
  }[action];
  const next = { x: point.x + delta[0], y: point.y + delta[1] };
  if (maze[next.y]?.[next.x] && maze[next.y][next.x] !== '#') return next;
  return point;
}
