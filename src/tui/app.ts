/**
 * Корневой компонент приложения
 * Управляет рендерингом экранов и глобальными обработчиками
 */

import { Box, Text, TextAttributes } from "@opentui/core";
import type { CliRenderer } from "@opentui/core";
import { createStore, type Store, type ScreenId } from "./store.js";
import { createRouter, type Router } from "./router.js";
import { createHeader } from "./components/header.component.js";
import { createFooter } from "./components/footer.component.js";
import { createHelpModal } from "./components/modal.component.js";
import { useKeyboard } from "./hooks/useKeyboard.js";

// Импорт экранов
import { createSearchScreen } from "./screens/search.screen.js";
import { createAbonentScreen } from "./screens/abonent.screen.js";
import { createSwitchScreen } from "./screens/switch.screen.js";
import { createOLTScreen } from "./screens/olt.screen.js";

// === Типы ===

interface ScreenModule {
  render: () => any;
  handleKey?: (key: string) => boolean;
  onEnter?: () => void;
  onExit?: () => void;
}

// === Создание приложения ===

export function createApp(renderer: CliRenderer) {
// Инициализация Store и Router
const store = createStore();
const router = createRouter(store);

// Сохраняем ссылку на renderer для корректного выхода
const rendererRef = renderer;

  // Регистрация экранов
  router.registerScreen("search", (s) => createSearchScreen(s));
  router.registerScreen("abonent", (s) => createAbonentScreen(s));
  router.registerScreen("switch", (s) => createSwitchScreen(s));
  router.registerScreen("olt", (s) => createOLTScreen(s));

  // Компоненты
  const header = createHeader(store);
  const footer = createFooter(store);
  const helpModal = createHelpModal(() => store.hideHelp());

  // Текущий активный экран
  let currentScreen: ScreenModule | null = null;
  let previousScreenId: ScreenId | null = null;

  // Глобальные горячие клавиши
  const keyboard = useKeyboard(renderer, {
    onF1: () => {
      store.toggleHelp();
    },
    onF3: () => {
      store.setScreen("search");
    },
    onF5: () => {
      store.refresh();
    },
    onF10: () => {
      process.exit(0);
    },
    onF12: () => {
      renderer.console.toggle();
    },
  onEscape: () => {
    const state = store.getState();
    if (state.isHelpVisible) {
      store.hideHelp();
    } else if (state.currentScreen === "search") {
      rendererRef.destroy();
    } else {
      store.back();
    }
  },
    onKey: (key: string) => {
      // Передача клавиши текущему экрану
      if (currentScreen?.handleKey) {
        const handled = currentScreen.handleKey(key);
        if (handled) return;
      }

      // Глобальные клавиши
      // switch (key.toLowerCase()) {
      //   case "q":
      //     process.exit(0);
      //     break;
      // }
    },
  });

  // Подписка на изменения состояния
  store.subscribe((state) => {
    // Обработка смены экрана
    if (state.currentScreen !== previousScreenId) {
      if (currentScreen?.onExit) {
        currentScreen.onExit();
      }
      previousScreenId = state.currentScreen;
    }
  });

  // Рендер приложения
  function render() {
    const state = store.getState();

    // Получение текущего экрана
    if (state.currentScreen !== previousScreenId || !currentScreen) {
      currentScreen = router.getCurrentScreen() as ScreenModule;
      if (currentScreen?.onEnter) {
        currentScreen.onEnter();
      }
    }

    return Box(
      {
        flexDirection: "column",
        width: "100%",
        height: "100%",
      },
      // Header
      header.render(),

      // Основной контент
      Box(
        {
          flexDirection: "column",
          flexGrow: 1,
        },
        currentScreen?.render() || Text({ content: "Загрузка..." })
      ),

      // Footer
      footer.render(),

      // Модальное окно справки
      state.isHelpVisible ? helpModal.render() : null
    );
  }

  return {
    render,
    store,
    router,
    dispose: () => {
      keyboard.dispose();
      if (currentScreen?.onExit) {
        currentScreen.onExit();
      }
    },
  };
}

export type App = ReturnType<typeof createApp>;
