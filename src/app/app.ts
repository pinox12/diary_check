import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { countPending } from './core/logic/progress';
import { PlatformService } from './core/platform/platform.service';
import { NotificationService } from './core/services/notification.service';
import { electronBridge } from './core/storage/electron-bridge';
import { ClockService } from './core/state/clock.service';
import { DataStore } from './core/state/data.store';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog';
import { IconComponent, type IconName } from './shared/icon/icon';
import { ToastsComponent } from './shared/toasts/toasts';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact: boolean;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    ConfirmDialogComponent,
    ToastsComponent,
  ],
  templateUrl: './app.html',
})
export class App {
  private readonly store = inject(DataStore);
  private readonly clock = inject(ClockService);
  private readonly notifications = inject(NotificationService);
  private readonly platform = inject(PlatformService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Hoy', icon: 'home', exact: true },
    { path: '/games', label: 'Juegos', icon: 'gamepad', exact: false },
    { path: '/history', label: 'Historial', icon: 'chart', exact: false },
    { path: '/settings', label: 'Ajustes', icon: 'sliders', exact: false },
  ];

  protected readonly pending = computed(() => countPending(this.store.data(), this.clock.slowNow()).missions);
  protected readonly ready = this.store.ready;
  protected readonly saveStatus = this.store.saveStatus;
  protected readonly saveError = this.store.saveError;
  protected readonly loadError = this.store.loadError;
  protected readonly storageLabel = this.platform.info.label;
  protected readonly isElectron = this.platform.isElectron;

  protected readonly saveLabel = computed(() => {
    switch (this.saveStatus()) {
      case 'saving':
        return 'Guardando…';
      case 'saved':
        return 'Todo guardado';
      case 'error':
        return 'Error al guardar';
      default:
        return this.ready() ? 'Sin cambios' : 'Cargando…';
    }
  });

  constructor() {
    // El reloj alimenta los recordatorios (se autolimita a una comprobación cada 30 s).
    effect(() => {
      const now = this.clock.now();
      void this.notifications.check(now);
    });

    // Resumen de pendientes al abrir la app (una vez al día).
    effect(() => {
      if (!this.store.ready()) return;
      untracked(() => void this.notifications.sendSummary(Date.now()));
    });

    // Comandos del menú nativo de Electron.
    electronBridge()?.onMenuCommand((command) => this.handleMenuCommand(command));

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.clock.refresh();
      });
    }
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  private handleMenuCommand(command: string): void {
    switch (command) {
      case 'export':
        void this.store.exportData();
        break;
      case 'import':
        void this.store.importData();
        break;
      case 'go:dashboard':
        void this.router.navigate(['/']);
        break;
      case 'go:games':
        void this.router.navigate(['/games']);
        break;
      case 'go:history':
        void this.router.navigate(['/history']);
        break;
      case 'go:settings':
        void this.router.navigate(['/settings']);
        break;
      default:
        break;
    }
  }
}
