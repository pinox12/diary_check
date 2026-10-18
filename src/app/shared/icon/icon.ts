import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export const ICON_PATHS = {
  home: ['M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'],
  gamepad: [
    'M7 12h4',
    'M9 10v4',
    'M15.5 11h.01',
    'M18 13.5h.01',
    'M8 7h8a5 5 0 0 1 4.9 3.97l1 6A2.6 2.6 0 0 1 19.4 20l-1.9-2.2H6.5L4.6 20a2.6 2.6 0 0 1-2.5-3.03l1-6A5 5 0 0 1 8 7z',
  ],
  chart: ['M5 20V11', 'M12 20V4', 'M19 20v-6', 'M3 20h18'],
  sliders: ['M4 7h9', 'M17 7h3', 'M4 17h5', 'M13 17h7', 'M15 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0', 'M11 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  pencil: ['M4 20h4L20 8l-4-4L4 16z', 'M14 6l4 4'],
  check: ['M4 12.5 9.5 18 20 6'],
  refresh: ['M20 11a8 8 0 1 0-2.3 6.3', 'M20 5v6h-6'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M16.5 16.5 21 21'],
  image: ['M4 5h16v14H4z', 'M9 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3', 'M4 16l4.5-4.5L14 17', 'M14.5 14.5 17 12l3 3'],
  link: [
    'M9.5 14.5 14.5 9.5',
    'M11 7.5l1.5-1.5a3.5 3.5 0 0 1 5 5L16 12.5',
    'M13 16.5 11.5 18a3.5 3.5 0 0 1-5-5L8 11.5',
  ],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
  download: ['M12 4v12', 'M7 11l5 5 5-5', 'M4 20h16'],
  bell: ['M6 9a6 6 0 0 1 12 0c0 4.5 1.5 5.5 1.5 5.5H4.5S6 13.5 6 9z', 'M10 18.5a2 2 0 0 0 4 0'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M19.1 4.9l-1.4 1.4', 'M6.3 17.7l-1.4 1.4'],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'],
  'chevron-up': ['M6 15l6-6 6 6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'arrow-left': ['M20 12H4', 'M10 6l-6 6 6 6'],
  x: ['M6 6l12 12', 'M18 6 6 18'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.5V12l3 2'],
  calendar: ['M5 6h14v14H5z', 'M8 3v4', 'M16 3v4', 'M5 10h14'],
  fire: ['M12 22a6 6 0 0 0 6-6c0-4.2-3.2-6.2-4.2-9.2-1.2 3-2.2 4-3 4.8-.9-.9-1.8-2-1.8-3.8C6 9.8 6 12 6 16a6 6 0 0 0 6 6z'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
  alert: ['M12 4 3 20h18z', 'M12 10v4', 'M12 17h.01'],
  external: ['M14 4h6v6', 'M20 4l-8 8', 'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'],
  folder: ['M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  sparkles: ['M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z', 'M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3.5 9h17', 'M3.5 15h17', 'M12 3c2.5 2.6 2.5 15.4 0 18', 'M12 3c-2.5 2.6-2.5 15.4 0 18'],
  copy: ['M9 9h11v11H9z', 'M15 9V5H4v11h4'],
  filter: ['M4 6h16l-6 7v5l-4 2v-7z'],
  eye: ['M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  'eye-off': ['M4 4l16 16', 'M9.9 5.1A9.7 9.7 0 0 1 12 4.9c6 0 9.5 5.4 9.5 5.4a17 17 0 0 1-3.3 3.8', 'M6.3 7.3A17 17 0 0 0 2.5 10.3s3.5 5.4 9.5 5.4a9.9 9.9 0 0 0 3.5-.6'],
  monitor: ['M4 5h16v11H4z', 'M9 20h6', 'M12 16v4'],
  smartphone: ['M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M11 18h2'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="shrink-0"
    >
      @for (path of paths(); track path) {
        <path [attr.d]="path" />
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly strokeWidth = input(1.8);

  protected readonly paths = computed<readonly string[]>(() => ICON_PATHS[this.name()] ?? []);
}
