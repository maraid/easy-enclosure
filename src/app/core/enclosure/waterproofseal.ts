import { Params } from '../params';

import { cloverFrame } from './utils';

import { translate } from '@jscad/modeling/src/operations/transforms';
import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { Feature } from './feature';


export const waterProofSealCutout = (params: Params): Geom3 | null => {
  const {
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
    waterProof
  } = params;

  if (!waterProof) {
    // if (params.sunkenLidScrewHeads) {
    //   subtracts.push(
    //     translate( [_wall, _wall, height - baseRecessDepth - params.boreHoleClearance], roundedCube( width - _wall * 2, length  - _wall * 2, height, cornerRadius)),
    //   )
    // }

    return null;
  }

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

export const waterProofSeal = (params: Params) => {
  const {
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
  } = params;
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

export const waterProofSealFeature = (params: Params): Feature => {
  const geometry = waterProofSeal(params);
  return { geometry, surface: 'plane', x: 0, y: 0 };
};
