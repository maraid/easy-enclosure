import { booleans } from '@jscad/modeling';
import { Params } from '../params';

import { clover, centeredHollowRoundCube, roundedCube } from './utils';
import { waterProofSealCutout } from './waterproofseal';
import { baseScrewHoles } from './screws';
import { translate } from '@jscad/modeling/src/operations/transforms';

const { subtract, union } = booleans;

export type BaseGeometryParams = Pick<
  Params,
  | 'length' | 'width' | 'height' | 'wall' | 'floor' | 'cornerRadius'
  | 'insertThickness' | 'insertClearance' | 'waterProof' | 'lidScrews'
  | 'sunkenLidScrewHeads' | 'baseLidScrewDiameter' | 'lidScrewDiameter' | 'lidScrewHeadDiameter'
  | 'sealThickness' // consumed inside waterProofSealCutout — confirm against its real signature
// | ...whatever baseScrewHoles actually reads, once uncommented
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
  lidScrewHeadDiameter,
  waterProof,
}: BaseGeometryParams) => {
  let _wall = wall;
  if (waterProof) {
    _wall = wall * 2 + insertClearance * 2 + insertThickness;
  }

  const diameterMax = Math.max(
    baseLidScrewDiameter,
    lidScrewDiameter,
    sunkenLidScrewHeads ? lidScrewHeadDiameter : 0,
  );

  return translate([-width / 2, -length / 2, 0], subtract(
    roundedCube(width, length, height, cornerRadius),
    translate(
      [_wall, _wall, floor],
      clover(
        width - _wall * 2,
        length - _wall * 2,
        height,
        diameterMax / 2 + cornerRadius / 4 + wall / 2 + (sunkenLidScrewHeads ? wall : 0),
      ),
    ),
  ));
};

export const base = (params: BaseGeometryParams) => {
  const { length, width, height, wall, floor, cornerRadius, insertThickness, insertClearance, waterProof, lidScrews } = params;

  const body = [];

  let _wall = wall;
  if (waterProof) {
    _wall = wall * 2 + insertClearance * 2 + insertThickness;
  }

  if (lidScrews) {
    return cloveredFrame(params);
    // const screwHoles = baseScrewHoles(params);
    // if (screwHoles) subtracts.push(screwHoles);
  } else {
    return centeredHollowRoundCube(width, length, height, _wall, floor, cornerRadius);
  }

  // const seal = waterProofSealCutout(params);
  // if (seal) {
  //   subtracts.push(seal);
  // }
};