import { Params } from '../params';

import { cloverFrame } from './utils';

import { translate } from '@jscad/modeling/src/operations/transforms';
import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { Feature } from './feature';



export type WaterProofSealCutoutParams = Pick<
  Params,
  | 'length' | 'width' | 'height' | 'wall' | 'insertThickness' | 'insertHeight'
  | 'sealThickness' | 'insertClearance' | 'cornerRadius'
  | 'baseLidScrewDiameter' | 'lidScrewDiameter' | 'sunkenLidScrewHeads' | 'lidScrewHeadDiameter'
>;

export const waterProofSealCutout = ({
  length,
  width,
  height,
  wall,
  insertThickness,
  insertHeight,
  sealThickness,
  insertClearance,
  cornerRadius,
  baseLidScrewDiameter,
  lidScrewDiameter,
  sunkenLidScrewHeads,
  lidScrewHeadDiameter,
}: WaterProofSealCutoutParams): Geom3 => {
  const diameterMax = Math.max(
    baseLidScrewDiameter,
    lidScrewDiameter,
    sunkenLidScrewHeads ? lidScrewHeadDiameter : 0,
  );

  return translate([-width / 2, -length / 2, 0], translate(
    [wall, wall, height - (insertHeight + sealThickness)],
    cloverFrame(
      width - wall * 2,
      length - wall * 2,
      insertHeight + sealThickness + insertClearance,
      insertThickness + insertClearance * 2,
      diameterMax / 2 + cornerRadius / 4 + wall / 2 + (sunkenLidScrewHeads ? wall : 0),
    ),
  ));
};

export type WaterProofSealParams = Pick<
  Params,
  | 'length' | 'width' | 'wall' | 'baseLidScrewDiameter' | 'sealThickness'
  | 'insertThickness' | 'insertClearance' | 'cornerRadius'
  | 'lidScrewDiameter' | 'sunkenLidScrewHeads' | 'lidScrewHeadDiameter'
>;

export const waterProofSeal = ({
  length,
  width,
  wall,
  baseLidScrewDiameter,
  sealThickness,
  insertThickness,
  insertClearance,
  cornerRadius,
  lidScrewDiameter,
  sunkenLidScrewHeads,
  lidScrewHeadDiameter,
}: WaterProofSealParams): Geom3 => {
  const diameterMax = Math.max(
    baseLidScrewDiameter,
    lidScrewDiameter,
    sunkenLidScrewHeads ? lidScrewHeadDiameter : 0,
  );
  return translate([-width / 2, -length / 2, 0], cloverFrame(
    width - wall * 2 - insertClearance * 2,
    length - wall * 2 - insertClearance * 2,
    sealThickness,
    insertThickness,
    diameterMax / 2 + cornerRadius / 4 + wall / 2 + (sunkenLidScrewHeads ? wall : 0),
  ));
};
