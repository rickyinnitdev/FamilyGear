interface DesktopUpdateState { phase: string; text: string; version?: string; percent?: number }
interface ScannedDevice { vendorId: number; productId: number; name: string; deviceClass: string }
interface Window {
  familyGear?: {
    onClose(handler: (reason: string) => Promise<void>): void;
    updateState(): Promise<DesktopUpdateState>;
    onUpdate(handler: (state: DesktopUpdateState) => void): void;
    checkUpdates(): void;
    restartUpdate(): void;
    source(): void;
    community(): Promise<string | null>;
    scanDevices(): Promise<ScannedDevice[]>;
    copyReport(text: string): Promise<void>;
  };
}
