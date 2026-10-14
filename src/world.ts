import Phaser from 'phaser';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A point light that switches on at dusk. */
export interface Light {
  x: number;
  y: number;
  r: number;
  color: number;
}

export const WORLD_W = 1920;
export const WORLD_H = 1280;
export const ROADS_V = [320, 960, 1600];
export const ROADS_H = [260, 640, 1020];
export const ROAD_W = 120;

// Drive-to zone for the depot (on the road, beside the depot building).
export const DEPOT = { x: 960, y: 780 };
export const DEPOT_RECT: Rect = { x: 1040, y: 720, w: 240, h: 160 };

export const HOUSES: Record<string, { rect: Rect; color: number; door: { x: number; y: number } }> = {
  maple: { rect: { x: 392, y: 395, w: 120, h: 110 }, color: 0xe58aa0, door: { x: 392, y: 450 } },
  rex: { rect: { x: 1400, y: 395, w: 120, h: 110 }, color: 0xf0a05a, door: { x: 1520, y: 450 } },
  pixel: { rect: { x: 392, y: 795, w: 120, h: 110 }, color: 0xa991e8, door: { x: 392, y: 850 } },
  doc: { rect: { x: 1040, y: 1095, w: 120, h: 110 }, color: 0x6cd0b0, door: { x: 1040, y: 1150 } },
  cap: { rect: { x: 1400, y: 795, w: 120, h: 110 }, color: 0x73b3e6, door: { x: 1520, y: 850 } },
};

// Golden-hour outback palette
const C = {
  asphalt: 0x37323d,
  asphaltEdge: 0x4a444f,
  sidewalk: 0xdccfb5,
  grass: 0xa9b96a,
  grassDark: 0x94a55a,
  lane: 0xf2c14e,
  zebra: 0xf3eee0,
};
const PALETTE = [0xd9825b, 0xe8b86b, 0x8fb8a3, 0xc98b9a, 0x7aa6c2, 0xe6d3a8];

const BLOCK_X: [number, number][] = [[0, 260], [380, 900], [1020, 1540], [1660, 1920]];
const BLOCK_Y: [number, number][] = [[0, 200], [320, 580], [700, 960], [1080, 1280]];

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shade = (c: number, amt: number): number => {
  const col = Phaser.Display.Color.IntegerToColor(c);
  return amt >= 0 ? col.lighten(amt).color : col.darken(-amt).color;
};

const overlaps = (a: Rect, b: Rect, m = 0): boolean =>
  a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

function drawBuilding(g: Phaser.GameObjects.Graphics, r: Rect, color: number, rand: () => number): void {
  g.fillStyle(0x000000, 0.24).fillRoundedRect(r.x + 10, r.y + 13, r.w, r.h, 14);
  g.fillStyle(shade(color, -16), 1).fillRoundedRect(r.x, r.y, r.w, r.h, 14);
  // pitched roof: lit half + shaded half + ridge
  const hh = (r.h - 12) / 2;
  g.fillStyle(shade(color, 8), 1).fillRoundedRect(r.x + 5, r.y + 5, r.w - 10, hh, { tl: 11, tr: 11, bl: 0, br: 0 });
  g.fillStyle(shade(color, -6), 1).fillRoundedRect(r.x + 5, r.y + 5 + hh, r.w - 10, hh + 2, { tl: 0, tr: 0, bl: 11, br: 11 });
  g.fillStyle(shade(color, -22), 0.7).fillRect(r.x + 8, r.y + 5 + hh - 1.5, r.w - 16, 3);
  // chimney / vent
  g.fillStyle(shade(color, -30), 1).fillRoundedRect(r.x + r.w - 32, r.y + 14, 14, 16, 3);
  g.fillStyle(0x000000, 0.2).fillRect(r.x + r.w - 30, r.y + 16, 10, 4);
  if (rand() > 0.5) {
    g.fillStyle(shade(color, 18), 1).fillRoundedRect(r.x + 16, r.y + r.h - 38, 28, 12, 3);
    g.fillStyle(shade(color, -10), 1).fillRect(r.x + 18, r.y + r.h - 36, 24, 2);
  }
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  g.fillStyle(0x000000, 0.22).fillEllipse(x + 9, y + 13, 50 * s, 32 * s);
  g.fillStyle(0x4a6f3a, 1).fillCircle(x, y, 23 * s);
  g.fillStyle(0x6f9a4e, 1).fillCircle(x - 5 * s, y - 6 * s, 15 * s);
  g.fillStyle(0xa3c46d, 0.85).fillCircle(x - 9 * s, y - 10 * s, 6.5 * s);
}

function drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x000000, 0.3).fillEllipse(x + 6, y + 8, 18, 9);
  g.fillStyle(0x2a2630, 1).fillCircle(x, y, 5);
  g.fillStyle(0xffe9b0, 1).fillCircle(x, y, 3.2);
}

/** Draws the city; returns solid obstacles (all blocks – road-only driving) and the night lights. */
export function buildWorld(scene: Phaser.Scene): { obstacles: Rect[]; lights: Light[] } {
  const rand = rng(11);
  const g = scene.add.graphics().setDepth(0);
  const lights: Light[] = [];
  const obstacles: Rect[] = BLOCK_X.flatMap(([x0, x1]) => BLOCK_Y.map(([y0, y1]) => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })));

  // Asphalt base + road wear
  g.fillStyle(C.asphalt, 1).fillRect(0, 0, WORLD_W, WORLD_H);
  g.fillStyle(0x000000, 0.1);
  for (let i = 0; i < 90; i++) {
    const onV = rand() > 0.5;
    const x = onV ? ROADS_V[Math.floor(rand() * 3)] + (rand() - 0.5) * 100 : rand() * WORLD_W;
    const y = onV ? rand() * WORLD_H : ROADS_H[Math.floor(rand() * 3)] + (rand() - 0.5) * 100;
    g.fillEllipse(x, y, 14 + rand() * 40, 8 + rand() * 18);
  }

  // Blocks: sidewalk ring + dry-grass lot
  for (const [x0, x1] of BLOCK_X) {
    for (const [y0, y1] of BLOCK_Y) {
      g.fillStyle(C.asphaltEdge, 1).fillRoundedRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6, 24); // curb shadow
      g.fillStyle(C.sidewalk, 1).fillRoundedRect(x0, y0, x1 - x0, y1 - y0, 22);
      g.fillStyle(C.grass, 1).fillRoundedRect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24, 14);
      // mow stripes
      g.fillStyle(C.grassDark, 0.3);
      for (let sx = x0 + 28; sx < x1 - 24; sx += 36) g.fillRect(sx, y0 + 16, 14, y1 - y0 - 32);
    }
  }

  // Lane markings (warm yellow)
  g.fillStyle(C.lane, 0.95);
  for (const x of ROADS_V) for (let y = 10; y < WORLD_H; y += 60) if (!ROADS_H.some((ry) => Math.abs(y + 15 - ry) < 85)) g.fillRect(x - 3, y, 6, 30);
  for (const y of ROADS_H) for (let x = 10; x < WORLD_W; x += 60) if (!ROADS_V.some((rx) => Math.abs(x + 15 - rx) < 85)) g.fillRect(x, y - 3, 30, 6);

  // Crosswalks + street lamps at every intersection
  g.fillStyle(C.zebra, 0.8);
  for (const cx of ROADS_V) {
    for (const cy of ROADS_H) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(cx - 4 + i * 16, cy - 82, 8, 18).fillRect(cx - 4 + i * 16, cy + 64, 8, 18);
        g.fillRect(cx - 82, cy - 4 + i * 16, 18, 8).fillRect(cx + 64, cy - 4 + i * 16, 18, 8);
      }
    }
  }
  for (const cx of ROADS_V) {
    for (const cy of ROADS_H) {
      for (const [dx, dy] of [[-76, -76], [76, 76]] as const) {
        drawLamp(g, cx + dx, cy + dy);
        lights.push({ x: cx + dx, y: cy + dy, r: 150, color: 0xffd9a0 });
      }
    }
  }

  // Customer houses (+ doors with porch lights)
  const specials: Rect[] = [DEPOT_RECT, ...Object.values(HOUSES).map((h) => h.rect)];
  Object.values(HOUSES).forEach((h) => {
    drawBuilding(g, h.rect, h.color, rand);
    g.fillStyle(0x3a2a22, 1).fillRoundedRect(h.door.x - 6, h.door.y - 12, 12, 24, 3);
    lights.push({ x: h.door.x + (h.door.x < 700 ? -18 : 18), y: h.door.y, r: 120, color: 0xffe2b0 });
  });

  // Depot: warehouse with bay doors + flood lights
  const d = DEPOT_RECT;
  g.fillStyle(0x000000, 0.28).fillRoundedRect(d.x + 11, d.y + 15, d.w, d.h, 14);
  g.fillStyle(0x1b2547, 1).fillRoundedRect(d.x, d.y, d.w, d.h, 14);
  g.fillStyle(0x2b3a67, 1).fillRoundedRect(d.x + 6, d.y + 6, d.w - 12, d.h - 14, 11);
  g.fillStyle(0x394c85, 1).fillRoundedRect(d.x + 6, d.y + 6, d.w - 12, 40, { tl: 11, tr: 11, bl: 0, br: 0 });
  g.fillStyle(0xffc233, 1).fillRect(d.x + 6, d.y + 56, d.w - 12, 10);
  g.fillStyle(0x10172e, 1);
  for (let i = 0; i < 3; i++) g.fillRoundedRect(d.x + 20 + i * 70, d.y + 82, 52, 50, 6);
  g.fillStyle(0xffc233, 0.9);
  for (let i = 0; i < 3; i++) g.fillRect(d.x + 24 + i * 70, d.y + 86, 44, 3);
  lights.push({ x: d.x - 14, y: d.y + 30, r: 190, color: 0xfff0c0 }, { x: d.x - 14, y: d.y + d.h - 24, r: 190, color: 0xfff0c0 });

  // Filler buildings and trees
  for (const [x0, x1] of BLOCK_X) {
    for (const [y0, y1] of BLOCK_Y) {
      const iw = x1 - x0 - 48;
      const ih = y1 - y0 - 48;
      const nx = Math.floor(iw / 140);
      const ny = Math.floor(ih / 120);
      if (nx < 1 || ny < 1) {
        drawTree(g, (x0 + x1) / 2, (y0 + y1) / 2, 0.9);
        continue;
      }
      const cw = iw / nx;
      const ch = ih / ny;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const cell: Rect = { x: x0 + 24 + i * cw + 10, y: y0 + 24 + j * ch + 10, w: cw - 20, h: ch - 20 };
          if (specials.some((s) => overlaps(cell, s, 14))) {
            if (!specials.some((s) => overlaps({ x: cell.x + cw / 2 - 10, y: cell.y + ch / 2 - 10, w: 20, h: 20 }, s, 30))) drawTree(g, cell.x + cell.w / 2, cell.y + cell.h / 2, 0.85);
            continue;
          }
          if (rand() < 0.2) {
            drawTree(g, cell.x + cell.w * 0.35, cell.y + cell.h * 0.45, 1);
            drawTree(g, cell.x + cell.w * 0.7, cell.y + cell.h * 0.6, 0.8);
            continue;
          }
          const sw = cell.w * (0.78 + rand() * 0.22);
          const sh = cell.h * (0.78 + rand() * 0.22);
          const b: Rect = { x: cell.x + (cell.w - sw) / 2, y: cell.y + (cell.h - sh) / 2, w: sw, h: sh };
          drawBuilding(g, b, PALETTE[Math.floor(rand() * PALETTE.length)], rand);
        }
      }
    }
  }
  return { obstacles, lights };
}
