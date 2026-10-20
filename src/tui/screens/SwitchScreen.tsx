/**
 * Экран диагностики Switch
 * Детали порта коммутатора, к которому подключён абонент,
 * включая MAC на порту, статус VLAN, DHCP и данные NetBox.
 */

import { Show, For, onCleanup, createEffect, type JSX } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { Store, Equipment } from "../store.js";
import { dhcpClient, netboxClient } from "../client.js";
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
      <text width={14} fg="#888">{props.label}</text>
      <text flexGrow={1}>{props.children}</text>
    </box>
  );
}

function vlanStatusChip(status: "ok" | "wrong" | "unknown" | undefined): JSX.Element {
  if (!status) return <text fg="#888">—</text>;
  switch (status) {
    case "ok":
      return <text fg="#44ff44" attributes={TextAttributes.BOLD}>VLAN OK</text>;
    case "wrong":
      return <text fg="#ff4444" attributes={TextAttributes.BOLD}>VLAN НЕВЕРНЫЙ</text>;
    case "unknown":
      return <text fg="#ffaa00">VLAN ?</text>;
  }
  return <text fg="#888">—</text>;
}

function dhcpStatusChip(dhcp: { success: boolean; hasRequest: boolean; hasOffer: boolean; hasAck: boolean; hasNak: boolean } | undefined): JSX.Element {
  if (!dhcp) return <text fg="#888">—</text>;
  if (dhcp.success) return <text fg="#44ff44" attributes={TextAttributes.BOLD}>DHCP ACK</text>;
  if (dhcp.hasOffer) return <text fg="#ffaa00">DHCP offer</text>;
  if (dhcp.hasRequest) return <text fg="#ffaa00">DHCP запрос</text>;
  if (dhcp.hasNak) return <text fg="#ff4444">DHCP NAK</text>;
  return <text fg="#888">нет DHCP</text>;
}

export default function SwitchScreen(props: SwitchScreenProps) {
  const store = props.store;
  const equipment = () => selectedSwitch(store);

  let diagFetchedForScreen = false;

  useKeyboard((key) => {
    if (store.currentScreen() !== "switch") return false;
    if (store.isHelpVisible()) return false;

    if (key.name === "escape") {
      store.goBack();
      return true;
    }

    return false;
  });

  async function fetchDiagData() {
    const eq = equipment();
    if (!eq) return;
    const idx = store.selectedEquipmentIndex();

    // NetBox — один раз при входе на экран
    if (netboxClient && eq.ip) {
      try {
        const nb = await netboxClient.getPortInfo(eq.ip, eq.port);
        let vlanStatus: "ok" | "wrong" | "unknown" = "unknown";
        if (nb.error) {
          vlanStatus = "unknown";
        } else {
          const untaggedCount = nb.untaggedVlan ? 1 : 0;
          if (untaggedCount === 1) vlanStatus = "ok";
          else if (untaggedCount === 0 || untaggedCount > 1) vlanStatus = "wrong";
        }
        store.updateEquipmentDiagData(idx, {
          netBoxPortInfo: nb.error ? undefined : nb,
          vlanStatus,
        });
        if (nb.error) store.setNetboxError(nb.error);
        else store.setNetboxError(null);
      } catch (err) {
        store.setNetboxError(err instanceof Error ? err.message : "Ошибка NetBox");
      }
    }

    // DHCP — каждый раз при обновлении экрана
    if (dhcpClient) {
      try {
        const mac = eq.ipMacList?.[0]?.mac || "";
        if (mac) {
          const dhcp = await dhcpClient.fetchDhcpLogs(mac);
          const macsOnPort = dhcp.entries
            .map(e => e.mac)
            .filter((m, idx, arr) => m && arr.indexOf(m) === idx);
          store.updateEquipmentDiagData(idx, {
            macsOnPort: macsOnPort.length > 0 ? macsOnPort : undefined,
            dhcpInfo: dhcp,
          });
          store.setDhcpError(null);
        }
      } catch (err) {
        store.setDhcpError(err instanceof Error ? err.message : "Ошибка DHCP");
      }
    }
  }

  createEffect(() => {
    const screen = store.currentScreen();
    if (screen === "switch" && !diagFetchedForScreen) {
      diagFetchedForScreen = true;
      void fetchDiagData();
    } else if (screen !== "switch") {
      diagFetchedForScreen = false;
    }
  });

  onCleanup(() => {
    store.setDhcpError(null);
    store.setNetboxError(null);
  });

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text fg="#fff" attributes={TextAttributes.BOLD}>🔧 Диагностика Switch</text>
      <box height={1} />

      <Show when={equipment()}>
        <box flexDirection="column" flexGrow={1} gap={1}>
          <text fg="#00d9ff" attributes={TextAttributes.BOLD}>{equipment()!.model}</text>

          <Row label="IP">{equipment()!.ip || "—"}</Row>
          <Row label="Расположение">{equipment()!.location || "—"}</Row>
          <Row label="Порт">
            {equipment()!.portName ? `${equipment()!.portName} (${equipment()!.port})` : String(equipment()!.port ?? "—")}
          </Row>

          <Row label="Статус порта">
            <box backgroundColor={getPortStatusBg(equipment()!.portStatus)} paddingX={1}>
              <text fg="#fff">{getPortStatusText(equipment()!.portStatus)}</text>
            </box>
            <box backgroundColor={getLinkSpeedBg(equipment()!.portSpeed)} paddingX={1}>
              <text fg="#fff">{getLinkSpeedText(equipment()!.portSpeed)}</text>
            </box>
          </Row>

          <Row label="VLAN">{vlanStatusChip(equipment()!.vlanStatus)}</Row>

          <Row label="DHCP">{dhcpStatusChip(equipment()!.dhcpInfo)}</Row>

          {/* NetBox детали порта */}
          <Show when={equipment()!.netBoxPortInfo}>
            <box flexDirection="column" marginTop={1} gap={0}>
              <text fg="#00d9ff" attributes={TextAttributes.BOLD} paddingBottom={0}>NetBox порт</text>
              <Row label="Интерфейс">{equipment()!.netBoxPortInfo!.interfaceName}</Row>
              <Show when={equipment()!.netBoxPortInfo!.interfaceType}>
                <Row label="Тип">{equipment()!.netBoxPortInfo!.interfaceType}</Row>
              </Show>
              <Row label="MAC">{equipment()!.netBoxPortInfo!.macAddress || "—"}</Row>
              <Row label="Состояние">
                {equipment()!.netBoxPortInfo!.enabled ? <text fg="#44ff44">enabled</text> : <text fg="#ff4444">disabled</text>}
              </Row>

              {/* VLANы */}
              <Show when={equipment()!.netBoxPortInfo!.untaggedVlan || equipment()!.netBoxPortInfo!.taggedVlans.length > 0}>
                <box flexDirection="column">
                  <Show when={equipment()!.netBoxPortInfo!.untaggedVlan}>
                    <Row label="Untagged VLAN">{`${equipment()!.netBoxPortInfo!.untaggedVlan!.name} (${equipment()!.netBoxPortInfo!.untaggedVlan!.vid})`}</Row>
                  </Show>
                  <Show when={equipment()!.netBoxPortInfo!.taggedVlans.length > 0}>
                    <Row label="Tagged VLANs">
                      {equipment()!.netBoxPortInfo!.taggedVlans.map((v, idx) => (
                        <text fg="#00d9ff">{v.name} ({v.vid}){idx < equipment()!.netBoxPortInfo!.taggedVlans.length - 1 ? ", " : ""}</text>
                      ))}
                    </Row>
                  </Show>
                </box>
              </Show>

              {/* IP адреса на интерфейсе */}
              <Show when={equipment()!.netBoxPortInfo!.ipAddresses.length > 0}>
                <Row label="IP на интерфейсе">
                  {equipment()!.netBoxPortInfo!.ipAddresses.map((a, idx) => (
                    <text fg="#00d9ff">{a.address}{idx < equipment()!.netBoxPortInfo!.ipAddresses.length - 1 ? ", " : ""}</text>
                  ))}
                </Row>
              </Show>

              {/* Подключённое оборудование */}
              <Show when={equipment()!.netBoxPortInfo!.connectedEndpoint}>
                <Row label="Подключено к">
                  {`${equipment()!.netBoxPortInfo!.connectedEndpoint!.device} / ${equipment()!.netBoxPortInfo!.connectedEndpoint!.interface}`}
                </Row>
              </Show>
            </box>
          </Show>

          {/* MAC адреса на порту (из DHCP логов) */}
          <Show when={equipment()?.macsOnPort?.length}>
            <box flexDirection="column" marginTop={1}>
              <text fg="#00d9ff" attributes={TextAttributes.BOLD} paddingBottom={0}>MAC на порту (DHCP)</text>
              <For each={equipment()!.macsOnPort}>
                {(mac) => (
                  <box flexDirection="row" gap={2}>
                    <text fg="#00d9ff">{mac}</text>
                  </box>
                )}
              </For>
            </box>
          </Show>

          {/* DHCP детали */}
          <Show when={equipment()?.dhcpInfo?.entries.length}>
            <box flexDirection="column" marginTop={1}>
              <text fg="#00d9ff" attributes={TextAttributes.BOLD} paddingBottom={0}>DHCP лог</text>
              <Row label="Запрос">{equipment()!.dhcpInfo!.hasRequest ? <text fg="#44ff44">есть</text> : <text fg="#888">нет</text>}</Row>
              <Row label="Offers">{equipment()!.dhcpInfo!.hasOffer ? <text fg="#44ff44">есть</text> : <text fg="#888">нет</text>}</Row>
              <Row label="ACK (успех)">{equipment()!.dhcpInfo!.hasAck ? <text fg="#44ff44">есть</text> : <text fg="#ff4444">нет</text>}</Row>
              <Show when={equipment()!.dhcpInfo!.lastAcquireTime}>
                <Row label="Последний ACK">{equipment()!.dhcpInfo!.lastAcquireTime}</Row>
              </Show>
              <text fg="#888" attributes={TextAttributes.BOLD} paddingTop={1}>Записи:</text>
              <For each={equipment()!.dhcpInfo!.entries.slice(0, 10)}>
                {(entry) => (
                  <box flexDirection="row" gap={2}>
                    <text fg={entry.type === "ack" ? "#44ff44" : entry.type === "nak" ? "#ff4444" : "#888"}>
                      {entry.type.toUpperCase()}
                    </text>
                    <text fg="#888">{entry.timestamp}</text>
                    <Show when={entry.ip}>
                      <text fg="#00d9ff">{entry.ip}</text>
                    </Show>
                    <text fg="#aaa">{entry.mac}</text>
                  </box>
                )}
              </For>
            </box>
          </Show>

          <Show when={equipment()!.inOctets !== undefined || equipment()!.outOctets !== undefined}>
            <Row label="Трафик">
              <text>↓{formatTraffic(equipment()!.inOctets || 0)} ↑{formatTraffic(equipment()!.outOctets || 0)}</text>
            </Row>
          </Show>

          <Show when={(equipment()!.inErrors || 0) > 0 || (equipment()!.outErrors || 0) > 0}>
            <box flexDirection="row" gap={2}>
              <text width={14} fg="#888">Ошибки</text>
              <text fg="#ff4444">in: {equipment()!.inErrors || 0} / out: {equipment()!.outErrors || 0}</text>
            </box>
          </Show>

          <Show when={store.portPollError()}>
            <text fg="#ff4444">⚠ Опрос портов: {store.portPollError()}</text>
          </Show>

          <Show when={store.dhcpError()}>
            <text fg="#ff4444">⚠ DHCP: {store.dhcpError()}</text>
          </Show>

          <Show when={store.netboxError()}>
            <text fg="#ff4444">⚠ NetBox: {store.netboxError()}</text>
          </Show>

          <box flexDirection="column" marginTop={1}>
            <text fg="#888" attributes={TextAttributes.BOLD}>IP-MAC на устройстве</text>
            <Show when={(equipment()!.ipMacList ?? []).length > 0}>
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
            <Show when={(equipment()!.ipMacList ?? []).length === 0}>
              <text fg="#666">нет данных</text>
            </Show>
          </box>
        </box>
      </Show>
      <Show when={!equipment()}>
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <text fg="#888">Выберите коммутатор в карточке абонента</text>
        </box>
      </Show>

      <box marginTop={1}>
        <text fg="#666">ESC - назад</text>
      </box>
    </box>
  );
}
