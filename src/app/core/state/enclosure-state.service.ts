import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_PARAMS, Params, cloneParams } from '../params';

export type FeatureTarget =
  | { type: 'hole' | 'pcbMount' | 'internalWall' | 'cableClamp'; id: string }
  | { type: 'base' | 'lid' | 'lidInsert' | 'waterproof' | 'wallMount' | 'screwHole' | 'pcb' };

@Injectable({ providedIn: 'root' })
export class EnclosureStateService {
  private readonly defaults = cloneParams(DEFAULT_PARAMS);

  readonly params = signal<Params>(cloneParams(this.defaults));
  readonly loading = signal(false);
  readonly selectedFeature = signal<FeatureTarget | null>(null);

  readonly holeCount = computed(() => this.params().holes.length);

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
    }));
    this.selectedFeature.set(null);
  }

  selectFeature(feature: FeatureTarget | null): void {
    this.selectedFeature.set(feature);
  }
}
