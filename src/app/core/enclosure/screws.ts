import { union } from '@jscad/modeling/src/operations/booleans';
import { cylinder } from '@jscad/modeling/src/primitives';
import { translate } from '@jscad/modeling/src/operations/transforms';
import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { Params } from '../params';

const screws = (
  length: number,
  width: number,
  height: number,
  offset: number,
  diameter: number,
) => {
  return union(
    translate([offset, offset, height / 2], cylinder({ radius: diameter / 2, height: height })),
    translate(
      [width - offset, offset, height / 2],
      cylinder({ radius: diameter / 2, height: height }),
    ),
    translate(
      [offset, length - offset, height / 2],
      cylinder({ radius: diameter / 2, height: height }),
    ),
    translate(
      [width - offset, length - offset, height / 2],
      cylinder({ radius: diameter / 2, height: height }),
    ),
  );
};

const counterBores = (
  length: number,
  width: number,
  roof: number,
  offset: number,
  diameter: number,
  depth: number,
) => {
  const bore = cylinder({ radius: diameter / 2, height: depth });
  const z = roof - depth / 2;
  return union(
    translate([offset, offset, z], bore),
    translate([width - offset, offset, z], bore),
    translate([offset, length - offset, z], bore),
    translate([width - offset, length - offset, z], bore),
  );
};

const counterBoresFromBottom = (
  length: number,
  width: number,
  offset: number,
  diameter: number,
  depth: number,
) => {
  const bore = cylinder({ radius: diameter / 2, height: depth, center: [0, 0, depth / 2] });
  return union(
    translate([offset, offset, 0], bore),
    translate([width - offset, offset, 0], bore),
    translate([offset, length - offset, 0], bore),
    translate([width - offset, length - offset, 0], bore),
  );
};

const screwBoss = (
  length: number,
  width: number,
  height: number,
  offset: number,
  diameter: number,
  zStart = 0,
) => {
  const boss = cylinder({ radius: diameter / 2, height: height });
  const z = zStart + height / 2;
  return union(
    translate([offset, offset, z], boss),
    translate([width - offset, offset, z], boss),
    translate([offset, length - offset, z], boss),
    translate([width - offset, length - offset, z], boss),
  );
};

export type DiameterMaxParams = {
  sunkenLidScrewHeads: boolean;
  lidScrewDiameter: number;
  lidScrewHeadDiameter: number;
};

const diameterMax = ({
  sunkenLidScrewHeads,
  lidScrewDiameter,
  lidScrewHeadDiameter,
}: DiameterMaxParams) => {
  return Math.max(lidScrewDiameter, sunkenLidScrewHeads ? lidScrewHeadDiameter : 0);
};

const bossOuterDiameter = (
  wall: number,
  sunkenLidScrewHeads: boolean,
  lidScrewDiameter: number,
  lidScrewHeadDiameter: number,
) => {
  return diameterMax({ sunkenLidScrewHeads, lidScrewDiameter, lidScrewHeadDiameter }) + wall * 2;
};

type ScrewOffsetParams = Pick<
  Params,
  'wall' | 'cornerRadius' | 'sunkenLidScrewHeads' | 'lidScrewDiameter' | 'lidScrewHeadDiameter'
>;

const screwOffset = ({
  wall,
  cornerRadius,
  sunkenLidScrewHeads,
  lidScrewDiameter,
  lidScrewHeadDiameter,
}: ScrewOffsetParams) => {
  return (
    diameterMax({ sunkenLidScrewHeads, lidScrewDiameter, lidScrewHeadDiameter }) / 2 +
    cornerRadius / 4 +
    wall +
    (sunkenLidScrewHeads ? wall : 0)
  );
};

export type IsSunkenParams = Pick<
  Params,
  'sunkenLidScrewHeads' | 'lidScrewHeadDepth' | 'lidScrewHeadDiameter'
>;

export const isSunken = ({
  sunkenLidScrewHeads,
  lidScrewHeadDepth,
  lidScrewHeadDiameter,
}: IsSunkenParams) => {
  return sunkenLidScrewHeads && lidScrewHeadDepth > 0 && lidScrewHeadDiameter > 0;
};

export type LidScrewHolesParams = {
  width: number;
  length: number;
  roof: number;
  wall: number;
  cornerRadius: number;
  lidScrewDiameter: number;
  sunkenLidScrewHeads: boolean;
  lidScrewHeadDiameter: number;
  lidScrewHeadDepth: number;
};

export const lidScrewHoles = ({
  width,
  length,
  roof,
  wall,
  cornerRadius,
  lidScrewDiameter,
  sunkenLidScrewHeads,
  lidScrewHeadDiameter,
  lidScrewHeadDepth,
}: LidScrewHolesParams): Geom3 => {
  const subtracts: Geom3[] = [];

  const holeHeight = sunkenLidScrewHeads ? roof + lidScrewHeadDepth : roof;

  const offset = screwOffset({
    wall,
    cornerRadius,
    sunkenLidScrewHeads,
    lidScrewDiameter,
    lidScrewHeadDiameter,
  });

  subtracts.push(screws(length, width, holeHeight, offset, lidScrewDiameter));

  if (isSunken({ sunkenLidScrewHeads, lidScrewHeadDepth, lidScrewHeadDiameter })) {
    subtracts.push(
      counterBoresFromBottom(length, width, offset, lidScrewHeadDiameter, lidScrewHeadDepth),
    );
  }

  return translate([-width / 2, -length / 2, 0], union(subtracts));
};

export type ScrewBossParams = Pick<
  Params,
  | 'length'
  | 'width'
  | 'roof'
  | 'wall'
  | 'cornerRadius'
  | 'lidScrewDiameter'
  | 'sunkenLidScrewHeads'
  | 'lidScrewHeadDiameter'
  | 'lidScrewHeadDepth'
>;

export const screwBosses = ({
  length,
  width,
  roof,
  wall,
  cornerRadius,
  lidScrewDiameter,
  sunkenLidScrewHeads,
  lidScrewHeadDiameter,
  lidScrewHeadDepth,
}: ScrewBossParams): Geom3 => {
  return translate(
    [-width / 2, -length / 2, 0],
    screwBoss(
      length,
      width,
      lidScrewHeadDepth,
      screwOffset({
        wall,
        cornerRadius,
        sunkenLidScrewHeads,
        lidScrewDiameter,
        lidScrewHeadDiameter,
      }),
      bossOuterDiameter(wall, sunkenLidScrewHeads, lidScrewDiameter, lidScrewHeadDiameter),
      roof,
    ),
  );
};

export type BaseScrewHolesParams = Pick<
  Params,
  | 'length'
  | 'width'
  | 'height'
  | 'wall'
  | 'cornerRadius'
  | 'sunkenLidScrewHeads'
  | 'lidScrewDiameter'
  | 'lidScrewHeadDiameter'
  | 'lidScrewHeadDepth'
  | 'boreHoleClearance'
  | 'baseLidScrewDiameter'
>;

export const baseScrewHoles = ({
  length,
  width,
  height,
  wall,
  cornerRadius,
  sunkenLidScrewHeads,
  lidScrewDiameter,
  lidScrewHeadDiameter,
  lidScrewHeadDepth,
  boreHoleClearance,
  baseLidScrewDiameter,
}: BaseScrewHolesParams): Geom3 => {
  const subtracts: Geom3[] = [];

  const offset = screwOffset({
    wall,
    cornerRadius,
    sunkenLidScrewHeads,
    lidScrewDiameter,
    lidScrewHeadDiameter,
  });
  subtracts.push(screws(length, width, height, offset, baseLidScrewDiameter));

  const baseRecessDepth = Math.min(Math.max(lidScrewHeadDepth, 0), height);

  if (sunkenLidScrewHeads && lidScrewHeadDiameter > 0 && baseRecessDepth > 0) {
    const bossOuterDiameter =
      diameterMax({ sunkenLidScrewHeads, lidScrewDiameter, lidScrewHeadDiameter }) + wall * 2;
    subtracts.push(
      counterBores(
        length,
        width,
        height,
        offset,
        bossOuterDiameter + boreHoleClearance * 2,
        baseRecessDepth + boreHoleClearance,
      ),
    );
  }

  return translate([-width / 2, -length / 2, 0], union(subtracts));
};
