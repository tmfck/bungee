/**
 * Точка входа Bungee CLI
 * Запускает TUI приложение
 */

import { createCliRenderer, Box, Text, TextAttributes, ASCIIFont } from "@opentui/core";
import { createApp } from "./tui/app.js";

// === Главная функция ===

async function main() {
  try {
    // Создание CLI renderer
    const renderer = await createCliRenderer({
      exitOnCtrlC: true,
    });

    // Создание приложения
    const app = createApp(renderer);

    // Монтирование в root
    renderer.root.add(app.render());

    // Обработка завершения
    process.on("exit", () => {
      app.dispose();
    });
  } catch (error) {
    console.error("Ошибка запуска TUI:", error);
    process.exit(1);
  }
}

// Запуск
main();
