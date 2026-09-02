import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { cuboid } from '@jscad/modeling/src/primitives';

import { InternalWall } from '../params';

export type InternalWallGeometryParams = Pick<InternalWall, 'height' | 'length' | 'thickness'>;

export const internalWall = ({ height, length, thickness }: InternalWallGeometryParams): Geom3 => {
  return cuboid({
    size: [thickness, length, height],
    center: [0, 0, height / 2],
  });
};
