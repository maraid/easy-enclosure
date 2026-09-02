import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { union } from '@jscad/modeling/src/operations/booleans';
import { serialize } from '@jscad/stl-serializer';
import { saveAs } from 'file-saver';

import type { Params } from '../../core/params';
import { EnclosureStateService } from '../../core/state/enclosure-state.service';
import { ActionButtonComponent } from '../../shared/action-button/action-button.component';
import { ObjectUpdater, Origin } from '../renderer/renderer.update'; // adjust path to wherever ObjectUpdater lives

const ORIGIN_LABELS: Record<Origin, string> = {
  base: 'base',
  lid: 'lid',
  seal: 'waterproof-seal',
  clampTops: 'cable-clamp-tops',
};

@Component({
  selector: 'app-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionButtonComponent],
  templateUrl: './tools.component.html',
})
export class ToolsComponent {
  @ViewChild('fileInput')
  fileInput?: ElementRef<HTMLInputElement>;

  @ViewChild('exportDialog')
  exportDialog?: ElementRef<HTMLDialogElement>;

  private readonly state = inject(EnclosureStateService);

  readonly isExportModalOpen = signal(false);

  openFilePicker(): void {
    this.fileInput?.nativeElement.click();
  }

  openExportModal(): void {
    this.isExportModalOpen.set(true);
    const dialog = this.exportDialog?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  closeExportModal(): void {
    this.isExportModalOpen.set(false);
    const dialog = this.exportDialog?.nativeElement;
    if (dialog?.open) dialog.close();
  }

  saveParamsFile(): void {
    const tsStr = this.formattedTimestamp();
    const data = JSON.stringify(this.state.params(), null, 2);
    const textFile = new Blob([data], { type: 'text/plain' });
    this.saveFile(textFile, `enclosure-${tsStr}.json`);
  }

  loadParamsFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const fileReader = new FileReader();
    fileReader.onload = () => {
      const data = JSON.parse(fileReader.result as string) as Partial<Params>;
      const merged = { ...this.state.params(), ...data };
      this.state.setParams(merged as Params);
    };
    fileReader.readAsText(input.files[0], 'UTF-8');
    input.value = '';
  }

  exportMountsStl(): void {
    const tsStr = this.formattedTimestamp();
    const currentParams = this.state.params();

    const objects = new ObjectUpdater();
    objects.updateAll(currentParams);

    const mounts = objects.getModelsByType('pcbMount');
    if (mounts.length === 0) {
      this.closeExportModal();
      return;
    }

    const geometry = mounts.length === 1 ? mounts[0] : union(mounts);
    this.exportGeometry(`enclosure-pcb-mounts-${tsStr}`, geometry);

    this.closeExportModal();
  }

  exportStl(): void {
    const tsStr = this.formattedTimestamp();
    const currentParams = this.state.params();

    // Rebuild via the same pipeline the renderer uses, so export
    // exactly matches what's on screen — same geometry, same cuts.
    const objects = new ObjectUpdater();
    objects.updateAll(currentParams);

    const grouped = objects.getModelsByOrigin();

    for (const [origin, pieces] of grouped) {
      if (pieces.length === 0) continue;
      const geometry = pieces.length === 1 ? pieces[0] : union(pieces);
      this.exportGeometry(`enclosure-${ORIGIN_LABELS[origin]}-${tsStr}`, geometry);
    }

    this.closeExportModal();
  }

  private exportGeometry(name: string, geometry: Geom3): void {
    const rawData = serialize({ binary: false }, geometry);
    const blob = new Blob([rawData], { type: 'application/octet-stream' });
    this.saveFile(blob, `${name}.stl`);
  }

  private saveFile(data: Blob, fileName: string): void {
    saveAs(data, fileName);
  }

  private formattedTimestamp(): string {
    const ts = new Date();
    return `${ts.getFullYear()}${ts.getMonth() + 1}${ts.getDate()}${ts.getHours()}${ts.getMinutes()}${ts.getSeconds()}`;
  }
}
