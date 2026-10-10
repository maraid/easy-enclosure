import { booleans } from '@jscad/modeling';
import { rotateZ, translate } from '@jscad/modeling/src/operations/transforms';
import { degToRad } from '@jscad/modeling/src/utils';

import { subtract } from '@jscad/modeling/src/operations/booleans';
import { cuboid, cylinder } from '@jscad/modeling/src/primitives';
import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { PCB, PCBHole } from '../params';
import { internalWall } from './internalwalls';

const HEIGHT: number = 1;
const PERF_DIAMETER: number = 1;
const PERF_SPACING: number = 2.54;
const SCREWHOLE_DIAMETER: number = 2;

const { union } = booleans;

const perf = (): Geom3 => {
  return cylinder({
    height: HEIGHT,
    radius: PERF_DIAMETER / 2,
    segments: 20,
    center: [0, 0, HEIGHT / 2],
  });
};

const perfs = (width: number, length: number): Geom3 | null => {
  const hole = perf();
  const holes: Geom3[] = [];

  const widthCount = Math.floor((width - 2 * PERF_SPACING) / PERF_SPACING) + 1;
  const lengthCount = Math.floor((length - 2 * PERF_SPACING) / PERF_SPACING) + 1;

  if (widthCount < 1 || lengthCount < 1) {
    return null;
  }

  const widthStart = (width - (widthCount - 1) * PERF_SPACING) / 2;

  const lengthStart = (length - (lengthCount - 1) * PERF_SPACING) / 2;

  for (let i = 0; i < widthCount; i++) {
    for (let j = 0; j < lengthCount; j++) {
      holes.push(
        translate([widthStart + i * PERF_SPACING, lengthStart + j * PERF_SPACING, 0], hole),
      );
    }
  }

  return translate([-width / 2, -length / 2, 0], union(holes));
};

const screwHole = (diameter: number): Geom3 => {
  return cylinder({
    height: HEIGHT,
    radius: diameter / 2,
    segments: 20,
    center: [0, 0, HEIGHT / 2],
  });
};

/** Geometry for one PCB hole, used by the renderer for picking/highlighting. */
export const pcbHole = (diameter: number): Geom3 => screwHole(diameter);

const screwHoles = (holes: PCBHole[]): Geom3 | null => {
  if (!holes.length) return null;
  return union(holes.map((h) => translate([h.x, h.y, 0], screwHole(h.diameter))));
};

export type PcbHoleMountParams = Pick<PCB, 'z' | 'holes'>;

/** Mounts tied to a PCB hole, kept in the PCB's local coordinate system. */
export const pcbHoleMounts = ({ z, holes }: PcbHoleMountParams): Geom3 => {
  const enabledHoles = holes.filter((hole) => hole.mountEnabled);

  return union(
    enabledHoles.map((hole) =>
      translate(
        [hole.x, hole.y, 0],
        subtract(
          cylinder({
            height: z,
            radius: hole.mountOuterDiameter / 2,
            segments: 20,
            center: [0, 0, z / 2],
          }),
          cylinder({
            height: z,
            radius: hole.mountScrewDiameter / 2,
            segments: 20,
            center: [0, 0, z / 2],
          }),
        ),
      ),
    ),
  );
};

type PcbGeometryParams = Pick<PCB, 'width' | 'length' | 'holes'>;

export const pcb = ({ width, length, holes: pcbHoles }: PcbGeometryParams) => {
  let geometry = cuboid({
    size: [width, length, HEIGHT],
    center: [0, 0, HEIGHT / 2],
  });
  const perfHoles = perfs(width, length);
  if (perfHoles) {
    geometry = subtract(geometry, union(perfHoles));
  }
  const screwHolesGeometry = screwHoles(pcbHoles);
  return screwHolesGeometry ? subtract(geometry, screwHolesGeometry) : geometry;
};

export type PcbGuideStubParams = Pick<
  PCB,
  'z' | 'width' | 'length' | 'guideClearance' | 'guideThickness' | 'guideInset'
>;

export const pcbGuideStub = ({
  z,
  width,
  length,
  guideClearance,
  guideThickness,
  guideInset,
}: PcbGuideStubParams): Geom3 => {
  const guideHeight = z + HEIGHT + guideClearance;
  const guideLength = Math.min(width / 3, length / 3);
  const guide = internalWall({
    height: guideHeight,
    length: guideLength,
    thickness: guideThickness,
  });

  const guidePosY = length / 2 + guideInset + guideThickness / 2;
  const guidePosX = width / 2 + guideInset + guideThickness / 2;

  const back = translate([0, -guidePosY, 0], rotateZ(degToRad(90), guide));
  const front = translate([0, guidePosY, 0], rotateZ(degToRad(90), guide));
  const right = translate([guidePosX, 0, 0], guide);
  const left = translate([-guidePosX, 0, 0], guide);
  return union(front, back, left, right);
};
