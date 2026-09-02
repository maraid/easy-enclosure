import { TestBed } from '@angular/core/testing';

import { EnclosureStateService } from '../../core/state/enclosure-state.service';
import { ParamsFormComponent } from './params-form.component';

describe('ParamsFormComponent', () => {
  let component: ParamsFormComponent;
  let state: EnclosureStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParamsFormComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ParamsFormComponent);
    component = fixture.componentInstance;
    state = TestBed.inject(EnclosureStateService);
    fixture.detectChanges();
  });

  it('toggles accordion tabs', () => {
    component.setActiveTab('generalTab');
    expect(component.activeTab()).toBe('generalTab');

    component.setActiveTab('generalTab');
    expect(component.activeTab()).toBeNull();
  });

  it('resets to simple enclosure and opens general tab', () => {
    component.setActiveTab('gridTab');
    component.resetToSimpleEnclosure();

    expect(component.activeTab()).toBe('generalTab');
    expect(state.params().holes.length).toBe(0);
    expect(state.params().pcbMounts.length).toBe(0);
    expect(state.params().internalWalls.length).toBe(0);
    expect(state.params().waterProof).toBeFalse();
    expect(state.params().lidScrews).toBeFalse();
  });

  it('supports dynamic holes CRUD operations', () => {
    const initialCount = state.params().holes.length;

    component.addHole();
    expect(state.params().holes.length).toBe(initialCount + 1);

    component.updateHole(initialCount, { shape: 'rectangle', length: 22, width: 9 });
    expect(state.params().holes[initialCount].shape).toBe('rectangle');
    expect(state.params().holes[initialCount].length).toBe(22);

    component.removeHole(initialCount);
    expect(state.params().holes.length).toBe(initialCount);
  });

  it('copies items without sharing their values', () => {
    component.copyHole(0);
    const copiedHole = state.params().holes.at(-1)!;
    expect(copiedHole).toEqual(state.params().holes[0]);

    component.copyPcbMount(0);
    const copiedMount = state.params().pcbMounts.at(-1)!;
    expect(copiedMount).toEqual(state.params().pcbMounts[0]);

    component.copyCableClamp(0);
    const copiedClamp = state.params().cableClamps.at(-1)!;
    expect(copiedClamp).toEqual(state.params().cableClamps[0]);

    component.copyInternalWall(0);
    const copiedWall = state.params().internalWalls.at(-1)!;
    expect(copiedWall).toEqual(state.params().internalWalls[0]);

    component.updateHole(state.params().holes[-1].id, { diameter: 99 });
    expect(state.params().holes[0].diameter).not.toBe(99);
  });

  it('supports custom names for all component types', () => {
    // component.startRenaming('hole', 0);
    // expect(component.isRenaming('hole', 0)).toBeTrue();
    // component.finishRenaming('hole', 0, 'USB-C port');
    // component.finishRenaming('pcbMount', 0, 'Top-left standoff');
    // component.finishRenaming('internalWall', 0, 'Battery divider');

    expect(state.params().holes[0].name).toBe('USB-C port');
    expect(state.params().pcbMounts[0].name).toBe('Top-left standoff');
    expect(state.params().internalWalls[0].name).toBe('Battery divider');
    expect(component.displayName('', 'Hole 1')).toBe('Hole 1');
    expect(component.nameInputSize('', 'Hole 1')).toBe(6);
    expect(component.renamingItem()).toBeNull();
  });

  it('supports pcb mount surface updates', () => {
    const initialCount = state.params().pcbMounts.length;

    component.addPcbMount();
    expect(state.params().pcbMounts.length).toBe(initialCount + 1);
    expect(state.params().pcbMounts[initialCount].surface).toBe('bottom');

    component.updatePcbMount(initialCount, { surface: 'left' });
    expect(state.params().pcbMounts[initialCount].surface).toBe('left');

    component.removePcbMount(initialCount);
    expect(state.params().pcbMounts.length).toBe(initialCount);
  });

  it('applies waterproof and lid screw coupling rules', () => {
    component.onWaterproofChange(false);
    expect(state.params().waterProof).toBeFalse();
    expect(state.params().lidScrews).toBeTrue();

    component.onLidScrewsChange(false);
    expect(state.params().lidScrews).toBeFalse();
    expect(state.params().waterProof).toBeFalse();
  });

  it('ignores empty numeric input', () => {
    const before = state.params().length;
    component.setNumberParam('length', '');
    expect(state.params().length).toBe(before);
  });
});
