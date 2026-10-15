/**
 * Экран диагностики Switch
 * Детали порта коммутатора, к которому подключён абонент
 */

import { Show, For, type JSX } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { Store, Equipment } from "../store.js";
import { formatTraffic, getLinkSpeedBg, getLinkSpeedText, getPortStatusBg, getPortStatusText } from "../format.js";

interface SwitchScreenProps {
  store: Store;
}

function selectedSwitch(store: Store): Equipment | null {
  const abonent = store.selectedAbonent();
  if (!abonent) return null;

  const equipment = abonent.equipment[store.selectedEquipmentIndex()];
  if (!equipment || equipment.type !== "switch") return null;

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

export default function SwitchScreen(props: SwitchScreenProps) {
  const store = props.store;
  const equipment = () => selectedSwitch(store);

  useKeyboard((key) => {
    if (store.currentScreen() !== "switch") return false;
    if (store.isHelpVisible()) return false;

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

      <Show when={equipment()} fallback={
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text fg="#888">Выберите коммутатор в карточке абонента</text>
        </box>
      }>
        <box flexDirection="column" flexGrow={1} gap={1}>
          <text fg="#00d9ff" attributes={TextAttributes.BOLD}>{equipment()!.model}</text>

          <Row label="IP">{equipment()!.ip || "—"}</Row>
          <Row label="Расположение">{equipment()!.location || "—"}</Row>
          <Row label="Порт">
            {equipment()!.portName ? `${equipment()!.portName} (${equipment()!.port})` : String(equipment()!.port ?? "—")}
          </Row>

          <box flexDirection="row" gap={2} alignItems="center">
            <text width={12} fg="#888">Статус</text>
            <box backgroundColor={getPortStatusBg(equipment()!.portStatus)} paddingX={1}>
              <text fg="#fff">{getPortStatusText(equipment()!.portStatus)}</text>
            </box>
            <box backgroundColor={getLinkSpeedBg(equipment()!.portSpeed)} paddingX={1}>
              <text fg="#fff">{getLinkSpeedText(equipment()!.portSpeed)}</text>
            </box>
          </box>

          <Show when={equipment()!.inOctets !== undefined || equipment()!.outOctets !== undefined}>
            <Row label="Трафик">
              ↓{formatTraffic(equipment()!.inOctets || 0)} ↑{formatTraffic(equipment()!.outOctets || 0)}
            </Row>
          </Show>

          <Show when={(equipment()!.inErrors || 0) > 0 || (equipment()!.outErrors || 0) > 0}>
            <box flexDirection="row" gap={2}>
              <text width={12} fg="#888">Ошибки</text>
              <text fg="#ff4444">in: {equipment()!.inErrors || 0} / out: {equipment()!.outErrors || 0}</text>
            </box>
          </Show>

          <Show when={store.portPollError()}>
            <text fg="#ff4444">⚠ Опрос портов: {store.portPollError()}</text>
          </Show>

          <box flexDirection="column" marginTop={1}>
            <text fg="#888" attributes={TextAttributes.BOLD}>IP-MAC на устройстве</text>
            <Show when={(equipment()!.ipMacList ?? []).length > 0} fallback={
              <text fg="#666">нет данных</text>
            }>
              <For each={equipment()!.ipMacList}>
                {(entry) => (
                  <box flexDirection="row" gap={2}>
                    <text fg="#00d9ff">{entry.ip}</text>
                    <text fg="#888">→</text>
                    <text>{entry.mac || "—"}</text>
                    <Show when={entry.lastSeen}>
                      <text fg="#666">({entry.lastSeen})</text>
                    </Show>
                  </box>
                )}
              </For>
            </Show>
          </box>
        </box>
      </Show>

      <box marginTop={1}>
        <text fg="#666">ESC - назад | данные обновляются каждые 5 с</text>
      </box>
    </box>
  );
}
