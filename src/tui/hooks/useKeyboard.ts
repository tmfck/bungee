/**
 * Хук для обработки клавиатурных событий
 * Предоставляет удобный интерфейс для работы с горячими клавишами
 */

import type { CliRenderer, KeyEvent } from "@opentui/core";

// === Интерфейсы ===

export interface KeyboardHandlers {
  onF1?: () => void;
  onF3?: () => void;
  onF5?: () => void;
  onF10?: () => void;
  onF12?: () => void;
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
  onBackspace?: () => void;
  onDelete?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onPageUp?: () => void;
  onPageDown?: () => void;
  onKey?: (key: string) => void;
}

export interface KeyboardHook {
  dispose: () => void;
}

// === Хук ===

export function useKeyboard(
  renderer: CliRenderer,
  handlers: KeyboardHandlers
): KeyboardHook {
  // Маппинг клавиш на обработчики
  const keyMap: Map<string, () => void> = new Map([
    // Функциональные клавиши
    ["f1", handlers.onF1 || (() => {})],
    ["f3", handlers.onF3 || (() => {})],
    ["f5", handlers.onF5 || (() => {})],
    ["f10", handlers.onF10 || (() => {})],
    ["f12", handlers.onF12 || (() => {})],

    // Специальные клавиши
    ["escape", handlers.onEscape || (() => {})],
    ["return", handlers.onEnter || (() => {})],
    ["enter", handlers.onEnter || (() => {})],
    ["up", handlers.onArrowUp || (() => {})],
    ["down", handlers.onArrowDown || (() => {})],
    ["left", handlers.onArrowLeft || (() => {})],
    ["right", handlers.onArrowRight || (() => {})],
    ["tab", handlers.onTab || (() => {})],
    ["backspace", handlers.onBackspace || (() => {})],
    ["delete", handlers.onDelete || (() => {})],
    ["home", handlers.onHome || (() => {})],
    ["end", handlers.onEnd || (() => {})],
    ["pageup", handlers.onPageUp || (() => {})],
    ["pagedown", handlers.onPageDown || (() => {})],
  ]);

	// Обработчик события keypress
	function handleKeypress(event: KeyEvent) {
		const name = (event as any).name?.toLowerCase() || "";
		const shift = (event as any).shift || false;

		// Обработка Shift+Tab
		if (name === "tab" && shift && handlers.onShiftTab) {
			handlers.onShiftTab();
			return;
		}

		// Поиск обработчика
		const handler = keyMap.get(name);
		if (handler) {
			handler();
		} else if (handlers.onKey) {
			// Передаём оригинальное имя клавиши (без toLowerCase для букв)
			handlers.onKey((event as any).name || name);
		}
	}

  // Подписка на события
  renderer.keyInput.on("keypress", handleKeypress);

  // Возврат объекта с методом dispose
  return {
    dispose: () => {
      renderer.keyInput.off("keypress", handleKeypress);
    },
  };
}

// === Вспомогательные функции ===

/**
 * Создаёт маппинг клавиш для конкретного экрана
 */
export function createScreenKeyMap(
  actions: Record<string, () => void>
): Partial<KeyboardHandlers> {
  return {
    onEnter: actions.select,
    onEscape: actions.back,
    onArrowUp: actions.up,
    onArrowDown: actions.down,
    onArrowLeft: actions.left,
    onArrowRight: actions.right,
    onF1: actions.help,
    onF5: actions.refresh,
  };
}
