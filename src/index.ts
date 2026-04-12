/**
* Точка входа Bungee CLI
* Запускает TUI приложение
*/

import { createCliRenderer, ConsolePosition, DebugOverlayCorner } from "@opentui/core";
import { createApp } from "./tui/app.js";

// === Главная функция ===

async function main() {
let renderer: Awaited<ReturnType<typeof createCliRenderer>> | null = null;

try {
	// Создание CLI renderer
	renderer = await createCliRenderer({
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
		enabled: true,
		corner: DebugOverlayCorner.topRight,
	})

	// Создание приложения
	const app = createApp(renderer);

	// Монтирование в root
	renderer.root.add(app.render());

	// Обработка завершения
	process.on("exit", () => {
		app.dispose();
	});

	// Обработка необработанных исключений
	process.on("uncaughtException", (error) => {
		console.error("Необработанное исключение:", error);
		if (renderer) {
			renderer.destroy();
		}
		process.exit(1);
	});

	// Обработка необработанных отклонений промисов
	process.on("unhandledRejection", (reason) => {
		console.error("Необработанное отклонение промиса:", reason);
		if (renderer) {
			renderer.destroy();
		}
		process.exit(1);
	});
} catch (error) {
	console.error("Ошибка запуска TUI:", error);
	if (renderer) {
		renderer.destroy();
	}
	process.exit(1);
}
}

// Запуск
main();
