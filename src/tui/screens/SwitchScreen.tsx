/**
 * Экран диагностики Switch
 * Отображает информацию о портах switch
 */

import { createSignal, Show, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { Store } from "../store.js";

interface SwitchScreenProps {
  store: Store;
}

export default function SwitchScreen(props: SwitchScreenProps) {
  const store = props.store;

  useKeyboard((key) => {
    if (store.currentScreen() !== "switch") return false;

    if (key.name === "escape") {
      store.goBack();
      return true;
    }

    return false;
  });

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text fg="#fff" attributes={TextAttributes.BOLD}>🔧 Диагностика Switch</text>
      <box height={1} />

      <box flexGrow={1} alignItems="center" justifyContent="center">
        <text fg="#888">Функционал в разработке...</text>
      </box>

      <box marginTop={1}>
        <text fg="#666">ESC - назад</text>
      </box>
    </box>
  );
}
