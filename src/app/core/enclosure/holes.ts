import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { cuboid, cylinder } from '@jscad/modeling/src/primitives';

import { Params } from '../params';
import { Hole } from '../params';

const TOP_HOLE_DEPTH_TOLERANCE = 0.2;

export const hole = (
  { floor, roof, wall, insertHeight, insertThickness, insertClearance, waterProof }: Params,
  { shape, diameter, width: holeWidth, length: holeLength, surface }: Hole,
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
      geometry = cuboid({
        size: [holeWidth, holeLength, holeDepth],
        center: [0, 0, -holeDepth / 2],
      });
      break;
    case 'square':
      geometry = cuboid({
        size: [holeWidth, holeWidth, holeDepth],
        center: [0, 0, -holeDepth / 2],
      });
      break;
    default:
      throw new Error(`Invalid shape: ${shape}`);
  }
  return geometry;
};
