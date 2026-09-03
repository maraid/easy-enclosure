import { booleans } from '@jscad/modeling';
import { Params } from '../params';

import { clover, centeredHollowRoundCube, roundedCube } from './utils';
import { translate } from '@jscad/modeling/src/operations/transforms';

const { subtract } = booleans;

export type BaseGeometryParams = Pick<
  Params,
  | 'length'
  | 'width'
  | 'height'
  | 'wall'
  | 'floor'
  | 'cornerRadius'
  | 'insertThickness'
  | 'insertClearance'
  | 'waterProof'
  | 'lidScrews'
  | 'sunkenLidScrewHeads'
  | 'baseLidScrewDiameter'
  | 'lidScrewDiameter'
  | 'boreHoleClearance'
  | 'bossOuterDiameter'
  | 'sealThickness'
>;

const cloveredFrame = ({
  length,
  width,
  height,
  wall,
  floor,
  cornerRadius,
  insertThickness,
  insertClearance,
  sunkenLidScrewHeads,
  baseLidScrewDiameter,
  lidScrewDiameter,
  boreHoleClearance,
  bossOuterDiameter,
  waterProof,
}: BaseGeometryParams) => {
  let _wall = wall;
  if (waterProof) {
    _wall = wall * 2 + insertClearance * 2 + insertThickness;
  }

  const diameterMax = Math.max(
    baseLidScrewDiameter,
    lidScrewDiameter,
    sunkenLidScrewHeads ? bossOuterDiameter + boreHoleClearance : 0,
  );

  return translate(
    [-width / 2, -length / 2, 0],
    subtract(
      roundedCube(width, length, height, cornerRadius),
      translate(
        [_wall, _wall, floor],
        clover(width - _wall * 2, length - _wall * 2, height, diameterMax / 2 + cornerRadius / 4),
      ),
    ),
  );
};

export const base = (params: BaseGeometryParams) => {
  const {
    length,
    width,
    height,
    wall,
    floor,
    cornerRadius,
    insertThickness,
    insertClearance,
    waterProof,
    lidScrews,
  } = params;

  const body = [];

  let _wall = wall;
  if (waterProof) {
    _wall = wall * 2 + insertClearance * 2 + insertThickness;
  }

  if (lidScrews) {
    return cloveredFrame(params);
  } else {
    return centeredHollowRoundCube(width, length, height, _wall, floor, cornerRadius);
  }
};
