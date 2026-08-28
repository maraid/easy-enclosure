import { union } from '@jscad/modeling/src/operations/booleans';
import { Params } from '../params';
import { cylinder } from '@jscad/modeling/src/primitives';
import { translate } from '@jscad/modeling/src/operations/transforms';
import { subtract } from '@jscad/modeling/src/operations/booleans';
import { Geom3 } from '@jscad/modeling/src/geometries/types';


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

const diameterMax = (params: Params) => {
  const {
    sunkenLidScrewHeads,
    lidScrewDiameter,
    lidScrewHeadDiameter,
  } = params;
  return Math.max(
    lidScrewDiameter,
    sunkenLidScrewHeads ? lidScrewHeadDiameter : 0,
  );
}

const bossOuterDiameter = (params: Params) => {
  const { wall } = params;
  return diameterMax(params) + wall * 2;
}

const screwOffset = (params: Params) => {
  const {
    wall,
    cornerRadius,
    sunkenLidScrewHeads,
  } = params;
  return diameterMax(params) / 2 +
    cornerRadius / 4 +
    wall +
    (sunkenLidScrewHeads ? wall : 0);
}

const isSunken = (params: Params) => {
  const {
    lidScrewHeadDepth,
    lidScrewHeadDiameter,
    sunkenLidScrewHeads,
  } = params;
  return sunkenLidScrewHeads &&
    lidScrewHeadDepth > 0 &&
    lidScrewHeadDiameter > 0
}

export const lidScrewHoles = (
  params: Params,
): Geom3 | null => {
  const {
    length,
    width,
    roof,
    lidScrewDiameter,
    sunkenLidScrewHeads,
    lidScrewHeadDiameter,
    lidScrewHeadDepth,
  } = params;

  if (!params.lidScrews) {
    return null;
  }

  const subtracts: Geom3[] = [];

  const holeHeight = sunkenLidScrewHeads
    ? roof + lidScrewHeadDepth
    : roof;

  const offset = screwOffset(params);

  subtracts.push(
    screws(
      length,
      width,
      holeHeight,
      screwOffset(params),
      lidScrewDiameter,
    ),
  );

  if (isSunken(params)) {
    subtracts.push(
      counterBoresFromBottom(
        length,
        width,
        offset,
        lidScrewHeadDiameter,
        lidScrewHeadDepth,
      ),
    );
  };

  return translate([-width / 2, -length / 2, 0], union(subtracts));
}


export const screwBosses = (
  params: Params,
): Geom3 | null => {
  const {
    length,
    width,
    roof,
    lidScrewHeadDepth,
  } = params;
  return isSunken(params) ? translate([-width / 2, -length / 2, 0], screwBoss(
    length,
    width,
    lidScrewHeadDepth,
    screwOffset(params),
    bossOuterDiameter(params),
    roof,
  )) : null;
}


export const baseScrewHoles = (
  params: Params,
): Geom3 | null => {
  const {
    length,
    width,
    height,
    wall,
    baseLidScrewDiameter,
    sunkenLidScrewHeads,
    lidScrewHeadDiameter,
    lidScrewHeadDepth,
    boreHoleClearance,
  } = params;

  const subtracts: Geom3[] = [];

  if (!params.lidScrews) {
    return null;
  }

  const offset = screwOffset(params);
  subtracts.push(
    screws(
      length,
      width,
      height,
      offset,
      baseLidScrewDiameter,
    ),
  );

  const baseRecessDepth = Math.min(
    Math.max(lidScrewHeadDepth, 0),
    height,
  );

  if (
    sunkenLidScrewHeads &&
    lidScrewHeadDiameter > 0 &&
    baseRecessDepth > 0
  ) {
    const bossOuterDiameter = diameterMax(params) + wall * 2;
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