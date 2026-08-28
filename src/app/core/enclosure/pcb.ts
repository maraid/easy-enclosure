import { booleans, transforms } from '@jscad/modeling';
import { cloverFrame, centeredRoundedCube, roundedFrame } from './utils';

import { Params, PCBMount } from '../params';
import { subtract } from '@jscad/modeling/src/operations/booleans';
import { holes } from './holes';
import { lidScrewHoles, screwBosses } from './screws';
import { Feature } from './feature';
import { cuboid, cylinder } from '@jscad/modeling/src/primitives';
import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { PCB } from '../params';

const HEIGHT: number = 1;
const PERF_DIAMETER: number = 1;
const PERF_SPACING: number = 2.54;
const SCREWHOLE_DIAMETER: number = 2;

const { union } = booleans;
const { translate } = transforms;

const perf = (): Geom3 => {
    return cylinder({
        height: HEIGHT,
        radius: PERF_DIAMETER / 2,
        segments: 20,
        center: [0, 0, HEIGHT / 2],
    });
}



const perfs = (board: PCB): Geom3 | null => {
    const { length, width } = board;

    const hole = perf();
    const holes: Geom3[] = [];

    const widthCount = Math.floor((width - 2 * PERF_SPACING) / PERF_SPACING) + 1;
    const lengthCount = Math.floor((length - 2 * PERF_SPACING) / PERF_SPACING) + 1;

    if (widthCount < 1 || lengthCount < 1) {
        return null;
    }

    const widthStart =
        (width - (widthCount - 1) * PERF_SPACING) / 2;

    const lengthStart =
        (length - (lengthCount - 1) * PERF_SPACING) / 2;

    for (let i = 0; i < widthCount; i++) {
        for (let j = 0; j < lengthCount; j++) {
            holes.push(
                translate(
                    [
                        widthStart + i * PERF_SPACING,
                        lengthStart + j * PERF_SPACING,
                        0,
                    ],
                    hole,
                ),
            );
        }
    }

    return translate(
        [-width / 2, -length / 2, 0],
        union(holes),
    );
};

const screwHole = (): Geom3 => {
    return cylinder({
        height: HEIGHT,
        radius: SCREWHOLE_DIAMETER / 2,
        segments: 20,
        center: [0, 0, HEIGHT / 2],
    })
}

const screwHoles = (board: PCB): Geom3 => {
    const { screwOffset, width, length } = board;
    const hole = screwHole();
    const edgeX = width / 2 - screwOffset;
    const edgeY = length / 2 - screwOffset;
    return union(
        translate([-edgeX, -edgeY, 0], hole),
        translate([-edgeX, edgeY, 0], hole),
        translate([edgeX, -edgeY, 0], hole),
        translate([edgeX, edgeY, 0], hole),
    );
};

const pcb = (board: PCB) => {
    let geometry = cuboid({
        size: [board.width, board.length, HEIGHT],
        center: [0, 0, HEIGHT / 2],
    });
    const holes = perfs(board);
    if (holes) {
        geometry = subtract(geometry, union(holes));
    }
    return subtract(geometry, screwHoles(board));
};

export const pcbFeature = (params: Params): Feature => {
    const { pcb: board } = params;
    const { x, y, z, surface } = board;
    const geometry = pcb(board);
    return { geometry, surface, x, y, z };
};
