import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { degToRad } from '@jscad/modeling/src/utils';
import { translate, mirror, rotateZ, rotateX, rotateY } from '@jscad/modeling/src/operations/transforms';

import { Surface } from '../../core/enclosure';
import { PCBMount, PCB, Hole, InternalWall, CableClamp, Params } from '../../core/params';
import { pcbMount } from '../../core/enclosure/pcbmount';
import { pcb } from '../../core/enclosure/pcb';
import { lidInsert, lidWithHoles } from '../../core/enclosure/lid';
import { hole2 } from '../../core/enclosure/holes';
import { base } from '../../core/enclosure/base';
import { waterProofSeal } from '../../core/enclosure/waterproofseal';
import { internalWall } from '../../core/enclosure/internalwalls';
import { flanges } from '../../core/enclosure/wallmount';

// TODO: replace with real geometry-builder imports
// import { holeFeature } from '../../core/enclosure/hole';
// import { internalWallFeature } from '../../core/enclosure/internal-wall';
// import { cableClampFeature } from '../../core/enclosure/cable-clamp';

type Vec3Tuple = [number, number, number];

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

type Origin = 'base' | 'lid' | 'seal' | 'clampTops';

type OriginTransform = {
    translate: Vec3Tuple;
};

type OriginStrategy = (params: Params) => OriginTransform;

type Placement = {
    x: number;
    y: number;
    z?: number;
    surface?: Surface;
    origin?: Origin;
    rotation?: number; // degrees, spin about the feature's own local up-axis
};

type PlacementFields = Omit<Placement, 'origin'>;

// Global params that affect *placement* math (not geometry itself).
// Keep in sync with what placeOnSurface()/origin strategies actually read.
const PLACEMENT_PARAM_DEPS: (keyof Params)[] = [
    'floor', 'roof', 'height', 'width', 'length', 'wall',
    'waterProof', 'insertThickness', 'insertClearance',
];

const SURFACE_ORIGIN: Partial<Record<Surface, Origin>> = {
    top: 'lid',
    bottom: 'base',
    left: 'base',
    right: 'base',
    front: 'base',
    back: 'base',
};

const SPACING = 20;


class Placer {
    SPACING = 20;

    private origins: Record<Origin, OriginStrategy> = {
        base: () => ({ translate: [0, 0, 0] }),

        lid: (params) => ({
            translate: [-params.width - SPACING, 0, 0],
        }),

        seal: (params) => ({
            translate: [params.width + SPACING, 0, 0],
        }),

        clampTops: (params) => {
            const base: Vec3Tuple = params.waterProof
                ? [params.width + SPACING, 0, 0]      // = seal origin
                : [0, 0, 0];                            // = base origin
            return { translate: [base[0] - params.width * 0.7 - SPACING, base[1], base[2]] };
        },
    };

    // Escape hatch for origins that need runtime-computed strategies.
    registerOrigin(name: Origin, strategy: OriginStrategy): void {
        this.origins[name] = strategy;
    }

    place(geometry: Geom3, placement: Placement, params: Params): Geom3 {
        const surface = placement.surface ?? 'bottom';
        const origin = SURFACE_ORIGIN[surface] ?? placement.origin ?? 'base';

        let ret = this.placeOnSurface(geometry, placement, params);

        const strategy = this.origins[origin];
        if (!strategy) {
            throw new Error(`No placement strategy registered for origin "${origin}"`);
        }
        ret = translate(strategy(params).translate, ret);

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
                return translate(
                    [x, wallY - innerWallThickness - (z ?? 0), wallZ + y],
                    rotateX(degToRad(90), spun),
                );

            case 'back':
                return translate(
                    [x, -wallY + innerWallThickness + (z ?? 0), wallZ + y],
                    rotateX(degToRad(-90), spun),
                );

            case 'right':
                return translate(
                    [wallX - innerWallThickness - (z ?? 0), y, wallZ + x],
                    rotateY(degToRad(-90), spun),
                );

            case 'left':
                return translate(
                    [-wallX + innerWallThickness + (z ?? 0), y, wallZ + x],
                    rotateY(degToRad(90), spun),
                );

            default:
                return spun;
        }
    }
}

// ---------------------------------------------------------------------------
// BaseComponentUpdater: caches built geometry AND placed geometry separately
// ---------------------------------------------------------------------------

type Operation = 'union' | 'subtract';

abstract class BaseComponentUpdater<T = any> {
    protected m_geometry: Geom3 | null = null;
    protected m_geometryKey = '';
    protected m_placedGeometry: Geom3 | null = null;
    protected m_placementKey = '';

    public readonly origin: Origin;
    public readonly operation: Operation;
    private readonly toArgs: (obj: T, params: Params) => unknown[];
    private readonly placementFn: (obj: T) => PlacementFields;

    constructor(
        obj: T,
        params: Params,
        private readonly geometryFn: (...args: any[]) => Geom3,
        options: {
            toArgs?: (obj: T, params: Params) => unknown[];
            origin?: Origin;
            operation?: Operation;
            placementFn?: (obj: T) => PlacementFields;
        } = {},
    ) {
        this.toArgs = options.toArgs ?? ((o) => [o]);
        this.origin = options.origin ?? 'base';
        this.operation = options.operation ?? 'union';
        this.placementFn = options.placementFn ?? ((o: any) => ({
            x: o.x, y: o.y, z: o.z, surface: o.surface, rotation: o.rotation,
        }));
        this.ensureGeometry(obj, params);
    }

    getGeometry(): Geom3 | null {
        return this.m_geometry;
    }

    public update(obj: T, params: Params): void {
        this.ensureGeometry(obj, params);
    }

    protected ensureGeometry(obj: T, params: Params): void {
        const args = this.toArgs(obj, params);
        const newKey = JSON.stringify(args);

        if (this.m_geometry === null || this.m_geometryKey !== newKey) {
            this.m_geometryKey = newKey;
            this.m_geometry = this.geometryFn(...args);
            this.m_placedGeometry = null;
        }
    }

    getPlaced(obj: T, params: Params, placer: Placer): Geom3 | null {
        if (this.m_geometry === null) return null;

        const fields = this.placementFn(obj);
        const paramsKey = PLACEMENT_PARAM_DEPS.map((k) => params[k]).join('|');
        const newKey = `${JSON.stringify(fields)}::${paramsKey}`;

        if (this.m_placedGeometry === null || this.m_placementKey !== newKey) {
            this.m_placedGeometry = placer.place(this.m_geometry, { ...fields, origin: this.origin }, params);
            this.m_placementKey = newKey;
        }

        return this.m_placedGeometry;
    }
}

// ---------------------------------------------------------------------------
// Concrete updaters
// ---------------------------------------------------------------------------

class BaseUpdater extends BaseComponentUpdater<Params> {
    constructor(params: Params) {
        super(params, params, base, {
            placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
            // origin defaults to 'base', operation defaults to 'union' — no need to set either
        });
    }
}

class SealUpdater extends BaseComponentUpdater<Params> {
    constructor(params: Params) {
        super(params, params, waterProofSeal, {
            origin: 'seal',
            placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
        });
    }
}

class PcbUpdater extends BaseComponentUpdater<PCB> {
    constructor(item: PCB, params: Params) {
        super(item, params, pcb); // default toArgs = (o) => [o]
    }
}

class MountUpdater extends BaseComponentUpdater<PCBMount> {
    constructor(m: PCBMount, params: Params) {
        super(m, params, pcbMount); // unaffected — omits options entirely, defaults apply
    }
}

class HoleUpdater extends BaseComponentUpdater<Hole> {
    constructor(item: Hole, params: Params) {
        const surfaceOrigin: Origin = item.surface === 'top' ? 'lid' : 'base';
        super(item, params, hole2, {
            origin: surfaceOrigin,
            operation: 'subtract',
            toArgs: (hole, p) => [
                {
                    floor: p.floor,
                    roof: p.roof,
                    wall: p.wall,
                    insertHeight: p.insertHeight,
                    insertThickness: p.insertThickness,
                    insertClearance: p.insertClearance,
                },
                {
                    shape: hole.shape,
                    diameter: hole.diameter,
                    width: hole.width,
                    length: hole.length,
                    surface: hole.surface,
                },
            ],
        });
    }
}

class InternalWallUpdater extends BaseComponentUpdater<InternalWall> {
    constructor(item: InternalWall, params: Params) {
        super(item, params, internalWall);
    }
}

class WallMountUpdater extends BaseComponentUpdater<Params> {
    constructor(params: Params) {
        super(params, params, flanges, {
            placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
        });
    }
}

class LidInsertUpdater extends BaseComponentUpdater<Params> {
    constructor(params: Params) {
        super(params, params, lidInsert, {
            origin: 'lid',
            placementFn: () => ({ x: 0, y: 0, surface: 'top' }),
        });
    }
}

class LidUpdater extends BaseComponentUpdater<Params> {
    constructor(params: Params) {
        super(params, params, lidWithHoles, {
            origin: 'lid',
            placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
        });
    }
}
// ---------------------------------------------------------------------------
// ObjectUpdater: orchestration only
// ---------------------------------------------------------------------------

import { union, subtract } from '@jscad/modeling/src/operations/booleans';

export class ObjectUpdater {
    private objects = new Map<string, BaseComponentUpdater>();
    private models: Geom3[] = [];
    private placer = new Placer();

    updateAll(params: Params): void {
        this.models = [];

        // origin -> pieces to union together, and pieces to subtract afterward
        const unions = new Map<Origin, Geom3[]>();
        const subtracts = new Map<Origin, Geom3[]>();

        const collect = (updater: BaseComponentUpdater, obj: any) => {
            const placed = updater.getPlaced(obj, params, this.placer);
            if (!placed) return;
            const bucket = updater.operation === 'subtract' ? subtracts : unions;
            const list = bucket.get(updater.origin) ?? [];
            list.push(placed);
            bucket.set(updater.origin, list);
        };

        const run = <T extends { id: string }, U extends BaseComponentUpdater>(
            objects: T[],
            Updater: new (obj: T, params: Params) => U,
        ) => {
            for (const obj of objects) {
                const updater = this.getUpdated(obj.id, Updater, obj, params);
                collect(updater, obj);
            }
        };

        const runSingle = <U extends BaseComponentUpdater>(
            id: string,
            Updater: new (obj: any, params: Params) => U,
            updateArg: any,
        ) => {
            const updater = this.getUpdated(id, Updater, updateArg, params);
            collect(updater, updateArg);
        };

        if (params.wallMounts) runSingle('wallMount', WallMountUpdater, params);
        if (params.waterProof) runSingle('seal', SealUpdater, params);
        if (params.pcb.enabled) run([params.pcb], PcbUpdater);

        runSingle('base', BaseUpdater, params);
        runSingle('lid', LidUpdater, params);
        runSingle('lid-insert', LidInsertUpdater, params);

        run(params.pcbMounts, MountUpdater);
        run(params.holes, HoleUpdater);
        run(params.internalWalls, InternalWallUpdater);

        // for each origin group: union the union-pieces, subtract the subtract-pieces, push the result
        const allOrigins = new Set<Origin>([...unions.keys(), ...subtracts.keys()]);
        for (const origin of allOrigins) {
            const unionPieces = unions.get(origin) ?? [];
            const subtractPieces = subtracts.get(origin) ?? [];

            if (unionPieces.length === 0) continue; // nothing to subtract from

            let combined = unionPieces.length === 1 ? unionPieces[0] : union(unionPieces);
            if (subtractPieces.length > 0) {
                combined = subtract(combined, ...subtractPieces);
            }

            this.models.push(combined);
        }
    }

    private getUpdated<U extends BaseComponentUpdater>(
        id: string,
        Updater: new (obj: any, params: Params) => U,
        updateArg: any,
        params: Params,
    ): U {
        let updater = this.objects.get(id) as U | undefined;
        if (!updater) {
            updater = new Updater(updateArg, params);
            this.objects.set(id, updater);
        }
        updater.update(updateArg, params);
        return updater;
    }

    getModels(): Geom3[] {
        return this.models;
    }
}
