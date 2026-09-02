import { Geom3 } from '@jscad/modeling/src/geometries/types';
import { degToRad } from '@jscad/modeling/src/utils';
import {
  translate,
  mirror,
  rotateZ,
  rotateX,
  rotateY,
} from '@jscad/modeling/src/operations/transforms';
import { subtract } from '@jscad/modeling/src/operations/booleans';
import { colorize } from '@jscad/modeling/src/colors';

import { FeatureTarget } from '../../core/state/enclosure-state.service';

import { Surface } from '../../core/enclosure';
import { PCBMount, PCB, Hole, InternalWall, CableClamp, Params } from '../../core/params';
import { pcbMount } from '../../core/enclosure/pcbmount';
import { pcb, pcbGuideStub, PcbGuideStubParams } from '../../core/enclosure/pcb';
import { lid, LidParams, lidInsert, LidInsertParams } from '../../core/enclosure/lid';
import { hole } from '../../core/enclosure/holes';
import { base } from '../../core/enclosure/base';
import {
  waterProofSeal,
  waterProofSealCutout,
  WaterProofSealCutoutParams,
  WaterProofSealParams,
} from '../../core/enclosure/waterproofseal';
import { internalWall, InternalWallGeometryParams } from '../../core/enclosure/internalwalls';
import { flanges, FlangesGeometryParams } from '../../core/enclosure/wallmount';
import {
  cableClamp,
  CableClampGeometryParams,
  cableClampTop,
  CableClampTopGeometryParams,
} from '../../core/enclosure/clamp';
import {
  baseScrewHoles,
  BaseScrewHolesParams,
  lidScrewHoles,
  LidScrewHolesParams,
  screwBosses,
  ScrewBossParams,
  isSunken,
} from '../../core/enclosure/screws';

type Vec3Tuple = [number, number, number];

export type FeatureEntry = {
  id: string;
  group?: string;
  type: FeatureTarget['type'];
  geometry: Geom3;
  operation: Operation;
};

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export type Origin = 'base' | 'lid' | 'seal' | 'clampTops';

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
  'floor',
  'roof',
  'height',
  'width',
  'length',
  'wall',
  'waterProof',
  'insertThickness',
  'insertClearance',
];

const SURFACE_ORIGIN: Partial<Record<Surface, Origin>> = {
  top: 'lid',
};

const SPACING = 20;

export class Placer {
  SPACING = 20;

  private baseOrigin(params: Params): Vec3Tuple {
    return [0, 0, 0];
  }
  private lidOrigin(params: Params): Vec3Tuple {
    return [-params.width - SPACING, 0, 0];
  }
  private sealOrigin(params: Params): Vec3Tuple {
    return [params.width + SPACING, 0, 0];
  }

  private origins: Record<Origin, OriginStrategy> = {
    base: (params) => ({ translate: this.baseOrigin(params) }),

    lid: (params) => ({
      translate: this.lidOrigin(params),
    }),

    seal: (params) => ({
      translate: this.sealOrigin(params),
    }),

    clampTops: (params) => {
      base(params);
      const refOrigin: Vec3Tuple = params.waterProof
        ? this.sealOrigin(params)
        : this.baseOrigin(params);
      return { translate: [refOrigin[0] + params.width / 2 + SPACING, refOrigin[1], refOrigin[2]] };
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
    const {
      floor,
      roof,
      height,
      length,
      width,
      wall,
      waterProof,
      insertThickness,
      insertClearance,
    } = params;

    const surface: Surface = placement.surface ?? 'bottom';
    const innerWallThickness = waterProof ? wall * 2 + insertClearance * 2 + insertThickness : wall;
    const wallX = width / 2;
    const wallY = length / 2;
    const wallZ = height / 2;

    const spun = rotation ? rotateZ(degToRad(rotation), geometry) : geometry;

    switch (surface) {
      case 'plane':
        return translate([x, y, z ?? 0], spun);

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

  // in Placer
  pointFor(
    x: number,
    y: number,
    z: number,
    surface: Surface,
    origin: Origin,
    params: Params,
  ): Vec3Tuple {
    // reuse the same per-surface math as placeOnSurface, but for a bare point instead of geometry
    const {
      floor,
      roof,
      height,
      length,
      width,
      wall,
      waterProof,
      insertThickness,
      insertClearance,
    } = params;
    const innerWallThickness = waterProof ? wall * 2 + insertClearance * 2 + insertThickness : wall;
    const wallX = width / 2,
      wallY = length / 2,
      wallZ = height / 2;

    let local: Vec3Tuple;
    switch (surface) {
      case 'bottom':
        local = [x, y, floor + z];
        break;
      case 'top':
        local = [x, y, roof + z];
        break;
      case 'front':
        local = [x, wallY - innerWallThickness - z, wallZ + y];
        break;
      case 'back':
        local = [x, -wallY + innerWallThickness + z, wallZ + y];
        break;
      case 'right':
        local = [wallX - innerWallThickness - z, y, wallZ + x];
        break;
      case 'left':
        local = [-wallX + innerWallThickness + z, y, wallZ + x];
        break;
      default:
        local = [x, y, z];
        break;
    }

    const [ox, oy, oz] = this.origins[origin](params).translate;
    return [-(local[0] + ox), local[1] + oy, local[2] + oz]; // mirror X to match place()'s final mirror
  }
}

// ---------------------------------------------------------------------------
// BaseComponentUpdater: caches built geometry AND placed geometry separately
// ---------------------------------------------------------------------------

export type Operation = 'union' | 'subtract';

abstract class BaseComponentUpdater<T = any> {
  protected m_geometry: Geom3 | null = null;
  protected m_geometryKey = '';
  protected m_placedGeometry: Geom3 | null = null;
  protected m_placementKey = '';

  private color: [number, number, number, number] | null = null;
  public type: FeatureTarget['type'] = 'base';
  public readonly exportable: boolean;
  public readonly origin: Origin;
  public readonly operation: Operation;
  public readonly group?: string;
  private readonly toArgs: (obj: T, params: Params) => unknown[];
  private readonly placementFn: (obj: T) => PlacementFields;
  public readonly attachesToShell: boolean;

  constructor(
    obj: T,
    params: Params,
    private readonly geometryFn: (...args: any[]) => Geom3,
    type: FeatureTarget['type'],
    options: {
      toArgs?: (obj: T, params: Params) => unknown[];
      origin?: Origin;
      operation?: Operation;
      placementFn?: (obj: T) => PlacementFields;
      group?: string;
      attachesToShell?: boolean; // true only for pieces that must be unioned into the base/lid solid
      exportable?: boolean;
      color?: [number, number, number, number];
    } = {},
  ) {
    this.color = options.color ?? null;
    this.type = type;
    this.exportable = options.exportable ?? true;
    this.toArgs = options.toArgs ?? ((o) => [o]);
    this.origin = options.origin ?? 'base';
    this.operation = options.operation ?? 'union';
    this.group = options.group;
    this.placementFn =
      options.placementFn ??
      ((o: any) => ({
        x: o.x,
        y: o.y,
        z: o.z,
        surface: o.surface,
        rotation: o.rotation,
      }));
    this.ensureGeometry(obj, params);
    this.attachesToShell = options.attachesToShell ?? false;
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
      const geom = this.geometryFn(...args);
      this.m_geometry = this.color ? colorize(this.color, geom) : geom;
      this.m_placedGeometry = null;
    }
  }

  getPlaced(obj: T, params: Params, placer: Placer): Geom3 | null {
    if (this.m_geometry === null) return null;
    const fields = this.placementFn(obj);
    const paramsKey = PLACEMENT_PARAM_DEPS.map((k) => params[k]).join('|');
    const newKey = `${JSON.stringify(fields)}::${paramsKey}`;

    if (this.m_placedGeometry === null || this.m_placementKey !== newKey) {
      this.m_placedGeometry = placer.place(
        this.m_geometry,
        { ...fields, origin: this.origin },
        params,
      );
      this.m_placementKey = newKey;
    }
    return this.m_placedGeometry;
  }

  placementCacheKey(): string {
    return `${this.m_geometryKey}::${this.m_placementKey}`;
  }
}

// ---------------------------------------------------------------------------
// Concrete updaters
// ---------------------------------------------------------------------------

class BaseUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, base, 'base', {
      toArgs: (_, p) => [
        {
          length: p.length,
          width: p.width,
          height: p.height,
          wall: p.wall,
          floor: p.floor,
          cornerRadius: p.cornerRadius,
          insertThickness: p.insertThickness,
          insertClearance: p.insertClearance,
          waterProof: p.waterProof,
          lidScrews: p.lidScrews,
          baseLidScrewDiameter: p.baseLidScrewDiameter,
          lidScrewDiameter: p.lidScrewDiameter,
          sunkenLidScrewHeads: p.sunkenLidScrewHeads,
          lidScrewHeadDiameter: p.lidScrewHeadDiameter,
          sealThickness: p.sealThickness,
        },
      ],
      attachesToShell: true,
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
    });
  }
}

class SealUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, waterProofSeal, 'waterproof', {
      origin: 'seal',
      toArgs: (_, p): [WaterProofSealParams] => [
        {
          length: p.length,
          width: p.width,
          wall: p.wall,
          baseLidScrewDiameter: p.baseLidScrewDiameter,
          sealThickness: p.sealThickness,
          insertThickness: p.insertThickness,
          insertClearance: p.insertClearance,
          cornerRadius: p.cornerRadius,
          lidScrewDiameter: p.lidScrewDiameter,
          sunkenLidScrewHeads: p.sunkenLidScrewHeads,
          lidScrewHeadDiameter: p.lidScrewHeadDiameter,
        },
      ],
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
    });
  }
}

class SealCutoutUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, waterProofSealCutout, 'waterproof', {
      toArgs: (_, p): [WaterProofSealCutoutParams] => [
        {
          length: p.length,
          width: p.width,
          height: p.height,
          wall: p.wall,
          insertThickness: p.insertThickness,
          insertHeight: p.insertHeight,
          sealThickness: p.sealThickness,
          insertClearance: p.insertClearance,
          cornerRadius: p.cornerRadius,
          baseLidScrewDiameter: p.baseLidScrewDiameter,
          lidScrewDiameter: p.lidScrewDiameter,
          sunkenLidScrewHeads: p.sunkenLidScrewHeads,
          lidScrewHeadDiameter: p.lidScrewHeadDiameter,
        },
      ],
      origin: 'base',
      operation: 'subtract',
      attachesToShell: true,
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
    });
  }
}

class PcbUpdater extends BaseComponentUpdater<PCB> {
  constructor(item: PCB, params: Params) {
    super(item, params, pcb, 'pcb', {
      toArgs: (o) => [{ width: o.width, length: o.length, screwOffset: o.screwOffset }],
      exportable: false,
      color: [0.2, 0.5, 0.5, 0.3],
    });
  }
}

class MountUpdater extends BaseComponentUpdater<PCBMount> {
  constructor(item: PCBMount, params: Params) {
    super(item, params, pcbMount, 'pcbMount', {
      toArgs: (o) => [
        {
          height: o.height,
          outerDiameter: o.outerDiameter,
          screwDiameter: o.screwDiameter,
        },
      ],
    });
  }
}

class InternalWallUpdater extends BaseComponentUpdater<InternalWall> {
  constructor(item: InternalWall, params: Params) {
    super(item, params, internalWall, 'internalWall', {
      toArgs: (o) => [
        {
          height: o.height,
          length: o.length,
          thickness: o.thickness,
        },
      ],
      placementFn: (o) => ({ x: o.x, y: o.y, surface: o.surface, rotation: o.rotation }),
    });
  }
}

class HoleUpdater extends BaseComponentUpdater<Hole> {
  constructor(item: Hole, params: Params) {
    const surfaceOrigin: Origin = item.surface === 'top' ? 'lid' : 'base';
    super(item, params, hole, 'hole', {
      origin: surfaceOrigin,
      operation: 'subtract',
      attachesToShell: true,
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

class BaseScrewHolesUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, baseScrewHoles, 'screwHole', {
      origin: 'base',
      operation: 'subtract',
      attachesToShell: true,
      toArgs: (_, p): [BaseScrewHolesParams] => [
        {
          length: p.length,
          width: p.width,
          height: p.height,
          wall: p.wall,
          cornerRadius: p.cornerRadius,
          sunkenLidScrewHeads: p.sunkenLidScrewHeads,
          lidScrewDiameter: p.lidScrewDiameter,
          lidScrewHeadDiameter: p.lidScrewHeadDiameter,
          lidScrewHeadDepth: p.lidScrewHeadDepth,
          boreHoleClearance: p.boreHoleClearance,
          baseLidScrewDiameter: p.baseLidScrewDiameter,
        },
      ],
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
      group: 'screwHoles',
    });
  }
}

class LidScrewHolesUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, lidScrewHoles, 'screwHole', {
      origin: 'lid',
      operation: 'subtract',
      attachesToShell: true,
      toArgs: (_, p): [LidScrewHolesParams] => [
        {
          width: p.width,
          length: p.length,
          roof: p.roof,
          wall: p.wall,
          cornerRadius: p.cornerRadius,
          lidScrewDiameter: p.lidScrewDiameter,
          sunkenLidScrewHeads: p.sunkenLidScrewHeads,
          lidScrewHeadDiameter: p.lidScrewHeadDiameter,
          lidScrewHeadDepth: p.lidScrewHeadDepth,
        },
      ],
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
      group: 'screwHoles',
    });
  }
}

class LidScrewBossUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, screwBosses, 'screwHole', {
      origin: 'lid',
      attachesToShell: true,
      toArgs: (_, p): [ScrewBossParams] => [
        {
          width: p.width,
          length: p.length,
          roof: p.roof,
          wall: p.wall,
          cornerRadius: p.cornerRadius,
          lidScrewDiameter: p.lidScrewDiameter,
          sunkenLidScrewHeads: p.sunkenLidScrewHeads,
          lidScrewHeadDiameter: p.lidScrewHeadDiameter,
          lidScrewHeadDepth: p.lidScrewHeadDepth,
        },
      ],
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
      group: 'screwHoles',
    });
  }
}

class WallMountUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, flanges, 'wallMount', {
      toArgs: (_, p): [FlangesGeometryParams] => [
        {
          length: p.length,
          width: p.width,
          cornerRadius: p.cornerRadius,
          wallMountScrewDiameter: p.wallMountScrewDiameter,
          wallMountCount: p.wallMountCount,
        },
      ],
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
    });
  }
}

class LidInsertUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, lidInsert, 'lidInsert', {
      origin: 'lid',
      toArgs: (_, p): [LidInsertParams] => [
        {
          width: p.width,
          length: p.length,
          wall: p.wall,
          lidScrews: p.lidScrews,
          cornerRadius: p.cornerRadius,
          insertThickness: p.insertThickness,
          insertHeight: p.insertHeight,
          insertClearance: p.insertClearance,
          baseLidScrewDiameter: p.baseLidScrewDiameter,
          lidScrewDiameter: p.lidScrewDiameter,
          sunkenLidScrewHeads: p.sunkenLidScrewHeads,
          lidScrewHeadDiameter: p.lidScrewHeadDiameter,
        },
      ],
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
    });
  }
}

class LidUpdater extends BaseComponentUpdater<Params> {
  constructor(params: Params) {
    super(params, params, lid, 'lid', {
      origin: 'lid',
      attachesToShell: true,
      toArgs: (_, p): [LidParams] => [
        {
          width: p.width,
          length: p.length,
          roof: p.roof,
          cornerRadius: p.cornerRadius,
        },
      ],
      placementFn: () => ({ x: 0, y: 0, surface: 'plane' }),
    });
  }
}

class CableClampUpdater extends BaseComponentUpdater<CableClamp> {
  constructor(item: CableClamp, params: Params) {
    super(item, params, cableClamp, 'cableClamp', {
      toArgs: (o): [CableClampGeometryParams] => [
        {
          length: o.length,
          mountHeight: o.mountHeight,
          mountOuterDiameter: o.mountOuterDiameter,
          mountScrewDiameter: o.mountScrewDiameter,
          wallHeight: o.wallHeight,
          wallThickness: o.wallThickness,
        },
      ],
      group: item.id,
    });
  }
}

type CableClampTopArg = { clamp: CableClamp; index: number; total: number };

class CableClampTopUpdater extends BaseComponentUpdater<CableClampTopArg> {
  constructor(arg: CableClampTopArg, params: Params) {
    super(arg, params, cableClampTop, 'cableClamp', {
      toArgs: (a): [CableClampTopGeometryParams] => [
        {
          length: a.clamp.length,
          mountOuterDiameter: a.clamp.mountOuterDiameter,
          wallThickness: a.clamp.wallThickness,
          topHeight: a.clamp.topHeight,
          topScrewDiameter: a.clamp.topScrewDiameter,
        },
      ],
      origin: 'clampTops',
      group: arg.clamp.id,
      placementFn: (a) => ({
        x: 0,
        y: (a.index - (a.total - 1) / 2) * SPACING,
        z: 0,
        rotation: 90, // fixed print-layout rotation
        surface: 'plane',
      }),
    });
  }
}

class PcbGuideUpdater extends BaseComponentUpdater<PCB> {
  constructor(item: PCB, params: Params) {
    super(item, params, pcbGuideStub, 'pcb', {
      toArgs: (a): [PcbGuideStubParams] => [
        {
          z: a.z,
          width: a.width,
          length: a.length,
          guideClearance: a.guideClearance,
          guideThickness: a.guideThickness,
          guideInset: a.guideInset,
        },
      ],
      group: `${params.pcb.id}-guides`,
      placementFn: (o) => ({ x: o.x, y: o.y, surface: o.surface }),
    });
  }
}

// ---------------------------------------------------------------------------
// ObjectUpdater: orchestration only
// ---------------------------------------------------------------------------

interface ModelEntry {
  model: Geom3;
  origin: Origin;
  type: FeatureTarget['type'];
  updater: BaseComponentUpdater;
}

export class ObjectUpdater {
  private models: ModelEntry[] = [];
  private objects = new Map<string, BaseComponentUpdater>();
  private featureEntries: FeatureEntry[] = [];
  private placer = new Placer();

  // Per-updateAll scratch state — reset at the top of each call
  private shellPieces = new Map<Origin, { updater: BaseComponentUpdater; geom: Geom3 }[]>();

  private shellCuts = new Map<Origin, { updater: BaseComponentUpdater; geom: Geom3 }[]>();

  private shellCache = new Map<Origin, { key: string; geometry: Geom3 }>();

  getModels(): Geom3[] {
    return this.models.map((entry) => entry.model);
  }

  getModelsByOrigin(): Map<Origin, Geom3[]> {
    const grouped = new Map<Origin, Geom3[]>();

    for (const entry of this.models) {
      if (!entry.updater.exportable) continue;

      const list = grouped.get(entry.origin) ?? [];
      list.push(entry.model);
      grouped.set(entry.origin, list);
    }

    return grouped;
  }

  getModelsByType(type: FeatureTarget['type']): Geom3[] {
    return this.models.filter((entry) => entry.type === type).map((entry) => entry.model);
  }

  getFeatureEntries(): FeatureEntry[] {
    return this.featureEntries;
  }

  updateAll(params: Params): void {
    this.models = [];
    this.featureEntries = [];
    this.shellPieces = new Map();
    this.shellCuts = new Map();

    if (params.wallMounts) {
      this.updateSingle('wallMount', WallMountUpdater, params, params);
    }

    this.updatePCB(params.pcb, params);

    this.updateSingle('base', BaseUpdater, params, params);

    if (params.waterProof) {
      this.updateSingle('seal', SealUpdater, params, params);
      this.updateSingle('seal-cutout', SealCutoutUpdater, params, params);
    }

    if (params.lidScrews) {
      this.updateSingle('base-screw-hole', BaseScrewHolesUpdater, params, params);
      this.updateSingle('lid-screw-hole', LidScrewHolesUpdater, params, params);
    }

    if (params.lidScrews && isSunken(params)) {
      this.updateSingle('lid-screw-boss', LidScrewBossUpdater, params, params);
    }

    this.updateSingle('lid', LidUpdater, params, params);

    this.updateSingle('lid-insert', LidInsertUpdater, params, params);

    this.updateMounts(params.pcbMounts, params);
    this.updateInternalWalls(params.internalWalls, params);
    this.updateHoles(params.holes, params);
    this.updateCableClamps(params.cableClamps, params);

    this.combineShells();
  }

  updatePCB(pcb: PCB, params: Params): void {
    if (pcb.guides) {
      this.updateSingle(`${params.pcb.id}-guide`, PcbGuideUpdater, pcb, params);
    }
    if (pcb.enabled) {
      this.updateObjects([pcb], PcbUpdater, params);
    }
  }

  updateMounts(mounts: PCBMount[], params: Params): void {
    this.updateObjects(mounts, MountUpdater, params);
  }

  updateInternalWalls(walls: InternalWall[], params: Params): void {
    this.updateObjects(walls, InternalWallUpdater, params);
  }

  updateHoles(holes: Hole[], params: Params): void {
    this.updateObjects(holes, HoleUpdater, params);
  }

  updateCableClamps(clamps: CableClamp[], params: Params): void {
    const total = clamps.length;

    clamps.forEach((clamp, index) => {
      this.updateSingle(clamp.id, CableClampUpdater, clamp, params);

      this.updateSingle(`${clamp.id}-top`, CableClampTopUpdater, { clamp, index, total }, params);
    });
  }

  // ---------------------------------------------------------------------
  // Shared primitives
  // ---------------------------------------------------------------------

  private collect(updater: BaseComponentUpdater, obj: any, params: Params, id: string): void {
    const placed = updater.getPlaced(obj, params, this.placer);

    if (!placed) return;

    this.featureEntries.push({
      id,
      group: updater.group,
      type: updater.type,
      operation: updater.operation,
      geometry: placed,
    });

    if (!updater.attachesToShell) {
      this.models.push({
        model: placed,
        origin: updater.origin,
        type: updater.type,
        updater,
      });

      return;
    }

    const bucket = updater.operation === 'subtract' ? this.shellCuts : this.shellPieces;

    const list = bucket.get(updater.origin) ?? [];

    list.push({
      updater,
      geom: placed,
    });

    bucket.set(updater.origin, list);
  }

  private updateObjects<T extends { id: string }, U extends BaseComponentUpdater>(
    objects: T[],
    Updater: new (obj: T, params: Params) => U,
    params: Params,
  ): void {
    for (const obj of objects) {
      const updater = this.getUpdated(obj.id, Updater, obj, params);

      this.collect(updater, obj, params, obj.id);
    }
  }

  private updateSingle<U extends BaseComponentUpdater>(
    id: string,
    Updater: new (obj: any, params: Params) => U,
    updateArg: any,
    params: Params,
  ): void {
    const updater = this.getUpdated(id, Updater, updateArg, params);

    this.collect(updater, updateArg, params, id);
  }

  private combineShells(): void {
    const allOrigins = new Set<Origin>([...this.shellPieces.keys(), ...this.shellCuts.keys()]);

    for (const origin of allOrigins) {
      const targets = this.shellPieces.get(origin) ?? [];
      const cuts = this.shellCuts.get(origin) ?? [];

      if (targets.length === 0) continue;

      const combinedKey = [...targets, ...cuts]
        .map((entry) => entry.updater.placementCacheKey())
        .join('||');

      const cached = this.shellCache.get(origin);

      if (cached && cached.key === combinedKey) {
        // We still need a ModelEntry so that the rest of the
        // pipeline has the same metadata as a normal model.
        //
        // There may be multiple target pieces, so the cache
        // represents the combined result for this origin.
        const updater = targets[0].updater;

        this.models.push({
          model: cached.geometry,
          origin,
          type: updater.type,
          updater,
        });

        continue;
      }

      const relevantCuts = cuts.map((c) => c.geom);

      for (const target of targets) {
        const geom = relevantCuts.length ? subtract(target.geom, ...relevantCuts) : target.geom;

        this.shellCache.set(origin, {
          key: combinedKey,
          geometry: geom,
        });

        this.models.push({
          model: geom,
          origin,
          type: target.updater.type,
          updater: target.updater,
        });
      }
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
}
