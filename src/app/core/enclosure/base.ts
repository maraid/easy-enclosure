import { booleans } from '@jscad/modeling';
import { Params } from '../params';

import { holes } from './holes';
import { clover, centeredHollowRoundCube, hollowRoundCube, roundedCube, centerGeom } from './utils';
import { waterProofSealCutout } from './waterproofseal';
import { baseScrewHoles } from './screws';
import { Feature } from './feature';
import { translate } from '@jscad/modeling/src/operations/transforms';

const { subtract, union } = booleans;


const cloveredFrame = (params: Params) => {
  const {
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
    lidScrewHeadDiameter
  } = params;

  let _wall = wall;

  if (params.waterProof) {
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
}

export const base = (params: Params) => {
  const {
    length,
    width,
    height,
    wall,
    floor,
    cornerRadius,
    insertThickness,
    insertClearance,
  } = params;

  const body = [];
  const subtracts = [];

  let _wall = wall;

  if (params.waterProof) {
    _wall = wall * 2 + insertClearance * 2 + insertThickness;
  }

  if (params.lidScrews) {
    body.push(cloveredFrame(params));
    const screwHoles = baseScrewHoles(params);
    if (screwHoles) {
      subtracts.push(screwHoles);
    }
  } else {
    body.push(centeredHollowRoundCube(width, length, height, _wall, floor, cornerRadius));
  }
  const seal = waterProofSealCutout(params);
  if (seal) {
    subtracts.push(seal);
  }
  const baseHoles = holes(params);
  if (baseHoles) {
    subtracts.push(baseHoles);
  }
  if (subtracts.length) {
    return subtract(union(body), union(subtracts));
  }
  return union(body);
};

export const baseFeature = (params: Params): Feature => {
  const geometry = base(params);
  return {
    geometry,
    surface: 'plane',
    x: 0,
    y: 0,
  };
}
