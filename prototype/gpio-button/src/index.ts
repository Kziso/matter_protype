import "@matter/nodejs/environment/register";

import { Endpoint, Logger, ServerNode, VendorId } from "@matter/main";
import { ContactSensorDevice } from "@matter/main/devices/contact-sensor";
import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const logger = Logger.get("GpioButton");

const DEFAULT_PIN = 17;
const DEFAULT_DEBOUNCE_MS = 10;

type SensorCleanup = () => void;
type SensorChangeHandler = (isPressed: boolean) => void;

type OnoffModule = typeof import("onoff");

async function loadOnoff(): Promise<OnoffModule | undefined> {
    try {
        return await import("onoff");
    } catch (error) {
        logger.warn(`Failed to load onoff module: ${(error as Error).message}. Falling back to mock input.`);
        return undefined;
    }
}

async function setupGpioSensor(onChange: SensorChangeHandler): Promise<SensorCleanup | undefined> {
    const onoff = await loadOnoff();
    if (onoff === undefined) {
        return undefined;
    }

    const pin = Number(process.env.GPIO_PIN ?? DEFAULT_PIN);
    const debounceTimeout = Number(process.env.GPIO_DEBOUNCE_MS ?? DEFAULT_DEBOUNCE_MS);
    logger.info(`Configuring GPIO pin ${pin} with debounce ${debounceTimeout}ms.`);

    const gpio = new onoff.Gpio(pin, "in", "both", { debounceTimeout });

    const currentValue = gpio.readSync() === 1;
    onChange(currentValue);

    const watcher = (error: Error | null, value: 0 | 1) => {
        if (error) {
            logger.error(`GPIO read error: ${error.message}`);
            return;
        }
        onChange(value === 1);
    };

    gpio.watch(watcher);

    return () => {
        gpio.unwatch(watcher);
        gpio.unexport();
    };
}

function setupMockSensor(onChange: SensorChangeHandler): SensorCleanup {
    let currentValue = false;
    const rl = readline.createInterface({ input, output });

    rl.setPrompt("Press Enter to toggle the mock button state. Type 'exit' to quit.\n> ");
    rl.prompt();

    rl.on("line", line => {
        if (line.trim().toLowerCase() === "exit") {
            rl.close();
            return;
        }
        currentValue = !currentValue;
        logger.info(`Mock state changed to ${currentValue ? "OPEN" : "CLOSED"}.`);
        onChange(currentValue);
        rl.prompt();
    });

    rl.on("close", () => {
        logger.info("Mock input closed.");
    });

    return () => rl.close();
}

async function main() {
    const nodeId = process.env.UNIQUE_ID ?? "gpio-button-node";

    const node = await ServerNode.create({
        id: nodeId,
        commissioning: {
            passcode: Number(process.env.PASSCODE ?? 20202021),
            discriminator: Number(process.env.DISCRIMINATOR ?? 3840),
        },
        basicInformation: {
            vendorName: "Prototype",
            vendorId: VendorId(0xfff1),
            productName: "Raspberry Pi GPIO Button",
            productLabel: "GPIO Button",
            nodeLabel: "GPIO Button",
            productId: Number(process.env.PRODUCT_ID ?? 0x8001),
            serialNumber: nodeId,
            uniqueId: nodeId,
        },
        productDescription: {
            name: "GPIO Button",
        },
    });

    const endpoint = new Endpoint(ContactSensorDevice, {
        id: "contact",
        booleanState: {
            stateValue: false,
        },
    });

    await node.add(endpoint);

    const updateState = async (isPressed: boolean) => {
        try {
            await endpoint.set({
                booleanState: {
                    stateValue: isPressed,
                },
            });
            logger.debug(`Contact state updated to ${isPressed}.`);
        } catch (error) {
            logger.error(`Failed to update contact state: ${(error as Error).message}`);
        }
    };

    let cleanup = await setupGpioSensor(updateState);
    if (cleanup === undefined) {
        cleanup = setupMockSensor(updateState);
    }

    const stop = cleanup;
    node.lifecycle.offline.on(() => {
        stop?.();
    });

    const handleExit = () => {
        logger.info("Shutting down GPIO button node...");
        stop?.();
    };

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    logger.info("Matter GPIO button node is starting.");
    await node.run();
}

main().catch(error => {
    logger.error(`Fatal error: ${(error as Error).stack ?? (error as Error).message}`);
    process.exit(1);
});
