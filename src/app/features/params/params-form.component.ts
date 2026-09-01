import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';

import type { Hole, InternalWall, PCBMount, Params, CableClamp, PCB } from '../../core/params';
import { EnclosureStateService, FeatureTarget } from '../../core/state/enclosure-state.service';

type Surface = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
type RenameableComponent = 'hole' | 'pcbMount' | 'internalWall' | 'cableClamp';

@Component({
  selector: 'app-params-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './params-form.component.html',
  styleUrl: './params-form.component.css',
})
export class ParamsFormComponent {
  private readonly state = inject(EnclosureStateService);

  readonly activeTab = signal<string | null>(null);
  readonly renamingItem = signal<{ type: RenameableComponent; id: string } | null>(null);

  readonly surfaces: Surface[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];

  constructor() {
    effect(() => {
      const feature = this.state.selectedFeature();
      if (!feature) {
        return;
      }

      const tabByType = {
        base: 'generalTab',
        lid: 'generalTab',
        lidInsert: 'lidInsertTab',
        hole: 'holesTab',
        pcbMount: 'pcbMountsTab',
        internalWall: 'internalWallsTab',
        waterproof: 'waterproofingTab',
        wallMount: 'wallMountsTab',
        screwHole: 'lidScrewsTab',
        cableClamp: 'cableClampsTab',
        pcb: 'pcbTab',
      } as const;
      this.activeTab.set(tabByType[feature.type]);
      setTimeout(() =>
        document
          .getElementById(this.definitionId(feature))
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
    });
  }

  featureId(type: RenameableComponent, id: number | string): string {
    return `feature-${type}-${id}`;
  }

  definitionId(feature: FeatureTarget): string {
    if ('id' in feature) {
      return this.featureId(feature.type, feature.id);
    }
    if (feature.type === 'lid') {
      return 'definition-base';
    }
    if (feature.type === 'lidInsert') {
      return 'definition-lid';
    }
    return `definition-${feature.type}`;
  }

  isSelected(type: RenameableComponent, id: string): boolean {
    const feature = this.state.selectedFeature();
    return feature?.type === type && 'id' in feature && feature.id === id;
  }

  surfaceLabel(surface: Surface): string {
    if (surface === 'top') {
      return 'Lid';
    }
    return surface[0].toUpperCase() + surface.slice(1);
  }

  params(): Params {
    return this.state.params();
  }

  setActiveTab(tab: string): void {
    this.activeTab.set(this.activeTab() === tab ? null : tab);
  }

  resetToSimpleEnclosure(): void {
    this.state.resetToSimpleEnclosure();
    this.activeTab.set('generalTab');
  }

  setNumberParam<K extends keyof Params>(key: K, rawValue: string): void {
    if (!rawValue) {
      return;
    }
    const parsed = parseFloat(rawValue);
    if (!Number.isNaN(parsed)) {
      this.state.updateParam(key, parsed as Params[K]);
    }
  }

  setBooleanParam<K extends keyof Params>(key: K, checked: boolean): void {
    this.state.updateParam(key, checked as Params[K]);
  }

  setPcbParam<K extends keyof PCB>(key: K, value: PCB[K]): void { this.updatePcb({ [key]: value } as Pick<PCB, K>); }

  updatePcb(patch: Partial<PCB>): void {
    const pcb = this.params().pcb;

    this.state.updateParam('pcb', {
      ...pcb,
      ...patch,
    });
  }

  addHole(): void {
    const current = this.params();

    const next: Hole = {
      id: crypto.randomUUID(),
      name: `Hole ${current.holes.length + 1}`,
      shape: 'circle',
      surface: 'front',
      diameter: 12.5,
      width: 10,
      length: 10,
      y: current.width / 2,
      x: 6,
    };

    this.state.patchParams({
      holes: [...current.holes, next],
    });
  }

  removeHole(id: string): void {
    const current = this.params();

    this.state.patchParams({
      holes: current.holes.filter((hole) => hole.id !== id),
    });
  }

  copyHole(id: string): void {
    const current = this.params();
    const hole = current.holes.find((hole) => hole.id === id);

    if (hole) {
      this.state.patchParams({
        holes: [
          ...current.holes,
          {
            ...hole,
            id: crypto.randomUUID(),
          },
        ],
      });
    }
  }

  updateHole(id: string, patch: Partial<Hole>): void {
    const current = this.params();

    this.state.patchParams({
      holes: current.holes.map((hole) =>
        hole.id === id ? { ...hole, ...patch } : hole,
      ),
    });
  }




  addPcbMount(): void {
    const current = this.params();

    const next: PCBMount = {
      id: crypto.randomUUID(),
      name: `Mount ${current.pcbMounts.length + 1}`,
      surface: 'bottom',
      x: 0,
      y: 0,
      height: 5,
      outerDiameter: 6,
      screwDiameter: 2,
    };

    this.state.patchParams({
      pcbMounts: [...current.pcbMounts, next],
    });
  }

  removePcbMount(id: string): void {
    const current = this.params();

    this.state.patchParams({
      pcbMounts: current.pcbMounts.filter((mount) => mount.id !== id),
    });
  }

  copyPcbMount(id: string): void {
    const current = this.params();
    const mount = current.pcbMounts.find((mount) => mount.id === id);

    if (mount) {
      this.state.patchParams({
        pcbMounts: [
          ...current.pcbMounts,
          {
            ...mount,
            id: crypto.randomUUID(),
          },
        ],
      });
    }
  }

  updatePcbMount(id: string, patch: Partial<PCBMount>): void {
    const current = this.params();

    this.state.patchParams({
      pcbMounts: current.pcbMounts.map((mount) =>
        mount.id === id ? { ...mount, ...patch } : mount,
      ),
    });
  }




  addCableClamp(): void {
    const current = this.params();

    const next: CableClamp = {
      id: crypto.randomUUID(),
      name: `Clamp ${current.cableClamps.length + 1}`,
      x: 0,
      y: 0,
      length: 15,
      wallHeight: 5,
      wallThickness: 3,
      mountScrewDiameter: 2,
      mountOuterDiameter: 4,
      mountHeight: 6,
      rotation: 0,
      topHeight: 2,
      topScrewDiameter: 2.5,
      surface: 'bottom',
    };

    this.state.patchParams({
      cableClamps: [...current.cableClamps, next],
    });
  }

  removeCableClamp(id: string): void {
    const current = this.params();

    this.state.patchParams({
      cableClamps: current.cableClamps.filter((clamp) => clamp.id !== id),
    });
  }

  copyCableClamp(id: string): void {
    const current = this.params();
    const clamp = current.cableClamps.find((clamp) => clamp.id === id);

    if (clamp) {
      this.state.patchParams({
        cableClamps: [
          ...current.cableClamps,
          {
            ...clamp,
            id: crypto.randomUUID(),
          },
        ],
      });
    }
  }

  updateCableClamp(id: string, patch: Partial<CableClamp>): void {
    const current = this.params();

    this.state.patchParams({
      cableClamps: current.cableClamps.map((clamp) =>
        clamp.id === id ? { ...clamp, ...patch } : clamp,
      ),
    });
  }




  addInternalWall(): void {
    const current = this.params();
    const next: InternalWall = {
      id: crypto.randomUUID(),
      name: `Internal Wall ${current.internalWalls.length + 1}`,
      x: 0,
      y: 0,
      height: 10,
      length: 25,
      thickness: 2,
      rotation: 0,
      surface: "bottom"
    };
    this.state.patchParams({ internalWalls: [...current.internalWalls, next] });
  }


  removeInternalWall(id: string): void {
    const current = this.params();

    this.state.patchParams({
      internalWalls: current.internalWalls.filter((wall) => wall.id !== id),
    });
  }

  copyInternalWall(id: string): void {
    const current = this.params();
    const wall = current.internalWalls.find((wall) => wall.id === id);

    if (wall) {
      this.state.patchParams({
        internalWalls: [
          ...current.internalWalls,
          {
            ...wall,
            id: crypto.randomUUID(),
          },
        ],
      });
    }
  }

  updateInternalWall(id: string, patch: Partial<InternalWall>): void {
    const current = this.params();

    this.state.patchParams({
      internalWalls: current.internalWalls.map((wall) =>
        wall.id === id ? { ...wall, ...patch } : wall,
      ),
    });
  }

  onWaterproofChange(checked: boolean): void {
    this.state.patchParams({
      waterProof: checked,
      lidScrews: checked ? true : this.params().lidScrews,
    });
  }

  onLidScrewsChange(checked: boolean): void {
    this.state.patchParams({
      lidScrews: checked,
      waterProof: checked ? this.params().waterProof : false,
    });
  }

  parseIntValue(rawValue: string): number {
    return parseInt(rawValue, 10);
  }

  displayName(name: string | undefined, defaultName: string): string {
    return name?.trim() || defaultName;
  }

  startRenaming(type: RenameableComponent, id: string): void {
    this.renamingItem.set({ type, id });
    setTimeout(() => document.getElementById(this.renameInputId(type, id))?.focus());
  }

  isRenaming(type: RenameableComponent, id: string): boolean {
    const item = this.renamingItem();
    return item?.type === type && item.id === id;
  }

  finishRenaming(type: RenameableComponent, id: string, name: string): void {
    if (type === 'hole') {
      this.updateHole(id, { name });
    } else if (type === 'pcbMount') {
      this.updatePcbMount(id, { name });
    } else {
      this.updateInternalWall(id, { name });
    }
    this.renamingItem.set(null);
  }

  renameInputId(type: RenameableComponent, id: string): string {
    return `rename-${type}-${id}`;
  }

  nameInputSize(name: string | undefined, defaultName: string): number {
    return Math.max(1, this.displayName(name, defaultName).length);
  }
}
