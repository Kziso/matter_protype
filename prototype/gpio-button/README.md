# GPIO Button Prototype

Minimal Matter.js contact sensor prototype that exposes a Raspberry Pi GPIO input as a BooleanState cluster. The node falls back to a keyboard-driven mock input when the `onoff` module is unavailable (for example on non-Linux development hosts).

## Prerequisites

- Build the monorepo once so local packages are available: `npm install`
- On Raspberry Pi: `npm install --workspace @prototype/gpio-button` to compile the optional `onoff` dependency.

## Build

```bash
npm run build --workspace @prototype/gpio-button
```

## Run

```bash
npm run start --workspace @prototype/gpio-button
```

Environment variables:

- `GPIO_PIN` – BCM pin number to watch (default `17`).
- `GPIO_DEBOUNCE_MS` – debounce time for hardware button (default `10`).
- `PASSCODE`, `DISCRIMINATOR`, `PRODUCT_ID`, `UNIQUE_ID` – override commissioning/basic info fields when needed.

When the `onoff` binding cannot be loaded, press Enter in the terminal to toggle the mock contact state or type `exit` to stop.

## Commissioning

After launching, scan the console QR code or use manual pairing with the configured passcode/discriminator from a Matter controller (e.g. the examples controller). The Boolean State attribute (`stateValue`) reflects the button state in real time.
