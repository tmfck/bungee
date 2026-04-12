/**
 * Компонент заголовка приложения
 * Отображает название, версию и текущий экран
 */

import { Box, Text, TextAttributes } from "@opentui/core";
import type { Store, ScreenId } from "../store.js";

// === Константы ===

const APP_NAME = "Bungee";
const APP_VERSION = "v1.0.0";

const SCREEN_TITLES: Record<ScreenId, string> = {
  search: "Поиск абонента",
  abonent: "Карточка абонента",
  switch: "Диагностика Switch",
  olt: "Диагностика OLT",
  help: "Справка",
};

// === Компонент ===

export function createHeader(store: Store) {
  function render() {
    const state = store.getState();
    const screenTitle = SCREEN_TITLES[state.currentScreen] || state.currentScreen;

    return Box(
      {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        height: 1,
      },
      // Левая часть: Название и версия
      Box(
        { flexDirection: "row", alignItems: "center" },
        Text({
          content: APP_NAME,
          attributes: TextAttributes.BOLD,
          fg: "cyan",
        }),
        Text({
          content: ` ${APP_VERSION}`,
          attributes: TextAttributes.DIM,
        })
      ),

      // Центр: Текущий экран
      Text({
        content: screenTitle,
        attributes: TextAttributes.BOLD,
      }),

      // Правая часть: Статус
      state.statusMessage
        ? Text({
            content: state.statusMessage,
            fg: "yellow",
          })
        : Text({
            content: "",
          })
    );
  }

  return {
    render,
  };
}
