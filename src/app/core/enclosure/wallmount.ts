import { subtract, union } from '@jscad/modeling/src/operations/booleans';
import { hull } from '@jscad/modeling/src/operations/hulls';
import { mirrorX, rotateY, translate } from '@jscad/modeling/src/operations/transforms';
import { cube, cuboid, cylinder } from '@jscad/modeling/src/primitives';
import { Geom3 } from '@jscad/modeling/src/geometries/types';


import { Params } from '../params';
import { Feature } from './feature';

const SCREWCLEARANCE = 2;
const RIDGEWIDTH = 2;
const FLOOR = 2;

export const flange = (screwDiameter: number) => {
  const outerWidth = screwDiameter + SCREWCLEARANCE * 2 + RIDGEWIDTH * 2;
  const innerWidth = screwDiameter + SCREWCLEARANCE * 2;

  const outer = hull(
    cuboid({
      size: [outerWidth / 2, outerWidth, outerWidth],
    }),
    translate(
      [-(outerWidth / 2), 0, 0],
      cylinder({
        height: outerWidth,
        radius: outerWidth / 2,
      }),
    ),
  );

  const inner = hull(
    cuboid({
      size: [innerWidth / 2, innerWidth, innerWidth],
    }),
    translate(
      [-(innerWidth / 2) - SCREWCLEARANCE * 2, 0, 0],
      cylinder({
        height: innerWidth,
        radius: innerWidth / 2,
      }),
    ),
  );

  return translate([0, 0, outerWidth / 2], subtract(
    outer,
    translate([RIDGEWIDTH, 0, FLOOR], inner),
    translate([-outerWidth, 0, outerWidth], rotateY(45, cube({ size: outerWidth * 2 }))),
    translate([-outerWidth / 2, 0, 0], cylinder({ height: outerWidth, radius: screwDiameter / 2 })),
  ));
};

export type FlangesGeometryParams = Pick<Params, 'length' | 'width' | 'cornerRadius' | 'wallMountScrewDiameter' | 'wallMountCount'>;

export const flanges = ({
  length,
  width,
  cornerRadius,
  wallMountScrewDiameter,
  wallMountCount,
}: FlangesGeometryParams): Geom3 => {
  const outerWidth = wallMountScrewDiameter + SCREWCLEARANCE * 2 + RIDGEWIDTH * 2;
  const cornerSpacing = cornerRadius + outerWidth / 2;

  const yPositions = wallMountCount === 2 ? [length / 2] : [cornerSpacing, length - cornerSpacing];

  const f = flange(wallMountScrewDiameter);
  const mirrored = mirrorX(f);
  const recenterX = -width / 2;
  const recenterY = -length / 2;

  const pieces = yPositions.flatMap((y) => [
    translate([recenterX - RIDGEWIDTH, recenterY + y, 0], f),
    translate([recenterX + width + RIDGEWIDTH, recenterY + y, 0], mirrored),
  ]);

  return pieces.length === 1 ? pieces[0] : union(pieces);
};

