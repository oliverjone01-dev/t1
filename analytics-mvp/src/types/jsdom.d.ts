// @types/jsdom в зависимостях нет, а jsdom нужен smoke-прогону и тесту чисел свода.
// Ставить пакет ради двух файлов не стоит: подписываем только то, чем пользуемся.
declare module "jsdom" {
  export class VirtualConsole {
    on(event: string, handler: (...args: any[]) => void): this;
    sendTo(console: any): this;
  }
  export class JSDOM {
    constructor(html?: string, options?: {
      runScripts?: "dangerously" | "outside-only";
      pretendToBeVisual?: boolean;
      virtualConsole?: VirtualConsole;
      url?: string;
      beforeParse?: (window: any) => void;
    });
    readonly window: any;
    serialize(): string;
  }
}
