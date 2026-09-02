import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { subtract, union } from '@jscad/modeling/src/operations/booleans';
import { translate } from '@jscad/modeling/src/operations/transforms';
import { cylinder } from '@jscad/modeling/src/primitives';

import { Params, CableClamp } from '../params';
import { internalWall } from './internalwalls';

export const clampMount = (
  height: number,
  outerDiameter: number,
  screwDiameter: number,
): [Geom3, Geom3] => {
  return [
    cylinder({ center: [0, 0, height / 2], height, radius: outerDiameter / 2, segments: 20 }),
    cylinder({ center: [0, 0, height / 2], height, radius: screwDiameter / 2, segments: 20 }),
  ];
};

export type CableClampGeometryParams = Pick<
  CableClamp,
  | 'length'
  | 'mountHeight'
  | 'mountOuterDiameter'
  | 'mountScrewDiameter'
  | 'wallHeight'
  | 'wallThickness'
>;

export const cableClamp = ({
  length,
  mountHeight,
  mountOuterDiameter,
  mountScrewDiameter,
  wallHeight,
  wallThickness,
}: CableClampGeometryParams): Geom3 => {
  const [mountOuter, mountInner] = clampMount(mountHeight, mountOuterDiameter, mountScrewDiameter);
  const wall = internalWall({ height: wallHeight, length, thickness: wallThickness });

  const leftMountOuter = translate([0, -length / 2, 0], mountOuter);
  const leftMountInner = translate([0, -length / 2, 0], mountInner);
  const rightMountOuter = translate([0, length / 2, 0], mountOuter);
  const rightMountInner = translate([0, length / 2, 0], mountInner);

  return subtract(
    union(leftMountOuter, wall, rightMountOuter),
    union(leftMountInner, rightMountInner),
  );
};

export type CableClampTopGeometryParams = Pick<
  CableClamp,
  'length' | 'mountOuterDiameter' | 'wallThickness' | 'topHeight' | 'topScrewDiameter'
>;

export const cableClampTop = ({
  length,
  mountOuterDiameter,
  wallThickness,
  topHeight,
  topScrewDiameter,
}: CableClampTopGeometryParams): Geom3 => {
  return cableClamp({
    length,
    mountHeight: topHeight,
    mountOuterDiameter,
    mountScrewDiameter: topScrewDiameter,
    wallHeight: topHeight,
    wallThickness,
  });
};
