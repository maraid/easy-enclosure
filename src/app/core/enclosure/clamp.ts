import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { subtract, union } from '@jscad/modeling/src/operations/booleans';
import { translate, rotateZ } from '@jscad/modeling/src/operations/transforms';
import { degToRad } from '@jscad/modeling/src/utils';
import { cylinder } from '@jscad/modeling/src/primitives';

import { Params, CableClamp, PCBMount, InternalWall } from '../params';
import { internalWall } from './internalwalls';
import { Feature } from './feature';


export const clampMount = (height: number, outerDiameter: number, screwDiameter: number): [Geom3, Geom3] => {
    return [
        cylinder({
            center: [0, 0, height / 2],
            height: height,
            radius: outerDiameter / 2,
            segments: 20,
        }),
        cylinder({
            center: [0, 0, height / 2],
            height: height,
            radius: screwDiameter / 2,
            segments: 20,
        }),
    ]
};


export const cableClamp = (
    length: number,
    mountHeight: number,
    mountOuterDiameter: number,
    mountScrewDiameter: number,
    wallHeight: number,
    wallThickness: number,
    rotation: number = 0): Geom3 => {

    const [mountOuter, mountInner] = clampMount(mountHeight, mountOuterDiameter, mountScrewDiameter);
    const wall = internalWall({ height: wallHeight, length, thickness: wallThickness });


    const leftMountOuter = translate(
        [0, -length / 2, 0],
        mountOuter,
    );

    const leftMountInner = translate(
        [0, -length / 2, 0],
        mountInner,
    );

    const rightMountOuter = translate(
        [0, length / 2, 0],
        mountOuter,
    );

    const rightMountInner = translate(
        [0, length / 2, 0],
        mountInner,
    );

    const obj = subtract(
        union(
            leftMountOuter,
            wall,
            rightMountOuter,
        ),
        union(
            leftMountInner,
            rightMountInner,
        ),
    );
    return rotateZ(degToRad(rotation), obj);
};


export const cableClampTop = (clampParams: CableClamp): Geom3 => {
    const {
        length,
        mountOuterDiameter,
        wallThickness,
        topHeight,
        topScrewDiameter,
    } = clampParams;

    return cableClamp(
        length,
        topHeight,
        mountOuterDiameter,
        topScrewDiameter,
        topHeight,
        wallThickness,
    );
};


export const spacedCableClampTop = (
    clamp: CableClamp,
    spacing: number,
    size: number,
    index: number,
) => {
    const centeredY = (index - (size - 1) / 2) * spacing;
    let top = cableClampTop(clamp);
    top = rotateZ(degToRad(90), top);
    top = translate([0, centeredY, 0], top);
    return top;
};


export const cableClampTops = (params: Params, spacing: number) => {
    const { cableClamps } = params;

    if (!cableClamps.length) {
        return null;
    }

    const clamps: Geom3[] = [];
    const count = cableClamps.length;
    cableClamps.forEach((clamp, i) => {
        clamps.push(spacedCableClampTop(clamp, spacing, count, i));
    });

    return union(clamps);
};
