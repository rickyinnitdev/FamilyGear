interface DesktopUpdateState { phase: string; text: string; version?: string; percent?: number }
interface Window {
  familyGear?: {
    onClose(handler: (reason: string) => Promise<void>): void;
    updateState(): Promise<DesktopUpdateState>;
    onUpdate(handler: (state: DesktopUpdateState) => void): void;
    checkUpdates(): void;
    restartUpdate(): void;
    source(): void;
    community(): Promise<string | null>;
  };
}
