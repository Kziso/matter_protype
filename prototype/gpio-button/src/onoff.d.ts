declare module "onoff" {
    export class Gpio {
        constructor(
            pin: number,
            direction: "in" | "out",
            edge?: "none" | "rising" | "falling" | "both",
            options?: { debounceTimeout?: number },
        );
        readSync(): 0 | 1;
        watch(callback: (err: Error | null, value: 0 | 1) => void): void;
        unwatch(callback?: (err: Error | null, value: 0 | 1) => void): void;
        unexport(): void;
    }
}
