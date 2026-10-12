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
    | 'vent'
    | 'pcbMount'
    | 'pcbHole'
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
  readonly featureScrollRequest = signal(0);
  readonly featureHighlightClearRequest = signal(0);
  private readonly undoDepth = signal(0);
  private readonly redoDepth = signal(0);
  readonly canUndo = computed(() => this.undoDepth() > 0);
  readonly canRedo = computed(() => this.redoDepth() > 0);

  private readonly undoStack: Params[] = [];
  private readonly redoStack: Params[] = [];
  private historyTransaction: Params | null = null;

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
        ...(JSON.parse(saved) as Partial<Params>),
      };
    } catch {
      return cloneParams(DEFAULT_PARAMS);
    }
  }

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  setParams(next: Params): void {
    this.commitParams(next);
  }

  patchParams(patch: Partial<Params>): void {
    this.commitParams({
      ...this.params(),
      ...patch,
    });
  }

  updateParam<K extends keyof Params>(key: K, value: Params[K]): void {
    this.commitParams({
      ...this.params(),
      [key]: value,
    });
  }

  beginHistoryTransaction(): void {
    if (!this.historyTransaction) this.historyTransaction = cloneParams(this.params());
  }

  endHistoryTransaction(): void {
    if (!this.historyTransaction) return;
    const before = this.historyTransaction;
    this.historyTransaction = null;
    if (!this.paramsEqual(before, this.params())) this.undoStack.push(before);
    this.redoStack.length = 0;
    this.syncHistoryState();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(cloneParams(this.params()));
    this.params.set(cloneParams(previous));
    this.syncHistoryState();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneParams(this.params()));
    this.params.set(cloneParams(next));
    this.syncHistoryState();
  }

  private commitParams(next: Params): void {
    const current = this.params();
    const cloned = cloneParams(next);
    if (this.paramsEqual(current, cloned)) return;
    if (!this.historyTransaction) {
      this.undoStack.push(cloneParams(current));
      this.redoStack.length = 0;
      this.syncHistoryState();
    }
    this.params.set(cloned);
  }

  private paramsEqual(a: Params, b: Params): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private syncHistoryState(): void {
    this.undoDepth.set(this.undoStack.length);
    this.redoDepth.set(this.redoStack.length);
  }

  resetToDefaults(): void {
    this.commitParams(this.defaults);
    this.loading.set(false);
    this.selectedFeature.set(null);
  }

  resetToSimpleEnclosure(): void {
    const current = this.params();
    this.commitParams({
      ...current,
      holes: [],
      pcbMounts: [],
      internalWalls: [],
      waterProof: false,
      wallMounts: false,
      lidScrews: false,
      cableClamps: [],
      pcbs: current.pcbs.map((pcb) => ({ ...pcb, enabled: false })),
    });
    this.selectedFeature.set(null);
  }

  resetToDefaultEnclosure(): void {
    this.commitParams(cloneParams(DEFAULT_PARAMS));
    this.selectedFeature.set(null);
  }

  selectFeature(feature: FeatureTarget | null, scrollToFeature = false): void {
    this.selectedFeature.set(feature);
    if (scrollToFeature) {
      this.featureScrollRequest.update((request) => request + 1);
    }
  }

  clearFeatureHighlight(): void {
    this.selectedFeature.set(null);
    this.featureHighlightClearRequest.update((request) => request + 1);
  }
}
