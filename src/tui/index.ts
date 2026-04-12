/**
 * Точка входа TUI приложения Bungee
 * Инициализирует CLI renderer и запускает приложение
 */

import { createCliRenderer, Box, Text, TextAttributes } from "@opentui/core";
import { createApp } from "./app.js";

// === Главная функция ===

async function main() {
  try {
    // Создание CLI renderer
    const renderer = await createCliRenderer({
      exitOnCtrlC: true,
      title: "Bungee TUI",
    });

    // Создание приложения
    const app = createApp(renderer);

    // Монтирование в root
    renderer.root.add(app.render());

    // Обработка завершения
    process.on("exit", () => {
      app.dispose();
    });

    console.log("Bungee TUI запущен. Нажмите F1 для справки.");
  } catch (error) {
    console.error("Ошибка запуска TUI:", error);
    process.exit(1);
  }
}

// Запуск
main();

// === Экспорты ===

export { createApp } from "./app.js";
export { createStore, type Store, type AppState, type ScreenId } from "./store.js";
export { createRouter, type Router } from "./router.js";
export { useKeyboard } from "./hooks/useKeyboard.js";
export { useNavigation } from "./hooks/useNavigation.js";
