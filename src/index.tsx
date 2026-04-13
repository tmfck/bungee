/**
 * Точка входа Bungee CLI
 * Запускает TUI приложение с Solid.js
 */

import { render } from "@opentui/solid";
import { createCliRenderer, ConsolePosition, DebugOverlayCorner } from "@opentui/core";
import App from "./tui/App.jsx";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 30,
    },
    targetFps: 5,
    maxFps: 15,
  });

  renderer.toggleDebugOverlay();
  renderer.configureDebugOverlay({
    enabled: false,
    corner: DebugOverlayCorner.topRight,
  });

  // Рендерим Solid.js приложение
  render(() => <App renderer={renderer} />);

  // Обработка завершения
  process.on("exit", () => {
    renderer.destroy();
  });

  process.on("uncaughtException", (error) => {
    console.error("Необработанное исключение:", error);
    renderer.destroy();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Необработанное отклонение промиса:", reason);
    renderer.destroy();
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("Ошибка запуска TUI:", error);
  process.exit(1);
});
