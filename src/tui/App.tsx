/**
* Главный компонент приложения
* Управляет рендерингом экранов и глобальными обработчиками
*/

import { Show, createMemo } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { CliRenderer } from "@opentui/core";
import { TextAttributes } from "@opentui/core";
import { createStore } from "./store.js";
import SearchScreen from "./screens/SearchScreen.tsx";
import AbonentScreen from "./screens/AbonentScreen.tsx";
import SwitchScreen from "./screens/SwitchScreen.tsx";
import OLTScreen from "./screens/OLTScreen.tsx";
import HelpModal from "./components/HelpModal.tsx";

interface AppProps {
  renderer: CliRenderer;
}

export default function App(props: AppProps) {
  const store = createStore();

  // Заголовок экрана
  const screenTitle = createMemo(() => {
    const screen = store.currentScreen();
    const abonent = store.selectedAbonent();
    switch (screen) {
      case "search":
        return "Поиск абонента";
      case "abonent":
        return abonent ? `Абонент #${abonent.account}` : "Абонент";
      case "switch":
        return "Диагностика Switch";
      case "olt":
        return "Диагностика OLT";
      default:
        return "Bungee CLI";
    }
  });

  // Текущий screen
  const getScreenComponent = () => {
    const screen = store.currentScreen();
    switch (screen) {
      case "search":
        return <SearchScreen store={store} />;
      case "abonent":
        return <AbonentScreen store={store} />;
      case "switch":
        return <SwitchScreen store={store} />;
      case "olt":
        return <OLTScreen store={store} />;
      default:
        return <SearchScreen store={store} />;
    }
  };

  // Глобальные горячие клавиши
  useKeyboard((key) => {
    // Пока открыта справка, фон не реагирует на клавиши
    if (store.isHelpVisible() && key.name !== "escape" && key.name !== "f1") {
      return;
    }

    // F1 - Справка
    if (key.name === "f1") {
      store.toggleHelp();
      return;
    }

    // F3 - Поиск
    if (key.name === "f3") {
      store.navigateTo("search");
      return;
    }

    // F10 - Выход
    if (key.name === "f10") {
      process.exit(0);
      return;
    }

    // F12 - Консоль
    if (key.name === "f12") {
      props.renderer.console.toggle();
      return;
    }

    // Escape - назад или выход
    if (key.name === "escape") {
      if (store.isHelpVisible()) {
        store.hideHelp();
      } else if (store.currentScreen() === "search") {
        props.renderer.destroy();
      } else {
        store.goBack();
      }
      return;
    }
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
    >
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
        backgroundColor="#000"
      >
        <text fg="#00d9ff" attributes={TextAttributes.BOLD}>{screenTitle()}</text>
        <box flexDirection="row" gap={2}>
          <text fg="#888" onMouseDown={() => { if (!store.isHelpVisible()) store.toggleHelp(); }}>F1 - Справка</text>
          <text fg="#888" onMouseDown={() => { if (!store.isHelpVisible()) store.navigateTo("search"); }}>F3 - Поиск</text>
          <text fg="#888" onMouseDown={() => { if (!store.isHelpVisible()) process.exit(0); }}>F10 - Выход</text>
        </box>
      </box>

      {/* Основной контент */}
      <box flexDirection="column" flexGrow={1}>
        {getScreenComponent()}
      </box>

      {/* Footer */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
        backgroundColor="#000"
      >
        <box flexDirection="row" gap={2}>
          <Show when={store.screenHistory().length > 0}>
            <text
              fg="#888"
              onMouseDown={() => { if (!store.isHelpVisible()) store.goBack(); }}
            >
              ← Назад
            </text>
          </Show>
        </box>
      </box>

      {/* Модальное окно справки */}
      <Show when={store.isHelpVisible()}>
        <HelpModal onClose={() => store.hideHelp()} />
      </Show>
    </box>
  );
}
