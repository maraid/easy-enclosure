import { rotate, translate, mirror } from '@jscad/modeling/src/operations/transforms';
import { degToRad } from '@jscad/modeling/src/utils';
import { cuboid, cylinder } from '@jscad/modeling/src/primitives';
import { union } from '@jscad/modeling/src/operations/booleans';

import { Params } from '../params';
import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Vec3 } from '@jscad/modeling/src/maths/types';
import { Surface, SURFACES } from '.';

import { Hole } from '../params';
import { Feature } from './feature';

const TOP_HOLE_DEPTH_TOLERANCE = 0.2;


export const hole2 = (
  {
    floor,
    roof,
    wall,
    insertHeight,
    insertThickness,
    insertClearance
  }: Params,
  {
    shape,
    diameter,
    width: holeWidth,
    length: holeLength,
    surface,
  }: Hole,
) => {
  const wallThickness = insertThickness + insertClearance * 2 + wall * 2;
  const lidThickness = roof + insertHeight + TOP_HOLE_DEPTH_TOLERANCE;
  const bottomThickness = floor;

  let holeDepth = 0;
  if (surface === 'top') {
    holeDepth = lidThickness;
  } else if (surface === 'bottom') {
    holeDepth = bottomThickness;
  } else {
    holeDepth = wallThickness;
  }

  let geometry: Geom3;
  switch (shape) {
    case 'circle':
      const radius = diameter / 2;
      geometry = cylinder({
        radius: radius,
        height: holeDepth,
        center: [0, 0, - holeDepth / 2],
      });
      break;
    case 'rectangle':
      geometry = cuboid({
        size: [holeWidth, holeLength, holeDepth],
        center: [0, 0, - holeDepth / 2],
      });
      break;
    case 'square':
      geometry = cuboid({
        size: [holeWidth, holeWidth, holeDepth],
        center: [0, 0, - holeDepth / 2],
      });
      break;
    default:
      throw new Error(`Invalid shape: ${shape}`);
  }
  return geometry;
};

