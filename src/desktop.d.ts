interface DesktopUpdateState { phase: string; text: string; version?: string; percent?: number }
interface ScannedDevice { vendorId: number; productId: number; name: string; deviceClass: string }
interface Window {
  familyGear?: {
    x11(operation:string,args?:Array<string|number|boolean>):Promise<any>;
    onClose(handler: (reason: string) => Promise<void>): void;
    updateState(): Promise<DesktopUpdateState>;
    onUpdate(handler: (state: DesktopUpdateState) => void): void;
    checkUpdates(): void;
    restartUpdate(): void;
    source(): void;
    community(): Promise<string | null>;
    reportingConfig(): Promise<{configured:boolean;provider:string;endpoint:string}>;
    sendDeviceReport(report:unknown): Promise<{sent:boolean;reason?:string}>;
    scanDevices(): Promise<ScannedDevice[]>;
    delayEnvironment(): Promise<{acceleration:boolean;pointerSpeed:number}>;
    openMouseSettings(): Promise<void>;
    copyReport(text: string): Promise<void>;
  };
}
