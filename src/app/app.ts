import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { EnclosureStateService } from './core/state/enclosure-state.service';
import { RendererComponent } from './features/renderer/renderer.component';
import { SidebarComponent } from './features/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RendererComponent, SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly state = inject(EnclosureStateService);

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? this.state.redo() : this.state.undo();
    } else if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.state.redo();
    }
  }
}
