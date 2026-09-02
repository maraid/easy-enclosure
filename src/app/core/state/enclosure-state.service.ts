import { Injectable, computed, signal, effect } from '@angular/core';
import { DEFAULT_PARAMS, Params, cloneParams } from '../params';

export type FeatureTarget = {
  id: string;
  group?: string;
  type:
    | 'base'
    | 'lid'
    | 'lidInsert'
    | 'hole'
    | 'pcbMount'
    | 'internalWall'
    | 'waterproof'
    | 'wallMount'
    | 'screwHole'
    | 'cableClamp'
    | 'pcb';
};

const STORAGE_KEY = 'enclosure-params';

@Injectable({ providedIn: 'root' })
export class EnclosureStateService {
  private readonly defaults = cloneParams(DEFAULT_PARAMS);

  readonly params = signal<Params>(this.loadParams());
  readonly loading = signal(false);
  readonly selectedFeature = signal<FeatureTarget | null>(null);

  readonly holeCount = computed(() => this.params().holes.length);

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.params()));
    });
  }

  private loadParams(): Params {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return DEFAULT_PARAMS;
      }

      return {
        ...cloneParams(DEFAULT_PARAMS),
        ...JSON.parse(saved),
      };
    } catch {
      return cloneParams(DEFAULT_PARAMS);
    }
  }

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  setParams(next: Params): void {
    this.params.set(cloneParams(next));
  }

  patchParams(patch: Partial<Params>): void {
    this.params.update((current) => ({
      ...current,
      ...patch,
    }));
  }

  updateParam<K extends keyof Params>(key: K, value: Params[K]): void {
    this.params.update((current) => ({
      ...current,
      [key]: value,
    }));
  }

  resetToDefaults(): void {
    this.params.set(cloneParams(this.defaults));
    this.loading.set(false);
    this.selectedFeature.set(null);
  }

  resetToSimpleEnclosure(): void {
    this.params.update((current) => ({
      ...current,
      holes: [],
      pcbMounts: [],
      internalWalls: [],
      waterProof: false,
      wallMounts: false,
      lidScrews: false,
      cableClamps: [],
      pcb: { ...DEFAULT_PARAMS.pcb, enabled: false },
    }));
    this.selectedFeature.set(null);
  }

  resetToDefaultEnclosure(): void {
    this.params.update((current) => ({
      ...cloneParams(DEFAULT_PARAMS),
    }));
    this.selectedFeature.set(null);
  }

  selectFeature(feature: FeatureTarget | null): void {
    this.selectedFeature.set(feature);
  }
}
