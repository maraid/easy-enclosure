import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { subtract } from '@jscad/modeling/src/operations/booleans';
import { cylinder } from '@jscad/modeling/src/primitives';

import { PCBMount } from '../params';

type PcbMountParams = Pick<PCBMount, 'height' | 'outerDiameter' | 'screwDiameter'>;

export const pcbMount = ({ height, outerDiameter, screwDiameter }: PcbMountParams): Geom3 => {
  return subtract(
    cylinder({
      height: height,
      radius: outerDiameter / 2,
      segments: 20,
      center: [0, 0, height / 2],
    }),
    cylinder({
      height: height,
      radius: screwDiameter / 2,
      segments: 20,
      center: [0, 0, height / 2],
    }),
  );
};
