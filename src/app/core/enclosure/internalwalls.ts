import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { Vec3 } from '@jscad/modeling/src/maths/types';
import { union } from '@jscad/modeling/src/operations/booleans';
import { rotateZ, translate } from '@jscad/modeling/src/operations/transforms';
import { cuboid } from '@jscad/modeling/src/primitives';
import { degToRad } from '@jscad/modeling/src/utils';

import { InternalWall, Params } from '../params';
import { Feature } from './feature';



export type InternalWallGeometryParams = Pick<InternalWall, 'height' | 'length' | 'thickness'>;

export const internalWall = ({
  height,
  length,
  thickness,
}: InternalWallGeometryParams): Geom3 => {
  return cuboid({
    size: [thickness, length, height],
    center: [0, 0, height / 2],
  });
};
