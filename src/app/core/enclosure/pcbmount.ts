import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { subtract, union } from '@jscad/modeling/src/operations/booleans';
import { rotateX, rotateY, translate } from '@jscad/modeling/src/operations/transforms';
import { cylinder } from '@jscad/modeling/src/primitives';
import { degToRad } from '@jscad/modeling/src/utils';
import { Surface } from '.';
import { Params, PCBMount } from '../params';
import { Feature } from './feature';


type PcbMountParams = Pick<PCBMount, 'height' | 'outerDiameter' | 'screwDiameter'>;

export const pcbMount = ({ height, outerDiameter, screwDiameter }: PcbMountParams) => {
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
}