import { booleans, transforms } from '@jscad/modeling';
import { cloverFrame, centeredRoundedCube, roundedFrame } from './utils';

import { Params, Hole } from '../params';
import { subtract } from '@jscad/modeling/src/operations/booleans';
// import { holes } from './holes';
import { lidScrewHoles, screwBosses } from './screws';
import { Feature } from './feature';


const { union } = booleans;
const { translate } = transforms;

export const lidInsert = ({
  width,
  length,
  wall,
  roof,
  lidScrews,
  cornerRadius,
  insertThickness,
  insertHeight,
  insertClearance,
  baseLidScrewDiameter,
  lidScrewDiameter,
  sunkenLidScrewHeads,
  lidScrewHeadDiameter }: Params) => {

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
    return translate([-width / 2, -length / 2, 0], translate(
      insertOrigin,
      cloverFrame(
        width - wall * 2 - insertClearance * 2,
        length - wall * 2 - insertClearance * 2,
        insertHeight,
        insertThickness,
        diameterMax / 2 + cornerRadius / 4 + wall / 2 + (sunkenLidScrewHeads ? wall : 0),
      ),
    ));
  }

  return translate([-width / 2, -length / 2, 0], translate(
    insertOrigin,
    roundedFrame(
      width - wall * 2 - insertClearance * 2,
      length - wall * 2 - insertClearance * 2,
      insertHeight,
      insertThickness,
      cornerRadius,
    ),
  ));
};

export type LidWithHolesParams = {
  width: number;
  length: number;
  roof: number;
  wall: number;
  cornerRadius: number;
  lidScrews: boolean;
  lidScrewDiameter: number;
  sunkenLidScrewHeads: boolean;
  lidScrewHeadDiameter: number;
  lidScrewHeadDepth: number;
  height: number;
  insertHeight: number;
  insertThickness: number;
  insertClearance: number;
  holes: Hole[];
}


export const lidWithHoles = ({
  width,
  length,
  roof,
  wall,
  cornerRadius,
  lidScrews,
  lidScrewDiameter,
  sunkenLidScrewHeads,
  lidScrewHeadDiameter,
  lidScrewHeadDepth,
  height,
  insertHeight,
  insertThickness,
  insertClearance,
  holes: holeParams,
}: LidWithHolesParams) => {
  const entities = [];
  const subtracts = [];
  entities.push(centeredRoundedCube(width, length, roof, cornerRadius));
  // const lidHoles = holes({
  //   length,
  //   width,
  //   height,
  //   roof,
  //   wall,
  //   insertHeight,
  //   insertThickness,
  //   insertClearance,
  //   holes: holeParams
  // }, ['top']);
  // if (lidHoles) {
  //   subtracts.push(lidHoles);
  // }
  const screwHoles = lidScrewHoles({
    width,
    length,
    roof,
    wall,
    cornerRadius,
    lidScrews,
    lidScrewDiameter,
    sunkenLidScrewHeads,
    lidScrewHeadDiameter,
    lidScrewHeadDepth,
  });
  if (screwHoles) {
    subtracts.push(screwHoles);
  }
  return subtract(union(entities), union(subtracts));

}

export const lid = (params: Params) => {
  const entities = [];
  entities.push(lidWithHoles(params));
  // entities.push(lidInsert(params));
  // const bosses = screwBosses(params);
  const screwHoles = lidScrewHoles(params);
  // if (bosses && screwHoles) {
  //   entities.push(subtract(bosses, screwHoles));
  // }
  return union(entities);
};


export const lidFeature = (params: Params): Feature => {
  const geometry = lid(params);
  return { geometry, surface: 'plane', x: 0, y: 0 };
};

export const lidWithHolesFeature = (params: Params): Feature => {
  const geometry = lidWithHoles(params);
  return { geometry, surface: 'plane', x: 0, y: 0 };
};

export const lidInsertFeature = (params: Params): Feature => {
  const geometry = lidInsert(params);
  return { geometry, surface: 'plane', x: 0, y: 0 };
};
