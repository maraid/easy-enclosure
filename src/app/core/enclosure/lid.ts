import { transforms } from '@jscad/modeling';
import { Params } from '../params';
import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { cloverFrame, centeredRoundedCube, roundedFrame } from './utils';

const { translate } = transforms;

export type LidInsertParams = Pick<
  Params,
  | 'width'
  | 'length'
  | 'wall'
  | 'lidScrews'
  | 'cornerRadius'
  | 'insertThickness'
  | 'insertHeight'
  | 'insertClearance'
  | 'baseLidScrewDiameter'
  | 'lidScrewDiameter'
  | 'sunkenLidScrewHeads'
  | 'lidScrewHeadDiameter'
>;

export const lidInsert = ({
  width,
  length,
  wall,
  lidScrews,
  cornerRadius,
  insertThickness,
  insertHeight,
  insertClearance,
  baseLidScrewDiameter,
  lidScrewDiameter,
  sunkenLidScrewHeads,
  lidScrewHeadDiameter,
}: LidInsertParams): Geom3 => {
  const insertOrigin: [number, number, number] = [
    wall + insertClearance,
    wall + insertClearance,
    0,
  ];

  if (lidScrews) {
    const diameterMax = Math.max(
      baseLidScrewDiameter,
      lidScrewDiameter,
      sunkenLidScrewHeads ? lidScrewHeadDiameter : 0,
    );
    return translate(
      [-width / 2, -length / 2, 0],
      translate(
        insertOrigin,
        cloverFrame(
          width - wall * 2 - insertClearance * 2,
          length - wall * 2 - insertClearance * 2,
          insertHeight,
          insertThickness,
          diameterMax / 2 + cornerRadius / 4 + wall / 2 + (sunkenLidScrewHeads ? wall : 0),
        ),
      ),
    );
  }

  return translate(
    [-width / 2, -length / 2, 0],
    translate(
      insertOrigin,
      roundedFrame(
        width - wall * 2 - insertClearance * 2,
        length - wall * 2 - insertClearance * 2,
        insertHeight,
        insertThickness,
        cornerRadius,
      ),
    ),
  );
};

export type LidParams = {
  width: number;
  length: number;
  roof: number;
  cornerRadius: number;
};

export const lid = ({ width, length, roof, cornerRadius }: LidParams) => {
  return centeredRoundedCube(width, length, roof, cornerRadius);
};
