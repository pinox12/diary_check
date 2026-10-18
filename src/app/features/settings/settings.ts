import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { AppInfo } from '../../core/storage/storage.types';
import { estimateSize } from '../../core/storage/migrate';
import type { Settings } from '../../core/models/models';
import { NotificationService } from '../../core/services/notification.service';
import { UiService } from '../../core/services/ui.service';
import { PlatformService } from '../../core/platform/platform.service';
import { DataStore } from '../../core/state/data.store';
import { IconComponent } from '../../shared/icon/icon';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './settings.html',
})
export class SettingsPage {
  private readonly store = inject(DataStore);
  private readonly ui = inject(UiService);
  private readonly platform = inject(PlatformService);
  protected readonly notifications = inject(NotificationService);

  protected readonly settings = computed(() => this.store.data().settings);
  protected readonly storageInfo = this.platform.info;
  protected readonly isElectron = this.platform.isElectron;
  protected readonly busy = signal(false);
  protected readonly appInfo = signal<AppInfo | null>(null);

  protected readonly leadOptions = [15, 30, 60, 120, 240, 720] as const;

  protected readonly sizeLabel = computed(() => this.formatBytes(estimateSize(this.store.data())));
  protected readonly counts = computed(() => {
    const data = this.store.data();
    return {
      games: data.games.length,
      missions: data.missions.length,
      completions: data.completions.length,
    };
  });

  constructor() {
    void this.platform
      .appInfo()
      .then((info) => this.appInfo.set(info))
      .catch(() => undefined);
  }

  protected update(patch: Partial<Settings>): void {
    this.store.updateSettings(patch);
  }

  protected setTheme(theme: Settings['theme']): void {
    this.store.updateSettings({ theme });
  }

  protected async exportData(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.store.exportData();
      this.ui.toast(result.message, result.ok ? 'ok' : 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async importData(): Promise<void> {
    const confirmed = await this.ui.confirm({
      title: 'Importar datos',
      message: 'Se reemplazarán todos los juegos, misiones e historial actuales por los del archivo.',
      confirmLabel: 'Importar',
      danger: true,
    });
    if (!confirmed) return;
    this.busy.set(true);
    try {
      const result = await this.store.importData();
      this.ui.toast(result.message, result.ok ? 'ok' : 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async resetAll(): Promise<void> {
    const confirmed = await this.ui.confirm({
      title: 'Borrar todos los datos',
      message: 'Se eliminarán tus juegos, misiones e historial. Exporta antes una copia si quieres conservarlos.',
      confirmLabel: 'Borrar todo',
      danger: true,
    });
    if (!confirmed) return;
    this.store.resetAll();
    await this.store.flush();
    this.ui.toast('Todos los datos fueron borrados', 'ok');
  }

  protected openDataFolder(): void {
    void this.platform.openDataFolder().then((result) => {
      if (!result.ok) this.ui.toast('No se pudo abrir la carpeta', 'error');
    });
  }

  protected async testNotification(): Promise<void> {
    await this.notifications.test();
  }

  protected async requestPermission(): Promise<void> {
    const granted = await this.notifications.requestPermission();
    this.ui.toast(granted ? 'Notificaciones permitidas' : 'Permiso denegado por el navegador', granted ? 'ok' : 'error');
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
