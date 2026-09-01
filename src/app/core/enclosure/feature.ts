import { Geom3 } from '@jscad/modeling/src/geometries/types';

import { Surface } from '.';


export type Feature = {
    id?: string;
    geometry: Geom3;
    surface: Surface;
    x: number;
    y: number;
    z?: number;
};