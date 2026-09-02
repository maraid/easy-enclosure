import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import measureBoundingBox from '@jscad/modeling/src/measurements/measureBoundingBox';

import {
  cameras,
  controls,
  drawCommands,
  entitiesFromSolids,
  prepareRender,
} from '@jscad/regl-renderer';
import type { Entity } from '@jscad/regl-renderer/types/geometry-utils-V2/entity';

import type { Params } from '../../core/params';
import { EnclosureStateService } from '../../core/state/enclosure-state.service';
import { ObjectUpdater, Operation } from './renderer.update';
import { FeatureTarget } from '../../core/state/enclosure-state.service';


const gridDeps = [
  'showGrid',
  'gridSpacing',
  'length',
  'width',
  'waterProof',
  'showLid',
  'showBase',
];

const createIdentityMatrix = (): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const makeAdaptiveGridLayer = (regl: any, params: any = {}) => {
  const positions: number[] = [];
  const defaults = {
    visuals: {
      color: [0, 0, 1, 1],
      fadeOut: false,
    },
    ticks: 1,
    size: [16, 16],
    lineWidth: 2,
  };
  const visuals = Object.assign({}, defaults.visuals, params.visuals || {});
  const { fadeOut, color } = visuals;
  const { size, ticks, lineWidth } = Object.assign({}, defaults, params);

  const width = size[0];
  const length = size[1];

  for (let i = -width * 0.5; i <= width * 0.5; i += ticks) {
    positions.push(-length * 0.5, i, 0);
    positions.push(length * 0.5, i, 0);
    positions.push(-length * 0.5, i, 0);
  }

  for (let i = -length * 0.5; i <= length * 0.5; i += ticks) {
    positions.push(i, -width * 0.5, 0);
    positions.push(i, width * 0.5, 0);
    positions.push(i, -width * 0.5, 0);
  }

  return regl({
    vert: `precision mediump float;

    uniform mat4 model, view, projection;

    attribute vec3 position;
    varying vec4 worldPosition;

    void main() {
      worldPosition = model * vec4(position, 1.0);
      gl_Position = projection * view * worldPosition;
    }`,
    frag: `precision mediump float;

    uniform vec4 color;
    uniform vec4 fogColor;
    uniform bool fadeOut;
    uniform vec2 fadeCenter;
    uniform float fadeDistance;
    varying vec4 worldPosition;

    void main() {
      float dist = 0.0;
      if (fadeOut) {
        dist = distance(fadeCenter, worldPosition.xy) / max(fadeDistance, 0.0001);
        dist = clamp(dist, 0.0, 1.0);
        dist = sqrt(dist);
      }

      gl_FragColor = mix(color, fogColor, dist);
    }`,
    attributes: {
      position: regl.buffer(positions),
    },
    count: positions.length / 3,
    uniforms: {
      model: (_context: unknown, props: any) => props?.model ?? createIdentityMatrix(),
      color: (_context: unknown, props: any) => props?.color ?? color,
      fogColor: (_context: unknown, props: any) => {
        const activeColor = props?.color ?? color;
        return [activeColor[0], activeColor[1], activeColor[2], 0];
      },
      fadeOut: (_context: unknown, props: any) => props?.fadeOut ?? fadeOut,
      fadeCenter: (_context: unknown, props: any) => props?.fadeCenter ?? [0, 0],
      fadeDistance: (_context: unknown, props: any) =>
        props?.fadeDistance ?? Math.max(width, length) * 0.5,
    },
    lineWidth: (_context: unknown, props: any) =>
      Math.min(props?.lineWidth ?? lineWidth, regl.limits.lineWidthDims[1]),
    primitive: 'lines',
    cull: {
      enable: true,
      face: 'front',
    },
    polygonOffset: {
      enable: true,
      offset: {
        factor: 1,
        units: Math.random() * 10,
      },
    },
    blend: {
      enable: true,
      func: {
        src: 'src alpha',
        dst: 'one minus src alpha',
      },
    },
  });
};

const makeAdaptiveGridCommand = (regl: any, params: any = {}) => {
  const defaults = {
    size: [50, 50],
    ticks: [10, 1],
  };
  const { size, ticks } = Object.assign({}, defaults, params);
  const drawMainGrid = makeAdaptiveGridLayer(regl, { size, ticks: ticks[0] });
  const drawSubGrid = makeAdaptiveGridLayer(regl, { size, ticks: ticks[1] });

  return (props: any) => {
    drawMainGrid(props);
    drawSubGrid({ ...props, color: props.subColor });
  };
};

const rendererDrawCommands = {
  ...drawCommands,
  drawGrid: makeAdaptiveGridCommand,
} as typeof drawCommands;

type RenderOptions = {
  camera: typeof cameras.perspective.defaults;
  drawCommands: typeof drawCommands;
  entities: Entity[];
};

type Vec3Tuple = [number, number, number];

const vector3Add = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];

const vector3Multiply = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [
  a[0] * b[0],
  a[1] * b[1],
  a[2] * b[2],
];



type SurfaceLabel = {
  name: 'Front' | 'Back' | 'Left' | 'Right' | 'Lid' | 'Bottom' | 'Seal';
  x: number;
  y: number;
};

type SurfaceAnchor = {
  name: SurfaceLabel['name'];
  point: Vec3Tuple;
  normal: Vec3Tuple;
};

type FeatureCandidate = {
  feature: FeatureTarget;
  geometry: Geom3;
  triangles: [Vec3Tuple, Vec3Tuple, Vec3Tuple][];
};

@Component({
  selector: 'app-renderer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block h-full w-full overflow-hidden',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointerleave)': 'onPointerLeave()',
    '(wheel)': 'onWheel($event)',
  },
  templateUrl: './renderer.component.html',
})
export class RendererComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true })
  containerRef?: ElementRef<HTMLDivElement>;

  private resizeObserver: ResizeObserver | null = null;

  private readonly state = inject(EnclosureStateService);

  private readonly perspectiveCamera = cameras.perspective;
  private readonly orbitControls = controls.orbit;

  private readonly camera = {
    ...this.perspectiveCamera.defaults,
  };
  private control = this.orbitControls.defaults;

  private lastX = 0;
  private lastY = 0;
  private rotateDelta: [number, number] = [0, 0];
  private panDelta: [number, number] = [0, 0];
  private zoomDelta = 0;
  private wheelInteracting = true;
  private pointerDown = false;
  private zoomToFit = true;
  private updateView = true;

  private readonly rotateSpeed = 0.002;
  private readonly panSpeed = 1;
  private readonly zoomSpeed = 0.08;

  private renderOptions: RenderOptions | null = null;
  private baseRenderEntities: Entity[] = [];
  private featureCandidates: { id: string; group?: string; geometry: Geom3; triangles: [Vec3Tuple, Vec3Tuple, Vec3Tuple][], type: FeatureTarget['type'], operation: Operation }[] = [];
  private hoveredFeature: FeatureTarget | null = null;
  private renderer: ((options?: RenderOptions) => void) | null = null;
  private objects: ObjectUpdater = new ObjectUpdater();
  private animationFrame: number | null = null;

  private prevParams: Params | null = null;
  private renderDelayHandle: ReturnType<typeof setTimeout> | null = null;
  private isViewReady = false;
  private wheelInteractionHandle: ReturnType<typeof setTimeout> | null = null;

  readonly surfaceLabels = signal<SurfaceLabel[]>([]);


  constructor() {
    effect(() => {
      const currentParams = this.state.params();
      this.scheduleModelRender(currentParams);
    });
  }

  ngAfterViewInit(): void {
    this.isViewReady = true;
    this.observeContainerSize();
    this.scheduleModelRender(this.state.params());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.renderDelayHandle !== null) {
      clearTimeout(this.renderDelayHandle);
      this.renderDelayHandle = null;
    }
    if (this.wheelInteractionHandle !== null) {
      clearTimeout(this.wheelInteractionHandle);
      this.wheelInteractionHandle = null;
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointerDown) {
      this.setHoveredFeature(this.featureAtScreenPosition(event));
      return;
    }

    const dx = this.lastX - event.pageX;
    const dy = event.pageY - this.lastY;

    if (event.shiftKey) {
      this.panDelta[0] += dx;
      this.panDelta[1] += dy;
    } else {
      this.rotateDelta[0] -= dx;
      this.rotateDelta[1] -= dy;
    }

    this.lastX = event.pageX;
    this.lastY = event.pageY;
    event.preventDefault();
  }

  onPointerDown(event: PointerEvent): void {
    const feature = this.featureAtScreenPosition(event);
    if (feature) {
      this.state.selectFeature(feature);
    }
    this.pointerDown = true;
    this.lastX = event.pageX;
    this.lastY = event.pageY;
    this.containerRef?.nativeElement.setPointerCapture(event.pointerId);
    // this.updateSurfaceLabels();
  }

  onPointerUp(event: PointerEvent): void {
    this.pointerDown = false;
    this.containerRef?.nativeElement.releasePointerCapture(event.pointerId);
    // this.updateSurfaceLabels();
  }

  onPointerLeave(): void {
    if (!this.pointerDown) {
      this.setHoveredFeature(null);
    }
  }

  onWheel(event: WheelEvent): void {
    this.zoomDelta += event.deltaY;
    this.wheelInteracting = true;
    if (this.wheelInteractionHandle !== null) {
      clearTimeout(this.wheelInteractionHandle);
    }
    this.wheelInteractionHandle = setTimeout(() => {
      this.wheelInteracting = false;
      // this.updateSurfaceLabels();
    }, 250);
    // this.updateSurfaceLabels();
  }

  private checkDeps(diff: string[], deps: string[]): boolean {
    return diff.some((item) => deps.includes(item));
  }

  private diffParams(previous: Params, current: Params): string[] {
    const diffKeys: string[] = [];
    (Object.keys(previous) as Array<keyof Params>).forEach((key) => {
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        diffKeys.push(key);
      }
    });
    return diffKeys;
  }

  /**
   * Build a scale-reference grid under the rendered model bounds using the
   * renderer's native `drawGrid` command.
   *
   * The underlying command fades from its local origin and treats `size[0]` as
   * the Y span and `size[1]` as the X span, so we translate the grid to the
   * model center and swap the measured XY spans into that expected order.
   */
  private buildGridEntity(params: Params, bounds: [Vec3Tuple, Vec3Tuple]): Entity | null {
    if (!params.showGrid || params.gridSpacing <= 0) {
      return null;
    }

    const spacing = params.gridSpacing;
    const majorSpacing = spacing * 5;
    const visiblePadding = majorSpacing * 5;
    const fadePadding = majorSpacing;
    const [[minX, minY], [maxX, maxY]] = bounds;

    const spanX = Math.max(spacing, maxX - minX);
    const spanY = Math.max(spacing, maxY - minY);
    const sizeX = this.roundUpToStep(spanX + (visiblePadding + fadePadding) * 2, majorSpacing);
    const sizeY = this.roundUpToStep(spanY + (visiblePadding + fadePadding) * 2, majorSpacing);
    const centerX = 0;
    const centerY = 0;

    return {
      visuals: {
        drawCmd: 'drawGrid',
        show: true,
        color: [0, 0, 0, 1],
        subColor: [0, 0, 1, 0.5],
        fadeOut: true,
        transparent: true,
      },
      model: this.buildTranslationMatrix(centerX, centerY, 0),
      fadeCenter: [centerX, centerY],
      fadeDistance: Math.max(sizeX, sizeY) * 0.5,
      size: [sizeY, sizeX],
      ticks: [majorSpacing, spacing],
    } as unknown as Entity;
  }

  private roundUpToStep(value: number, step: number): number {
    return Math.max(step, Math.ceil(value / step) * step);
  }

  private buildTranslationMatrix(x: number, y: number, z: number): number[] {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  }

  private lastRenderTime = 0;
  private pendingParams: Params | null = null;

  private scheduleModelRender(params: Params): void {
    if (!this.isViewReady) return;

    const paramsDiff = this.prevParams ? this.diffParams(this.prevParams, params) : Object.keys(params);
    if (paramsDiff.length === 0) return;

    this.pendingParams = params;

    const elapsed = performance.now() - this.lastRenderTime;
    const minInterval = 16; // ~60fps ceiling, not 250ms

    if (elapsed >= minInterval) {
      this.flushRender(paramsDiff);
    } else if (this.renderDelayHandle === null) {
      this.renderDelayHandle = setTimeout(() => {
        this.renderDelayHandle = null;
        if (this.pendingParams) this.flushRender(paramsDiff);
      }, minInterval - elapsed);
    }
    // else: a flush is already scheduled, this update will be picked up by it
  }

  private flushRender(diff: string[]): void {
    const params = this.pendingParams!;
    this.pendingParams = null;
    this.lastRenderTime = performance.now();
    this.state.setLoading(true);
    void this.renderModel(params, diff).finally(() => {
      this.state.setLoading(false);
      this.prevParams = JSON.parse(JSON.stringify(params)) as Params;
    });
  }

  private doRotatePanZoom(): void {
    if (this.rotateDelta[0] || this.rotateDelta[1]) {
      const updated = this.orbitControls.rotate(
        { controls: this.control, camera: this.camera, speed: this.rotateSpeed },
        this.rotateDelta,
      );
      this.control = { ...this.control, ...updated.controls };
      this.updateView = true;
      this.rotateDelta = [0, 0];
    }

    if (this.panDelta[0] || this.panDelta[1]) {
      const updated = this.orbitControls.pan(
        { controls: this.control, camera: this.camera, speed: this.panSpeed },
        this.panDelta,
      );
      this.control = { ...this.control, ...updated.controls };
      this.panDelta = [0, 0];
      this.camera.position = updated.camera.position;
      this.camera.target = updated.camera.target;
      this.updateView = true;
    }

    if (this.zoomDelta) {
      const updated = this.orbitControls.zoom(
        { controls: this.control, camera: this.camera, speed: this.zoomSpeed },
        this.zoomDelta,
      );
      this.control = { ...this.control, ...updated.controls };
      this.zoomDelta = 0;
      this.updateView = true;
    }

    if (this.zoomToFit) {
      if (!this.renderOptions?.entities) {
        return;
      }
      this.control.zoomToFit.tightness = 1;
      // Frame the model only: reference entities (drawGrid/drawAxis) carry no
      // `geometry`, so including them would feed `undefined` into the bounds
      // calculation and NaN out the camera.
      const frameEntities = this.renderOptions.entities.filter((entity) => entity.geometry);
      const updated = this.orbitControls.zoomToFit({
        controls: this.control,
        camera: this.camera,
        entities: frameEntities,
      });
      this.control = { ...this.control, ...updated.controls };
      this.zoomToFit = false;
      this.updateView = true;
    }
  }

  private updateAndRender = (): void => {
    this.doRotatePanZoom();

    if (this.updateView) {
      const updates = this.orbitControls.update({
        controls: this.control,
        camera: this.camera,
      });

      this.control = { ...this.control, ...updates.controls };
      this.updateView = this.control.changed;

      this.camera.position = updates.camera.position;
      this.perspectiveCamera.update(this.camera);

      if (this.renderer && this.renderOptions) {
        this.renderer(this.renderOptions);
      }

      // this.updateSurfaceLabels();
    }

    this.animationFrame = requestAnimationFrame(this.updateAndRender);
  };

  private setCameraProjection(): void {
    const container = this.containerRef?.nativeElement;
    const width = container?.clientWidth ?? window.innerWidth;
    const height = container?.clientHeight ?? window.innerHeight;

    this.perspectiveCamera.setProjection(this.camera, this.camera, {
      width: Math.max(width, 1),
      height: Math.max(height, 1),
    });
  }

  private observeContainerSize(): void {
    const container = this.containerRef?.nativeElement;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.renderOptions) {
        return;
      }

      this.setCameraProjection();
      this.zoomToFit = true;
      this.updateView = true;
      // this.updateSurfaceLabels();
    });
    this.resizeObserver.observe(container);
  }

  // private updateSurfaceLabels(): void {
  //   const container = this.containerRef?.nativeElement;
  //   if (!container || !this.baseModel || (!this.pointerDown && !this.wheelInteracting)) {
  //     this.surfaceLabels.set([]);
  //     return;
  //   }

  //   const { width, length, height, roof, insertHeight } = this.state.params();
  //   const [originX, originY, originZ] = this.baseOrigin;
  //   const [lidX, lidY, lidZ] = this.lidOrigin;

  //   const anchors: SurfaceAnchor[] = [
  //     {
  //       name: 'Front',
  //       point: [originX + width / 2, originY + length, originZ + height / 2],
  //       normal: [0, 1, 0],
  //     },
  //     {
  //       name: 'Back',
  //       point: [originX + width / 2, originY, originZ + height / 2],
  //       normal: [0, -1, 0],
  //     },
  //     {
  //       name: 'Left',
  //       point: [originX + width, originY + length / 2, originZ + height / 2],
  //       normal: [1, 0, 0],
  //     },
  //     {
  //       name: 'Right',
  //       point: [originX, originY + length / 2, originZ + height / 2],
  //       normal: [-1, 0, 0],
  //     },
  //     {
  //       name: 'Bottom',
  //       point: [originX + width / 2, originY + length / 2, originZ],
  //       normal: [0, 0, -1],
  //     },
  //   ];

  //   if (this.lidModel) {
  //     anchors.push({
  //       name: 'Lid',
  //       point: [lidX + width / 2, lidY + length / 2, lidZ + roof + insertHeight],
  //       normal: [0, 0, 1],
  //     });
  //   }

  //   if (this.sealModel) {
  //     const [sealX, sealY, sealZ] = this.sealOrigin;
  //     anchors.push({
  //       name: 'Seal',
  //       point: [sealX + width / 2, sealY + length / 2, sealZ + Math.max(1, roof) / 2],
  //       normal: [0, 0, 1],
  //     });
  //   }

  //   const projected = anchors
  //     .filter((anchor) => this.isFacingCamera(anchor.point, anchor.normal))
  //     .map((anchor) => {
  //       const screenPos = this.projectWorldToScreen(anchor.point, container);
  //       return screenPos
  //         ? {
  //           name: anchor.name,
  //           x: screenPos[0],
  //           y: screenPos[1],
  //         }
  //         : null;
  //     })
  //     .filter((item): item is SurfaceLabel => item !== null);

  //   this.surfaceLabels.set(projected);
  // }

  private setHoveredFeature(feature: FeatureTarget | null): void {
    const current = this.hoveredFeature;
    const sameKey = (a: FeatureTarget | null, b: FeatureTarget | null) =>
      a && b && (a.group && b.group ? a.group === b.group : a.id === b.id);
    if (sameKey(feature, current)) return;

    this.hoveredFeature = feature;
    const container = this.containerRef?.nativeElement;
    if (container) container.style.cursor = feature ? 'pointer' : '';
    this.refreshRenderEntities();
  }


  private featureAtScreenPosition(event: PointerEvent): FeatureTarget | null {
    const container = this.containerRef?.nativeElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const ray = this.screenPointToRay(event.clientX - rect.left, event.clientY - rect.top, container);

    const EPSILON = 1e-4; // world units — hits within this range of each other are "the same point"

    let closest: { id: string; group?: string; type: FeatureTarget['type']; index?: number; operation: Operation; distance: number } | null = null;

    for (const candidate of this.featureCandidates) {
      for (const triangle of candidate.triangles) {
        const distance = this.rayTriangleIntersection(ray.origin, ray.direction, triangle);
        if (distance === null) continue;

        if (!closest) {
          closest = { id: candidate.id, group: candidate.group, type: candidate.type, operation: candidate.operation, distance };
          continue;
        }

        const delta = distance - closest.distance;

        if (delta < -EPSILON) {
          // clearly closer — always wins
          closest = { id: candidate.id, group: candidate.group, type: candidate.type, operation: candidate.operation, distance };
        } else if (Math.abs(delta) <= EPSILON) {
          // tie — prefer the subtract piece (hole) over the shell it's cut into
          if (candidate.operation === 'subtract' && closest.operation !== 'subtract') {
            closest = { id: candidate.id, group: candidate.group, type: candidate.type, operation: candidate.operation, distance };
          }
        }
        // delta > EPSILON: existing closest is genuinely nearer, keep it
      }
    }

    return closest ? { id: closest.id, group: closest.group, type: closest.type } : null;
  }


  private createFeatureCandidate(feature: FeatureTarget, geometry: Geom3): FeatureCandidate {
    const triangles: [Vec3Tuple, Vec3Tuple, Vec3Tuple][] = [];
    const entities = entitiesFromSolids({}, geometry) as Array<{ geometry: any }>;

    for (const entity of entities) {
      const { positions, indices, transforms } = entity.geometry;
      for (const [a, b, c] of indices) {
        triangles.push([
          this.applyMatrix(positions[a], transforms),
          this.applyMatrix(positions[b], transforms),
          this.applyMatrix(positions[c], transforms),
        ]);
      }
    }

    return { feature, geometry, triangles };
  }

  private screenPointToRay(
    screenX: number,
    screenY: number,
    container: HTMLDivElement,
  ): {
    origin: Vec3Tuple;
    direction: Vec3Tuple;
  } {
    // Convert screen -> NDC
    const ndcX = (screenX / container.clientWidth) * 2 - 1;
    const ndcY = 1 - (screenY / container.clientHeight) * 2;

    const cameraPosition = this.camera.position as Vec3Tuple;
    const cameraTarget = this.camera.target as Vec3Tuple;
    const cameraUp = (this.camera.up as Vec3Tuple | undefined) ?? [0, 0, 1];

    const zAxis = this.normalize(
      this.subtract(cameraPosition, cameraTarget),
    );

    const xAxis = this.normalize(
      this.cross(cameraUp, zAxis),
    );

    const yAxis = this.cross(zAxis, xAxis);

    const fov =
      this.camera.fov > Math.PI
        ? (this.camera.fov * Math.PI) / 180
        : this.camera.fov;

    const aspect =
      container.clientWidth / Math.max(container.clientHeight, 1);

    const halfHeight = Math.tan(fov / 2);
    const halfWidth = halfHeight * aspect;

    const direction = this.normalize([
      xAxis[0] * ndcX * halfWidth +
      yAxis[0] * ndcY * halfHeight -
      zAxis[0],

      xAxis[1] * ndcX * halfWidth +
      yAxis[1] * ndcY * halfHeight -
      zAxis[1],

      xAxis[2] * ndcX * halfWidth +
      yAxis[2] * ndcY * halfHeight -
      zAxis[2],
    ]);

    return {
      origin: cameraPosition,
      direction,
    };
  }

  private rayTriangleIntersection(
    origin: Vec3Tuple,
    direction: Vec3Tuple,
    triangle: [Vec3Tuple, Vec3Tuple, Vec3Tuple],
  ): number | null {
    const [a, b, c] = triangle;

    const epsilon = 1e-8;

    const edge1 = this.subtract(b, a);
    const edge2 = this.subtract(c, a);

    const h = this.cross(direction, edge2);
    const det = this.dot(edge1, h);

    if (Math.abs(det) < epsilon) {
      return null;
    }

    const invDet = 1 / det;

    const s = this.subtract(origin, a);
    const u = invDet * this.dot(s, h);

    if (u < 0 || u > 1) {
      return null;
    }

    const q = this.cross(s, edge1);
    const v = invDet * this.dot(direction, q);

    if (v < 0 || u + v > 1) {
      return null;
    }

    const distance = invDet * this.dot(edge2, q);

    return distance > epsilon ? distance : null;
  }

  private applyMatrix(point: Vec3Tuple, matrix: number[]): Vec3Tuple {
    return [
      matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
      matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
      matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
    ];
  }

  private isPointInFeature(
    point: [number, number],
    candidate: FeatureCandidate,
    container: HTMLDivElement,
  ): boolean {
    return candidate.triangles.some((triangle) => {
      const projected = triangle.map((vertex) => this.projectWorldToScreen(vertex, container));
      if (projected.some((vertex) => vertex === null)) {
        return false;
      }
      return this.isPointInTriangle(
        point,
        projected as [[number, number], [number, number], [number, number]],
      );
    });
  }

  private isPointInTriangle(
    point: [number, number],
    triangle: [[number, number], [number, number], [number, number]],
  ): boolean {
    const [a, b, c] = triangle;
    const sign = (p1: [number, number], p2: [number, number], p3: [number, number]) =>
      (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
    const d1 = sign(point, a, b);
    const d2 = sign(point, b, c);
    const d3 = sign(point, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }

  private refreshRenderEntities(): void {
    if (!this.renderOptions) return;

    const hovered = this.hoveredFeature;
    const matches = hovered
      ? this.featureCandidates.filter((c) =>
        hovered.group ? c.group === hovered.group : c.id === hovered.id)
      : [];

    const highlightEntities = matches.flatMap((c) =>
      (entitiesFromSolids({ color: [1, 0.62, 0, 1] }, c.geometry) as Entity[]).map((entity) => ({
        ...entity,
        extras: { polygonOffset: { enable: true, offset: { factor: -1, units: -1 } } },
      })),
    );

    this.renderOptions.entities = [...this.baseRenderEntities, ...highlightEntities];
    this.updateView = true;
  }
  private isFacingCamera(point: Vec3Tuple, normal: Vec3Tuple): boolean {
    const cameraPosition = this.camera.position as Vec3Tuple;
    const toCamera = this.normalize(this.subtract(cameraPosition, point));
    return this.dot(normal, toCamera) > 0.08;
  }

  private projectWorldToScreen(
    point: Vec3Tuple,
    container: HTMLDivElement,
  ): [number, number] | null {
    const cameraPosition = this.camera.position as Vec3Tuple;
    const cameraTarget = this.camera.target as Vec3Tuple;
    const cameraUp = (this.camera.up as Vec3Tuple | undefined) ?? [0, 0, 1];

    const zAxis = this.normalize(this.subtract(cameraPosition, cameraTarget));
    const xAxis = this.normalize(this.cross(cameraUp, zAxis));
    const yAxis = this.cross(zAxis, xAxis);

    const toPoint = this.subtract(point, cameraPosition);
    const camX = this.dot(toPoint, xAxis);
    const camY = this.dot(toPoint, yAxis);
    const camZ = this.dot(toPoint, zAxis);

    if (camZ >= -0.001) {
      return null;
    }

    const rawFov = this.camera.fov;
    const fov = rawFov > Math.PI ? (rawFov * Math.PI) / 180 : rawFov;
    const halfFovTan = Math.tan(fov / 2);

    if (!Number.isFinite(halfFovTan) || halfFovTan === 0) {
      return null;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / Math.max(height, 1);

    const ndcX = camX / (-camZ * halfFovTan * aspect);
    const ndcY = camY / (-camZ * halfFovTan);

    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) {
      return null;
    }

    if (Math.abs(ndcX) > 1.05 || Math.abs(ndcY) > 1.05) {
      return null;
    }

    const screenX = ((ndcX + 1) / 2) * width;
    const screenY = ((1 - ndcY) / 2) * height;
    return [screenX, screenY];
  }

  private subtract(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  private cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  private dot(a: Vec3Tuple, b: Vec3Tuple): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  private normalize(vector: Vec3Tuple): Vec3Tuple {
    const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
    if (magnitude < 0.000001) {
      return [0, 0, 0];
    }
    return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
  }

  private async renderModel(params: Params, diff: string[]): Promise<void> {

    this.objects.updateAll(params);

    const newModels: Geom3[] = [];
    newModels.push(...this.objects.getModels())

    if (newModels.length === 0) {
      return;
    }

    const modelEntities = newModels.flatMap((m) => entitiesFromSolids({}, m) as Entity[]);

    const bounds = newModels
      .map((m) => measureBoundingBox(m) as [Vec3Tuple, Vec3Tuple])
      .reduce((acc, [min, max]) => [
        [Math.min(acc[0][0], min[0]), Math.min(acc[0][1], min[1]), Math.min(acc[0][2], min[2])],
        [Math.max(acc[1][0], max[0]), Math.max(acc[1][1], max[1]), Math.max(acc[1][2], max[2])],
      ], [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]]);
    const gridEntity = this.buildGridEntity(params, bounds);
    // The grid is a reference plane sitting under the model, so list it first
    // so it draws before the solid geometry.
    this.baseRenderEntities = gridEntity ? [gridEntity, ...modelEntities] : modelEntities;

    this.featureCandidates = this.objects.getFeatureEntries().map((entry) => {
      const c = this.createFeatureCandidate(entry, entry.geometry);
      return { id: entry.id, group: entry.group, type: entry.type, geometry: entry.geometry, triangles: c.triangles, operation: entry.operation };
    });

    // Re-frame the camera when the grid becomes visible (so it lands in view)
    // or when its size-affecting inputs change while it is on. Leave the user's
    // manual orbit alone when the grid is simply toggled off.
    if (gridEntity && this.checkDeps(diff, gridDeps)) {
      this.zoomToFit = true;
    }

    this.renderOptions = {
      camera: this.camera,
      drawCommands: rendererDrawCommands,
      entities: this.baseRenderEntities,
    };

    if (!this.renderer && this.containerRef?.nativeElement) {
      this.renderer = prepareRender({
        glOptions: { container: this.containerRef.nativeElement },
      }) as (options?: RenderOptions) => void;
      this.setCameraProjection();
      // this.updateSurfaceLabels();
      if (this.animationFrame === null) {
        this.updateAndRender();
      }
    } else {
      this.refreshRenderEntities();
      // this.updateSurfaceLabels();
    }
  }
}
