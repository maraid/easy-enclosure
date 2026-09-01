
import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { union } from '@jscad/modeling/src/operations/booleans';
import { degToRad } from '@jscad/modeling/src/utils';


import { translate, mirror, rotateZ, rotateX, rotateY } from '@jscad/modeling/src/operations/transforms';

import { Feature } from '../../core/enclosure/feature';
import { Surface } from '../../core/enclosure';
// import { Vec3Tuple } from '@jscad/modeling/src/maths/types';
import { FeatureTarget } from '../../core/state/enclosure-state.service';
import { PCBMount, PCB } from "../../core/params";
import { pcbMount } from '../../core/enclosure/pcbmount';
import { pcb } from '../../core/enclosure/pcb';
import { lidInsert, lidWithHoles } from '../../core/enclosure/lid';
import { Params } from '../../core/params';


type Vec3Tuple = [number, number, number];


export type Origin = 'lid' | 'base' | 'seal' | 'clampTops';

type OriginTransform = {
    translate: Vec3Tuple;
    rotate?: Vec3Tuple; // degrees, [x, y, z], applied in that order
};

type OriginStrategy = (params: Params) => OriginTransform;

export type Placement = {
    x: number;
    y: number;
    z?: number;
    surface?: Surface;
    origin?: Origin;
    rotation?: number;
};

export class Placer {
    private origins: Record<Origin, OriginStrategy> = {
        base: () => ({ translate: [0, 0, 0] }),

        lid: () => ({ translate: [100, 0, 0] }), // beside the case, same orientation

        seal: (params) => ({ translate: [0, 0, 0] }), // TODO if seal needs its own offset
        clampTops: (params) => ({ translate: [0, 0, 0] }), // TODO
    };

    registerOrigin(name: Origin, strategy: OriginStrategy): void {
        this.origins[name] = strategy;
    }

    place(geometry: Geom3, placement: Placement, params: Params): Geom3 {
        if (placement.surface === 'top' && (placement.origin ?? 'base') !== 'lid') {
            throw new Error(
                `surface: 'top' is only meaningful with origin: 'lid' (got '${placement.origin ?? 'base'}')`
            );
        }

        let ret = this.placeOnSurface(geometry, placement, params);
        const { translate: t } = this.origins[placement.origin ?? 'base'](params);
        ret = translate(t, ret);
        ret = mirror({ normal: [1, 0, 0] }, ret);
        return ret;
    }

    private placeOnSurface(geometry: Geom3, placement: Placement, params: Params): Geom3 {
        const { x, y, z, rotation } = placement;
        const { floor, roof, height, length, width, wall, waterProof, insertThickness, insertClearance } = params;

        const surface: Surface = placement.surface ?? 'bottom';
        const innerWallThickness = waterProof ? wall * 2 + insertClearance * 2 + insertThickness : wall;
        const wallX = width / 2;
        const wallY = length / 2;
        const wallZ = height / 2;

        const spun = rotation ? rotateZ(degToRad(rotation), geometry) : geometry;

        switch (surface) {
            case 'plane':
                return translate([x, y, (z ?? 0)], spun);
            case 'bottom':
                return translate([x, y, floor + (z ?? 0)], spun);
            case 'top':
                return translate([x, y, roof + (z ?? 0)], spun);
            case 'front':
                return translate([x, wallY - innerWallThickness - (z ?? 0), wallZ + y], rotateX(degToRad(90), spun));
            case 'back':
                return translate([x, -wallY + innerWallThickness + (z ?? 0), wallZ + y], rotateX(degToRad(-90), spun));
            case 'right':
                return translate([wallX - innerWallThickness - (z ?? 0), y, wallZ + x], rotateY(degToRad(-90), spun));
            case 'left':
                return translate([-wallX + innerWallThickness + (z ?? 0), y, wallZ + x], rotateY(degToRad(90), spun));
            default:
                return spun;
        }
    }
}