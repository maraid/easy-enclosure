import type { Surface } from './enclosure';

export type Hole = {
  id: string;
  name?: string;
  shape: 'circle' | 'square' | 'rectangle';
  diameter: number;
  width: number;
  length: number;
  surface: Surface;
  x: number;
  y: number;
};

export type PCBMount = {
  id: string;
  name?: string;
  surface: Surface;
  x: number;
  y: number;
  height: number;
  outerDiameter: number;
  screwDiameter: number;
};

export type CableClamp = {
  id: string;
  name?: string;
  x: number;
  y: number;
  length: number;
  wallHeight: number;
  wallThickness: number;
  mountScrewDiameter: number;
  mountOuterDiameter: number;
  mountHeight: number;
  rotation: number;
  topHeight: number;
  topScrewDiameter: number;
  surface: Surface;
};

export type InternalWall = {
  id: string;
  name?: string;
  x: number;
  y: number;
  height: number;
  length: number;
  thickness: number;
  rotation: number;
  surface: Surface;
};

export type PCB = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  surface: Surface;
  screwOffset: number;
  enabled: boolean;
  guides: boolean;
  guideThickness: number; // e.g. 1mm
  guideClearance: number; // how far above pcb.z the guide pokes up
  guideInset: number;
};

export type Params = {
  length: number;
  width: number;
  height: number;
  floor: number;
  roof: number;
  wall: number;
  waterProof: boolean;
  sealThickness: number;
  insertThickness: number;
  insertHeight: number;
  insertClearance: number;
  showLid: boolean;
  showBase: boolean;
  showGrid: boolean;
  gridSpacing: number;
  cornerRadius: number;
  holes: Hole[];
  pcbMounts: PCBMount[];
  internalWalls: InternalWall[];
  cableClamps: CableClamp[];
  wallMounts: boolean;
  wallMountCount: number;
  wallMountScrewDiameter: number;
  lidScrews: boolean;
  lidScrewDiameter: number;
  baseLidScrewDiameter: number;
  sunkenLidScrewHeads: boolean;
  lidScrewHeadDiameter: number;
  lidScrewHeadDepth: number;
  boreHoleClearance: number;
  bossOuterDiameter: number;
  pcb: PCB;
};

export const DEFAULT_PARAMS: Params = {
  length: 80,
  width: 100,
  height: 30,
  floor: 2,
  roof: 2,
  wall: 1,
  waterProof: true,
  sealThickness: 2,
  insertThickness: 2,
  insertHeight: 4,
  insertClearance: 0.04,
  showLid: true,
  showBase: true,
  showGrid: true,
  gridSpacing: 10,
  cornerRadius: 3,
  holes: [
    {
      id: 'hole-1',
      shape: 'circle',
      surface: 'front',
      diameter: 12.5,
      width: 10,
      length: 10,
      x: 0,
      y: 0,
    },
    {
      id: 'hole-2',
      shape: 'square',
      surface: 'left',
      diameter: 10,
      width: 12,
      length: 10,
      x: 0,
      y: 0,
    },
    {
      id: 'hole-3',
      shape: 'rectangle',
      surface: 'back',
      width: 40,
      length: 6,
      diameter: 10,
      x: 0,
      y: 0,
    },
    {
      id: 'hole-4',
      shape: 'square',
      surface: 'right',
      width: 12.5,
      length: 10,
      diameter: 10,
      x: 0,
      y: 0,
    },
    {
      id: 'hole-5',
      shape: 'square',
      surface: 'top',
      width: 30,
      length: 10,
      diameter: 10,
      x: 0,
      y: 0,
    },
  ],
  pcbMounts: [
    {
      id: 'mount1',
      surface: 'bottom',
      x: 30,
      y: 24,
      height: 5,
      outerDiameter: 6,
      screwDiameter: 2,
    },
    {
      id: 'mount2',
      surface: 'bottom',
      x: -30,
      y: 24,
      height: 5,
      outerDiameter: 6,
      screwDiameter: 2,
    },
    {
      id: 'mount3',
      surface: 'bottom',
      x: -30,
      y: -24,
      height: 5,
      outerDiameter: 6,
      screwDiameter: 2,
    },
    {
      id: 'mount4',
      surface: 'bottom',
      x: 30,
      y: -24,
      height: 5,
      outerDiameter: 6,
      screwDiameter: 2,
    },
  ],
  internalWalls: [
    {
      id: 'wall1',
      x: 0,
      y: 0,
      height: 10,
      length: 25,
      thickness: 2,
      rotation: 0,
      surface: 'bottom',
    },
  ],
  cableClamps: [
    {
      id: 'clamp-1',
      name: 'Clamp 1',
      x: 40,
      y: 0,
      length: 15,
      wallHeight: 7,
      wallThickness: 5,
      mountScrewDiameter: 2,
      mountOuterDiameter: 6,
      mountHeight: 10,
      rotation: 0,
      topHeight: 2,
      topScrewDiameter: 2.5,
      surface: 'bottom',
    },
  ],
  wallMounts: true,
  wallMountCount: 4,
  wallMountScrewDiameter: 3.98,
  lidScrews: true,
  lidScrewDiameter: 2.5,
  baseLidScrewDiameter: 2,
  sunkenLidScrewHeads: false,
  lidScrewHeadDiameter: 4,
  lidScrewHeadDepth: 3,
  boreHoleClearance: 0.04,
  bossOuterDiameter: 6,
  pcb: {
    id: 'pcb',
    enabled: true,
    x: 0,
    y: 0,
    z: 10,
    width: 30,
    length: 40,
    surface: 'bottom',
    screwOffset: 2,
    guides: true,
    guideClearance: 1.2,
    guideThickness: 2,
    guideInset: 0.1,
  },
};

export const cloneParams = (params: Params): Params => {
  return JSON.parse(JSON.stringify(params)) as Params;
};
