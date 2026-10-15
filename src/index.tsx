/**
* Точка входа Bungee CLI
* Запускает TUI приложение с Solid.js
*/

import { render } from "@opentui/solid";
import { createCliRenderer, ConsolePosition, DebugOverlayCorner } from "@opentui/core";
import App from "./tui/App.jsx";
import { createUserSideClient } from "./tui/userside.js";

const USERSIDE_URL = process.env.USERSIDE_URL;
const USERSIDE_COOKIE = process.env.USERSIDE_COOKIE;

if (!USERSIDE_URL || !USERSIDE_COOKIE) {
	console.error("Error: USERSIDE_URL and USERSIDE_COOKIE must be set in .env");
	process.exit(1);
}

export const usersideClient = createUserSideClient({
	baseUrl: USERSIDE_URL,
	cookie: USERSIDE_COOKIE,
});

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
