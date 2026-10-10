import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';

import type {
  Hole,
  InternalWall,
  Params,
  CableClamp,
  PCB,
  PCBMount,
  Vent,
} from '../../core/params';
import { EnclosureStateService, FeatureTarget } from '../../core/state/enclosure-state.service';

type Surface = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
type RenameableComponent = 'hole' | 'vent' | 'pcbMount' | 'pcbHole' | 'internalWall' | 'cableClamp' | 'pcb';

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
  private lastHandledScrollRequest = 0;

  readonly surfaces: Surface[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];

  constructor() {
    effect(() => {
      const feature = this.state.selectedFeature();
      const scrollRequest = this.state.featureScrollRequest();
      if (!feature) {
        return;
      }

      if (scrollRequest === this.lastHandledScrollRequest) {
        return;
      }
      this.lastHandledScrollRequest = scrollRequest;

      const tabByType = {
        base: 'baseTab',
        lid: 'lidTab',
        lidInsert: 'lidInsertTab',
        hole: 'holesTab',
        vent: 'ventsTab',
        pcbMount: 'pcbMountsTab',
        pcbHole: 'pcbTab',
        internalWall: 'internalWallsTab',
        waterproof: 'waterproofingTab',
        wallMount: 'wallMountsTab',
        screwHole: 'lidScrewsTab',
        cableClamp: 'cableClampsTab',
        pcb: 'pcbTab',
      } as const;
      this.activeTab.set(tabByType[feature.type]);
      // Let the accordion render open before moving the viewport to the item.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          {
            const entry = document.getElementById(feature.id);
            if (!entry) {
              return;
            }

            entry.classList.remove('component-collapsed');
            if (entry instanceof HTMLDetailsElement) {
              entry.open = true;
            }
            entry.scrollIntoView({ block: 'center', behavior: 'smooth' });
          },
        ),
      );
    });
  }

  // definitionId(feature: FeatureTarget): string {
  //   if ('id' in feature) {
  //     return feature.id;
  //   }
  //   if (feature.type === 'lid') {
  //     return 'definition-lid';
  //   }
  //   if (feature.type === 'lidInsert') {
  //     return 'definition-lid-insert';
  //   }
  //   return `definition-${feature.type}`;
  // }

  isSelected(type: RenameableComponent, id: string): boolean {
    const feature = this.state.selectedFeature();
    return feature?.type === type && 'id' in feature && feature.id === id;
  }

  isPcbHoleSelected(pcbId: string): boolean {
    const feature = this.state.selectedFeature();
    if (feature?.type !== 'pcbHole') {
      return false;
    }
    return this.params().pcbs.some(
      (pcb) => pcb.id === pcbId && pcb.holes.some((hole) => hole.id === feature.id),
    );
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
    const isClosing = this.activeTab() === tab;
    this.activeTab.set(isClosing ? null : tab);
    if (isClosing) {
      // The form click handler runs after this header handler and may reselect
      // the accordion's feature, so clear it after the click has propagated.
      queueMicrotask(() => {
        this.state.clearFeatureHighlight();
        setTimeout(() => this.state.clearFeatureHighlight());
      });
    }
  }

  resetToSimpleEnclosure(): void {
    this.state.resetToSimpleEnclosure();
    this.activeTab.set('baseTab');
  }

  resetToDefaultEnclosure(): void {
    this.state.resetToDefaultEnclosure();
    this.activeTab.set('baseTab');
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

  setPcbParam<K extends keyof PCB>(key: K, value: PCB[K]): void {
    this.updatePcb({ [key]: value } as Pick<PCB, K>);
  }

  updatePcb(patch: Partial<PCB>): void {
    const current = this.params();
    const pcbs = current.pcbs.map((pcb) => ({
      ...pcb,
      ...patch,
    }));
    this.state.patchParams({ pcbs });
  }

  updatePcbAt(id: string, patch: Partial<PCB>): void {
    const current = this.params();
    this.state.patchParams({
      pcbs: current.pcbs.map((pcb) => (pcb.id === id ? { ...pcb, ...patch } : pcb)),
    });
  }

  updatePcbField(id: string, key: string, value: number): void {
    this.updatePcbAt(id, { [key]: value } as Partial<PCB>);
  }

  addPcb(): void {
    const current = this.params();
    const next = { ...current.pcbs[0], id: crypto.randomUUID(), name: `PCB ${current.pcbs.length + 1}`, x: 0, y: 0 };
    this.state.patchParams({ pcbs: [...current.pcbs, next] });
  }

  removePcb(id: string): void {
    const current = this.params();
    const pcbs = current.pcbs.filter((pcb) => pcb.id !== id);
    if (pcbs.length) {
      this.state.patchParams({ pcbs });
    }
  }

  copyPcb(id: string): void {
    const current = this.params();
    const pcb = current.pcbs.find((item) => item.id === id);

    if (pcb) {
      this.state.patchParams({
        pcbs: [
          ...current.pcbs,
          {
            ...pcb,
            id: crypto.randomUUID(),
            holes: pcb.holes.map((hole) => ({ ...hole, id: crypto.randomUUID() })),
          },
        ],
      });
    }
  }

  updatePcbHole(pcbId: string, holeId: string, patch: Partial<PCB['holes'][number]>): void {
    const current = this.params();
    const pcbs = current.pcbs.map((pcb) =>
      pcb.id === pcbId
        ? {
            ...pcb,
            holes: pcb.holes.map((hole) => (hole.id === holeId ? { ...hole, ...patch } : hole)),
          }
        : pcb,
    );
    this.state.patchParams({ pcbs });
  }

  removePcbHole(pcbId: string, holeId: string): void {
    const current = this.params();
    const pcbs = current.pcbs.map((pcb) =>
      pcb.id === pcbId ? { ...pcb, holes: pcb.holes.filter((hole) => hole.id !== holeId) } : pcb,
    );
    this.state.patchParams({ pcbs });
  }

  copyPcbHole(pcbId: string, holeId: string): void {
    const current = this.params();
    const pcbs = current.pcbs.map((pcb) => {
      if (pcb.id !== pcbId) {
        return pcb;
      }
      const hole = pcb.holes.find((item) => item.id === holeId);
      return hole ? { ...pcb, holes: [...pcb.holes, { ...hole, id: crypto.randomUUID() }] } : pcb;
    });
    this.state.patchParams({ pcbs });
  }

  addPcbHole(pcbId: string): void {
    const current = this.params();
    const pcbs = current.pcbs.map((pcb) =>
      pcb.id === pcbId
        ? {
            ...pcb,
            holes: [
              ...pcb.holes,
              {
                id: crypto.randomUUID(),
                x: 0,
                y: 0,
                diameter: 2,
                mountEnabled: false,
                mountOuterDiameter: 6,
                mountScrewDiameter: 2,
              },
            ],
          }
        : pcb,
    );
    this.state.patchParams({ pcbs });
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
      rounded: true,
      cornerRadius: 2,
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
      holes: current.holes.map((hole) => (hole.id === id ? { ...hole, ...patch } : hole)),
    });
  }

  addVent(): void {
    const current = this.params();
    const next: Vent = {
      id: crypto.randomUUID(),
      name: `Vent ${current.vents.length + 1}`,
      surface: 'top',
      width: 30,
      length: 20,
      x: 0,
      y: 0,
      rotation: 0,
      rounded: false,
      cornerRadius: 0.5,
      holeWidth: 2,
      supportWidth: 2,
    };
    this.state.patchParams({ vents: [...current.vents, next] });
  }

  removeVent(id: string): void {
    this.state.patchParams({ vents: this.params().vents.filter((vent) => vent.id !== id) });
  }

  copyVent(id: string): void {
    const vent = this.params().vents.find((item) => item.id === id);
    if (vent)
      this.state.patchParams({
        vents: [...this.params().vents, { ...vent, id: crypto.randomUUID() }],
      });
  }

  updateVent(id: string, patch: Partial<Vent>): void {
    this.state.patchParams({
      vents: this.params().vents.map((vent) => (vent.id === id ? { ...vent, ...patch } : vent)),
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
    this.state.patchParams({ pcbMounts: [...current.pcbMounts, next] });
  }

  removePcbMount(id: string): void {
    this.state.patchParams({
      pcbMounts: this.params().pcbMounts.filter((mount) => mount.id !== id),
    });
  }

  copyPcbMount(id: string): void {
    const mount = this.params().pcbMounts.find((item) => item.id === id);
    if (mount)
      this.state.patchParams({
        pcbMounts: [...this.params().pcbMounts, { ...mount, id: crypto.randomUUID() }],
      });
  }

  updatePcbMount(id: string, patch: Partial<PCBMount>): void {
    this.state.patchParams({
      pcbMounts: this.params().pcbMounts.map((mount) =>
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
      surface: 'bottom',
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
      showLidInsert: checked ? true : this.params().showLidInsert,
      lidScrews: checked ? true : this.params().lidScrews,
    });
  }

  setLidInsertEnabled(enabled: boolean): void {
    if (this.params().waterProof) {
      return;
    }
    this.state.updateParam('showLidInsert', enabled);
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
    document.getElementById(id)?.classList.remove('component-collapsed');
    requestAnimationFrame(() => {
      const input = document.getElementById(this.renameInputId(type, id)) as HTMLInputElement | null;
      input?.focus();
      if (input) {
        input.setSelectionRange(0, input.value.length);
      }
    });
  }

  isRenaming(type: RenameableComponent, id: string): boolean {
    const item = this.renamingItem();
    return item?.type === type && item.id === id;
  }

  finishRenaming(type: RenameableComponent, id: string, name: string): void {
    switch (type) {
      case 'hole':
        this.updateHole(id, { name });
        break;
      case 'vent':
        this.updateVent(id, { name });
        break;
      case 'pcbMount':
        this.updatePcbMount(id, { name });
        break;
      case 'internalWall':
        this.updateInternalWall(id, { name });
        break;
      case 'cableClamp':
        this.updateCableClamp(id, { name });
        break;
      case 'pcb':
        this.updatePcbAt(id, { name });
        break;
      default:
        console.warn(`Unknown component type: ${type}`);
        break;
    }
    this.renamingItem.set(null);
  }

  renameInputId(type: RenameableComponent, id: string): string {
    return `rename-${type}-${id}`;
  }

  nameInputSize(name: string | undefined, defaultName: string): number {
    return Math.max(1, this.displayName(name, defaultName).length);
  }

  toggleComponent(event: Event): void {
    const target = event.target;
    if (target instanceof Element && target.closest('button, input, select, textarea')) {
      return;
    }
    (target as Element)?.closest('.sub-params')?.classList.toggle('component-collapsed');
  }

  clearFeatureHighlight(): void {
    this.state.selectFeature(null);
  }

  selectFeatureFromEditor(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const entry = target.closest<HTMLElement>('[data-feature-type], [id].sub-params, [id].accordian');
    if (!entry?.id) {
      return;
    }

    const featureType = entry.dataset['featureType'] as FeatureTarget['type'] | undefined;
    if (featureType) {
      this.state.selectFeature({
        id: entry.dataset['featureId'] ?? entry.id,
        type: featureType,
        group: entry.dataset['featureGroup'],
      });
      return;
    }

    const params = this.params();
    if (entry.id === 'definition-base') {
      this.state.selectFeature({ id: entry.id, type: 'base' });
      return;
    }
    if (params.holes.some((item) => item.id === entry.id)) {
      this.state.selectFeature({ id: entry.id, type: 'hole' });
      return;
    }
    if (params.vents.some((item) => item.id === entry.id)) {
      this.state.selectFeature({ id: entry.id, type: 'vent' });
      return;
    }
    if (params.pcbMounts.some((item) => item.id === entry.id)) {
      this.state.selectFeature({ id: entry.id, type: 'pcbMount' });
      return;
    }
    if (params.internalWalls.some((item) => item.id === entry.id)) {
      this.state.selectFeature({ id: entry.id, type: 'internalWall' });
      return;
    }
    if (params.cableClamps.some((item) => item.id === entry.id)) {
      this.state.selectFeature({ id: entry.id, type: 'cableClamp' });
      return;
    }
    const pcb = params.pcbs.find((item) => item.id === entry.id);
    if (pcb) {
      this.state.selectFeature({ id: pcb.id, type: 'pcb' });
      return;
    }
    if (params.pcbs.some((pcb) => pcb.holes.some((hole) => hole.id === entry.id))) {
      this.state.selectFeature({ id: entry.id, type: 'pcbHole' });
    }
  }
}
