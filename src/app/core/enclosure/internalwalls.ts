import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Vec3 } from '@jscad/modeling/src/maths/types';
import { union } from '@jscad/modeling/src/operations/booleans';
import { rotateZ, translate } from '@jscad/modeling/src/operations/transforms';
import { cuboid } from '@jscad/modeling/src/primitives';
import { degToRad } from '@jscad/modeling/src/utils';

import { InternalWall, Params } from '../params';
import { Feature } from './feature';



export const internalWall = (
  height: number,
  length: number,
  thickness: number,
  rotation: number = 0):
  Geom3 => {
  let wall: Geom3 = cuboid({
    size: [thickness, length, height],
    center: [0, 0, height / 2],
  });
  wall = rotateZ(degToRad(rotation), wall);
  return wall
};


export const internalWallFeature = (wallParams: InternalWall): Feature => {
  const { x, y, height, length, thickness, rotation, surface } = wallParams;
  return { geometry: internalWall(height, length, thickness, rotation), surface, x, y };
};


export const internalWalls = (params: Params) => {
  const { internalWalls, width, length, floor } = params;

  if (!internalWalls.length) {
    return null;
  }

  const walls: Feature[] = [];
  internalWalls.forEach((wall) => {
    walls.push(internalWallFeature(wall));
  });
  return walls;
};
