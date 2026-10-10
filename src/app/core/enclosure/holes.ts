import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { cuboid, cylinder } from '@jscad/modeling/src/primitives';
import { mirrorZ } from '@jscad/modeling/src/operations/transforms';

import { Params } from '../params';
import { Hole } from '../params';
import { centeredRoundedCube, roundedCube } from './utils';

const TOP_HOLE_DEPTH_TOLERANCE = 0.2;

export const hole = (
  { floor, roof, wall, insertHeight, insertThickness, insertClearance, waterProof }: Params,
  { shape, diameter, width: holeWidth, length: holeLength, surface, rounded, cornerRadius }: Hole,
) => {
  let wallThickness = wall;
  if (waterProof) {
    wallThickness = wall * 2 + insertClearance * 2 + insertThickness;
  } else {
    wallThickness = wall;
  }
  const lidThickness = roof + insertHeight + TOP_HOLE_DEPTH_TOLERANCE;
  const bottomThickness = floor;

  let holeDepth = 0;
  switch (surface) {
    case 'top':
      holeDepth = lidThickness;
      break;
    case 'bottom':
      holeDepth = bottomThickness;
      break;
    case 'left':
    case 'right':
    case 'front':
    case 'back':
    case 'plane':
      holeDepth = wallThickness;
      break;
    default:
      throw new Error(`Invalid surface: ${surface}`);
  }

  let geometry: Geom3;
  switch (shape) {
    case 'circle':
      const radius = diameter / 2;
      geometry = cylinder({
        radius: radius,
        height: holeDepth,
        center: [0, 0, -holeDepth / 2],
      });
      break;
    case 'rectangle':
      if (rounded) {
        geometry = centeredRoundedCube(holeWidth, holeLength, holeDepth, cornerRadius);
        geometry = mirrorZ(geometry); // mirror to point it downwards for subtraction
      } else {
        geometry = cuboid({
          size: [holeWidth, holeLength, holeDepth],
          center: [0, 0, -holeDepth / 2],
        });
      }
      break;
    case 'square':
      if (rounded) {
        geometry = centeredRoundedCube(holeWidth, holeWidth, holeDepth, cornerRadius);
        geometry = mirrorZ(geometry); // mirror to point it downwards for subtraction
      } else {
        geometry = cuboid({
          size: [holeWidth, holeWidth, holeDepth],
          center: [0, 0, -holeDepth / 2],
        });
      }
      break;
    default:
      throw new Error(`Invalid shape: ${shape}`);
  }
  return geometry;
};
