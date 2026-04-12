/**
 * Маршрутизатор экранов TUI
 * Управляет переключением между экранами и их созданием
 */

import type { Store, ScreenId } from "./store.js";

// === Типы экранов ===

export interface ScreenModule {
  render: () => any;
  handleKey?: (key: string) => boolean;
  onEnter?: () => void;
  onExit?: () => void;
}

type ScreenFactory = (store: Store) => ScreenModule;

// === Маршрутизатор ===

export function createRouter(store: Store) {
  // Кэш фабрик экранов (будут установлены позже)
  const screenFactories: Map<ScreenId, ScreenFactory> = new Map();

  // Регистрация фабрики экрана
  function registerScreen(id: ScreenId, factory: ScreenFactory) {
    screenFactories.set(id, factory);
  }

  // Создание экрана
  function createScreen(id: ScreenId): ScreenModule {
    const factory = screenFactories.get(id);
    if (!factory) {
      throw new Error(`Unknown screen: ${id}`);
    }
    return factory(store);
  }

  // Получение текущего экрана
  function getCurrentScreen(): ScreenModule {
    const state = store.getState();
    return createScreen(state.currentScreen);
  }

  // Навигация
  function navigate(screen: ScreenId) {
    store.setScreen(screen);
  }

  function back() {
    store.back();
  }

  return {
    registerScreen,
    createScreen,
    getCurrentScreen,
    navigate,
    back,
  };
}

export type Router = ReturnType<typeof createRouter>;
