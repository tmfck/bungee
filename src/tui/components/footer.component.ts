/**
 * Компонент футера приложения
 * Отображает горячие клавиши для текущего экрана
 */

import { Box, Text, TextAttributes } from "@opentui/core";
import type { Store, ScreenId } from "../store.js";

// === Типы ===

interface KeyBinding {
  key: string;
  label: string;
  fg?: string;
}

// === Константы ===

const DEFAULT_KEYS: KeyBinding[] = [
  { key: "F1", label: "Справка" },
  { key: "F3", label: "Поиск" },
  { key: "F5", label: "Обновить" },
  { key: "Esc", label: "Назад" },
];

const CONTEXT_KEYS: Record<ScreenId, KeyBinding[]> = {
  search: [
    { key: "Enter", label: "Выбрать" },
    { key: "Tab", label: "Фильтр" },
  ],
  abonent: [
    { key: "D", label: "Диагностика" },
    { key: "S", label: "Switch", fg: "green" },
    { key: "O", label: "OLT", fg: "yellow" },
    { key: "R", label: "Обновить" },
  ],
  switch: [
    { key: "Enter", label: "Детали" },
    { key: "C", label: "Очистить" },
    { key: "L", label: "Лог" },
  ],
  olt: [
    { key: "Enter", label: "История" },
    { key: "R", label: "Перезагрузить", fg: "red" },
    { key: "E", label: "Экспорт" },
  ],
  help: [{ key: "Enter", label: "Закрыть" }],
};

// === Компонент ===

export function createFooter(store: Store) {
  function render() {
    const state = store.getState();
    const contextKeys = CONTEXT_KEYS[state.currentScreen] || [];
    const allKeys = [...contextKeys, ...DEFAULT_KEYS];

    return Box(
      {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: 1,
      },
      ...allKeys.map((binding, index) =>
        Box(
          { flexDirection: "row", alignItems: "center" },
          Text({
            content: `[${binding.key}]`,
            attributes: TextAttributes.BOLD,
            fg: binding.fg || "cyan",
          }),
          Text({
            content: ` ${binding.label}`,
            attributes: TextAttributes.DIM,
          }),
          index < allKeys.length - 1
            ? Text({ content: "  " })
            : null
        )
      )
    );
  }

  return {
    render,
  };
}
