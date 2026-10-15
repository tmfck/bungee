/**
 * Экран диагностики OLT/ONU
 * Показывает данные ONU из карточки абонента; живой статус и сигнал —
 * через telnet-сканер (bun run olt-scan)
 */

import { Show, For, type JSX } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { Store, Equipment } from "../store.js";

interface OLTScreenProps {
  store: Store;
}

function selectedOnu(store: Store): Equipment | null {
  const abonent = store.selectedAbonent();
  if (!abonent) return null;

  const equipment = abonent.equipment[store.selectedEquipmentIndex()];
  if (!equipment || equipment.type !== "onu") return null;

  return equipment;
}

function Row(props: { label: string; children: JSX.Element }) {
  return (
    <box flexDirection="row" gap={2}>
      <text width={12} fg="#888">{props.label}</text>
      <text flexGrow={1}>{props.children}</text>
    </box>
  );
}

export default function OLTScreen(props: OLTScreenProps) {
  const store = props.store;
  const equipment = () => selectedOnu(store);

  useKeyboard((key) => {
    if (store.currentScreen() !== "olt") return false;
    if (store.isHelpVisible()) return false;

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

      <Show when={equipment()} fallback={
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text fg="#888">Выберите ONU в карточке абонента</text>
        </box>
      }>
        <box flexDirection="column" flexGrow={1} gap={1}>
          <text fg="#00d9ff" attributes={TextAttributes.BOLD}>{equipment()!.model}</text>

          <Row label="Устройство">{equipment()!.location || "—"}</Row>
          <Row label="MAC ONU">{equipment()!.onuMac || "—"}</Row>
          <Row label="OLT">{equipment()!.oltAddress ? `${equipment()!.oltAddress}:${equipment()!.oltPort ?? "?"}` : "—"}</Row>
          <Row label="Порт">{String(equipment()!.oltPort ?? "—")}</Row>

          <Show when={(equipment()!.ipMacList ?? []).length > 0}>
            <box flexDirection="column" marginTop={1}>
              <text fg="#888" attributes={TextAttributes.BOLD}>IP-MAC абонента</text>
              <For each={equipment()!.ipMacList}>
                {(entry) => (
                  <box flexDirection="row" gap={2}>
                    <text fg="#00d9ff">{entry.ip}</text>
                    <text fg="#888">→</text>
                    <text>{entry.mac || "—"}</text>
                  </box>
                )}
              </For>
            </box>
          </Show>

          <box flexDirection="column" marginTop={1}>
            <text fg="#666">
              Статус ONU и уровень сигнала снимаются telnet-сканером: bun run olt-scan
            </text>
          </box>
        </box>
      </Show>

      <box marginTop={1}>
        <text fg="#666">ESC - назад</text>
      </box>
    </box>
  );
}
