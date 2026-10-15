/**
* Точка входа Bungee CLI
* Запускает TUI приложение с Solid.js
*/

import { render } from "@opentui/solid";
import { createCliRenderer, ConsolePosition, DebugOverlayCorner } from "@opentui/core";
import { appendFileSync } from "node:fs";
import App from "./tui/App.jsx";
import "./tui/client.js";

const ERROR_LOG = "debug_output.txt";

function reportFatal(kind: string, error: unknown): void {
	const details = error instanceof Error ? (error.stack ?? error.message) : String(error);
	console.error(`${kind}:`, error);
	try {
		appendFileSync(ERROR_LOG, `[${new Date().toISOString()}] ${kind}: ${details}\n`);
	} catch {
		// не смогли записать лог — не маскируем исходную ошибку
	}
}

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
	// В @opentui/solid 0.6+ render() создаёт свой CliRenderer, если он не передан,
	// поэтому обязательно передаём уже созданный рендерер
	await render(() => <App renderer={renderer} />, renderer);

	// Обработка завершения
	process.on("exit", () => {
		renderer.destroy();
	});

	process.on("uncaughtException", (error) => {
		reportFatal("Необработанное исключение", error);
		renderer.destroy();
		process.exit(1);
	});

	process.on("unhandledRejection", (reason) => {
		reportFatal("Необработанное отклонение промиса", reason);
		renderer.destroy();
		process.exit(1);
	});
}

main().catch((error) => {
	reportFatal("Ошибка запуска TUI", error);
	process.exit(1);
});
