/**
 * Экран диагностики OLT
 * Отображает информацию об ONU
 */

import { createSignal, Show, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { Store } from "../store.js";

interface OLTScreenProps {
  store: Store;
}

export default function OLTScreen(props: OLTScreenProps) {
  const store = props.store;

  useKeyboard((key) => {
    if (store.currentScreen() !== "olt") return false;

    if (key.name === "escape") {
      store.goBack();
      return true;
    }

    return false;
  });

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text fg="#fff" attributes={TextAttributes.BOLD}>📡 Диагностика OLT/ONU</text>
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
