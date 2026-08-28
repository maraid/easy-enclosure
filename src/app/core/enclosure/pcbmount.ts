import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { subtract, union } from '@jscad/modeling/src/operations/booleans';
import { rotateX, rotateY, translate } from '@jscad/modeling/src/operations/transforms';
import { cylinder } from '@jscad/modeling/src/primitives';
import { degToRad } from '@jscad/modeling/src/utils';
import { Surface } from '.';
import { Params, PCBMount } from '../params';
import { Feature } from './feature';

export const pcbMount = (height: number, outerDiameter: number, screwDiameter: number) => {
  return subtract(
    cylinder({
      height: height,
      radius: outerDiameter / 2,
      segments: 20,
      center: [0, 0, height / 2],
    }),
    cylinder({
      height: height,
      radius: screwDiameter / 2,
      segments: 20,
      center: [0, 0, height / 2],
    }),
  );
};
export const pcbMountFeature = (mountParams: PCBMount): Feature => {
  const { height, outerDiameter, screwDiameter, surface, x, y } = mountParams;
  let geometry = pcbMount(height, outerDiameter, screwDiameter);
  return { geometry, surface, x, y };
}

// export const pcbMountOnBase = (mount: PCBMount, params: Params): Geom3 => {
//   const { length, width, height, floor, wall, waterProof, insertThickness, insertClearance } =
//     params;
//   const surface: Surface = mount.surface ?? 'bottom';
//   const mountBody = pcbMount(mount);
//   const innerWall = waterProof ? wall * 2 + insertClearance * 2 + insertThickness : wall;
//   const baseFloor = params.lidScrews ? floor : innerWall;
//   const bottomX = width / 2 - mount.x;
//   const bottomY = length / 2 - mount.y;
//   const wallX = width / 2 - mount.x;
//   const wallY = length / 2 - mount.x;
//   const wallZ = height / 2 + mount.y;

//   if (surface === 'bottom') {
//     return translate([bottomX, bottomY, baseFloor + mount.height / 2], mountBody);
//   }

//   if (surface === 'front') {
//     return translate(
//       [wallX, length - innerWall - mount.height / 2, wallZ],
//       rotateX(degToRad(-90), mountBody),
//     );
//   }

//   if (surface === 'back') {
//     return translate(
//       [wallX, innerWall + mount.height / 2, wallZ],
//       rotateX(degToRad(90), mountBody),
//     );
//   }

//   if (surface === 'right') {
//     return translate(
//       [innerWall + mount.height / 2, wallY, wallZ],
//       rotateY(degToRad(-90), mountBody),
//     );
//   }

//   return translate(
//     [width - innerWall - mount.height / 2, wallY, wallZ],
//     rotateY(degToRad(90), mountBody),
//   );
// };

// export const pcbMountOnLid = (mount: PCBMount, params: Params): Geom3 => {
//   const { length, width, roof } = params;
//   return translate(
//     [width / 2 - mount.x, length / 2 - mount.y, roof + mount.height / 2],
//     pcbMount(mount),
//   );
// };

// const buildMountUnion = (mounts: Geom3[]): Geom3 | null => {
//   if (mounts.length === 0) {
//     return null;
//   }

//   return mounts.length === 1 ? mounts[0] : union(mounts);
// };

// export const pcbMountsOnBase = (params: Params): Geom3 | null => {
//   if (!params.pcbMounts.length) {
//     return null;
//   }

//   const mounts = params.pcbMounts
//     .filter((mount) => (mount.surface ?? 'bottom') !== 'top')
//     .map((mount) => pcbMountOnBase(mount, params));

//   return buildMountUnion(mounts);
// };

// export const pcbMountsOnLid = (params: Params): Geom3 | null => {
//   if (!params.pcbMounts.length) {
//     return null;
//   }

//   const mounts = params.pcbMounts
//     .filter((mount) => (mount.surface ?? 'bottom') === 'top')
//     .map((mount) => pcbMountOnLid(mount, params));

//   return buildMountUnion(mounts);
// };

// export const pcbMounts = (params: Params): Geom3 | null => {
//   const baseMounts = pcbMountsOnBase(params);
//   const lidMounts = pcbMountsOnLid(params);

//   if (baseMounts === null && lidMounts === null) {
//     return null;
//   }

//   const mounts = [baseMounts, lidMounts].filter((item): item is Geom3 => item !== null);
//   return mounts.length === 1 ? mounts[0] : union(mounts);
// };
