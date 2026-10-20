/**
* Экран карточки абонента
* Отображает детальную информацию об абоненте
*/

import { Show, For, onCleanup, createEffect } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { Store, Equipment, IpMacEntry } from "../store.js";
import { usersideClient } from "../client.js";
import { formatTraffic, getPortStatusBg, getPortStatusText, getLinkSpeedBg, getLinkSpeedText } from "../format.js";

const PORT_POLL_INTERVAL = 5000;

interface AbonentScreenProps {
  store: Store;
}

function isWithinLastHour(timeStr: string): boolean {
	if (!timeStr || timeStr === '-' || timeStr === '—') return false;
	const date = new Date(timeStr.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
	if (isNaN(date.getTime())) return false;
	const now = new Date();
	const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
	return date >= hourAgo;
}

export default function AbonentScreen(props: AbonentScreenProps) {
	const store = props.store;
	const abonent = () => store.selectedAbonent();
	const selectedEquipment = () => store.selectedEquipmentIndex();
	let pollIntervalId: ReturnType<typeof setInterval> | null = null;
	let isPolling = false;
	let isActive = false;

	function startPolling() {
		if (pollIntervalId) {
			clearInterval(pollIntervalId);
		}
		pollPortStatus();
		pollIntervalId = setInterval(pollPortStatus, PORT_POLL_INTERVAL);
	}

	function stopPolling() {
		if (pollIntervalId) {
			clearInterval(pollIntervalId);
			pollIntervalId = null;
		}
	}

	useKeyboard((key) => {
		if (store.currentScreen() !== "abonent") return false;
		if (store.isHelpVisible()) return false;

		switch (key.name) {
			case "up":
				if (abonent() && selectedEquipment() > 0) {
					store.setSelectedEquipmentIndex(prev => prev - 1);
				}
				return true;
			case "down":
				if (abonent() && selectedEquipment() < abonent()!.equipment.length - 1) {
					store.setSelectedEquipmentIndex(prev => prev + 1);
				}
				return true;
			case "return":
			case "enter": {
				const eq = abonent()?.equipment[selectedEquipment()];
				if (eq) {
					if (eq.type === "switch") {
						stopPolling();
						store.navigateTo("switch");
					} else if (eq.type === "onu") {
						stopPolling();
						store.navigateTo("olt");
					}
				}
				return true;
			}
		}

		return false;
	});

	async function pollPortStatus() {
		if (isPolling) return;

		const currentAbonent = abonent();
		if (!currentAbonent) return;

		isPolling = true;

		try {
			const referer = `?core_section=customer&action=show&id=${currentAbonent.id}`;

			for (let i = 0; i < currentAbonent.equipment.length; i++) {
				const eq = currentAbonent.equipment[i]!;
				if (eq.type === "switch" && eq.deviceId && eq.port) {
					try {
						const data = await usersideClient.getIfaceData(eq.deviceId, referer);
						const portData = data.data.find(p => p.ifNumber === eq.port);
						if (portData) {
							store.updateEquipmentPortData(i, {
								portStatus: portData.ifOperStatus === 1 ? "up" : "down",
								portSpeed: portData.ifHighSpeed ?? (portData.ifSpeed > 0 ? Math.round(portData.ifSpeed / 1_000_000) : undefined),
								inOctets: portData.ifHCInOctets,
								outOctets: portData.ifHCOutOctets,
								inErrors: portData.ifInErrors,
								outErrors: portData.ifOutErrors,
							});
						}
					} catch (err) {
						store.setPortPollError(err instanceof Error ? err.message : "Ошибка опроса портов");
						console.error(`[PortPoll] Error polling device ${eq.deviceId}:`, err);
					}
				}
			}

			store.setPortPollError(null);
		} finally {
			isPolling = false;
		}
	}

	createEffect(() => {
		const screen = store.currentScreen();
		const hasAbonent = !!abonent();

		if (screen === "abonent" && hasAbonent && !isActive) {
			isActive = true;
			startPolling();
		} else if (screen !== "abonent" && isActive) {
			isActive = false;
			stopPolling();
		}
	});

	onCleanup(() => {
		stopPolling();
		isPolling = false;
		isActive = false;
		store.setPortPollError(null);
	});

  // Рендер оборудования
  function renderEquipment(eq: Equipment, index: number) {
    const isSelected = selectedEquipment() === index;
    
    return (
      <box
        flexDirection="row"
        backgroundColor={isSelected ? "#1a3a5a" : (index % 2 === 0 ? "#1a1a2e" : undefined)}
        border={isSelected}
        borderColor={isSelected ? "#00d9ff" : undefined}
      >
        {/* Левая часть: тип и модель */}
        <box flexDirection="row" gap={1} paddingX={1} flexGrow={1}>
          <text fg="#ffd700">
            {eq.type === "switch" ? "🔧" : eq.type === "onu" ? "📡" : "📦"}
          </text>
          <text>{eq.model}</text>
          
          {/* Заметка для порта */}
          <Show when={eq.portNote}>
            <text fg="#888">({eq.portNote})</text>
          </Show>
          
          {/* Switch информация */}
          <Show when={eq.type === "switch"}>
            <text fg="#00d9ff">{eq.ip}</text>
            
            {/* Трафик */}
            <Show when={eq.inOctets !== undefined}>
              <text fg="#888">↓{formatTraffic(eq.inOctets || 0)}</text>
              <text fg="#888">↑{formatTraffic(eq.outOctets || 0)}</text>
            </Show>
            
            {/* Ошибки */}
            <Show when={(eq.inErrors || 0) > 0 || (eq.outErrors || 0) > 0}>
              <text fg="#ff4444">E:{eq.inErrors || 0}/{eq.outErrors || 0}</text>
            </Show>
          </Show>

      {/* ONU информация */}
      <Show when={eq.type === "onu"}>
        <Show when={eq.onuMac}>
          <text fg="#aaa">{eq.onuMac}</text>
        </Show>
        <Show when={eq.oltAddress}>
          <text fg="#ff8800">{eq.oltAddress}:{eq.oltPort}</text>
        </Show>
      </Show>
        </box>

        {/* Блок порта со статусом (только для switch) */}
        <Show when={eq.type === "switch"}>
          <box flexDirection="row">
            {/* Номер порта */}
            <box
              backgroundColor="#333"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingX={1}
            >
              <text fg="#fff" attributes={TextAttributes.BOLD}>{eq.port}</text>
            </box>
            
            {/* Статус порта (up/down) */}
            <box
              backgroundColor={getPortStatusBg(eq.portStatus)}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingX={1}
            >
              <text fg="#fff">{getPortStatusText(eq.portStatus)}</text>
            </box>
            
            {/* Скорость линка */}
            <box
              backgroundColor={getLinkSpeedBg(eq.portSpeed)}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingX={1}
            >
              <text fg="#fff">{getLinkSpeedText(eq.portSpeed)}</text>
            </box>
          </box>
        </Show>
      </box>
  );
}

// Собираем все IP-MAC записи со всего оборудования
  function getAllIpMacEntries(): IpMacEntry[] {
    const entries: IpMacEntry[] = [];
    if (!abonent()) return entries;
    
    for (const eq of abonent()!.equipment) {
      if (eq.ipMacList) {
        for (const entry of eq.ipMacList) {
          // Избегаем дубликатов
          if (!entries.find(e => e.ip === entry.ip)) {
            entries.push(entry);
          }
        }
      }
    }
  return entries;
 }

  const allIpMacEntries = () => getAllIpMacEntries();

  const hasActivity = () => {
    const activity = abonent()?.activity;
    return Boolean(activity && (activity.network || activity.internet));
  };

  return (
    <Show when={!store.abonentLoading()} fallback={
      <box flexDirection="column" flexGrow={1} padding={1} alignItems="center" justifyContent="center">
        <text fg="#00d9ff">⏳ Загрузка данных абонента...</text>
      </box>
    }>
      <Show when={abonent()} fallback={
        <box flexDirection="column" flexGrow={1} padding={1} alignItems="center" justifyContent="center">
          <text fg="#888">Нет данных об абоненте</text>
        </box>
      }>
        <scrollbox flexDirection="column" padding={1}>
          {/* Верхняя часть: ФИО слева, статус/тариф/баланс справа */}
          <box flexDirection="row" flexGrow={0} flexShrink={0}>
            <box flexDirection="column" flexGrow={1} flexShrink={1}>
              <text fg="#fff" attributes={TextAttributes.BOLD}>
                {abonent()!.fullName}{abonent()!.contract ? ` (${abonent()!.contract})` : ""}
              </text>
              <text fg="#888">📍 {abonent()!.address.full}</text>
              <text>📞 {abonent()!.phone || "-"}</text>
            </box>

            {/* Правая колонка: Статус, Тарифы, Баланс */}
            <box flexDirection="column" alignItems="flex-end" flexShrink={0}>
              <text
                fg={abonent()!.status.toLowerCase().includes('активен') || abonent()!.status.toLowerCase().includes('актив') ? "#44ff44" : "#ff4444"}
                attributes={TextAttributes.BOLD}
              >
                {abonent()!.status}
              </text>
              <For each={abonent()!.tariffs}>
                {(tariff) => (
                  <text fg="#888">{tariff.name} ({tariff.price} ₽)</text>
                )}
              </For>
              <text
                fg={abonent()!.balance >= 0 ? "#44ff44" : "#ff4444"}
                attributes={TextAttributes.BOLD}
              >
                {abonent()!.balance.toFixed(2)} ₽
              </text>
            </box>
          </box>

      {/* Activity */}
      <Show when={hasActivity()}>
        <box flexDirection="row" marginTop={1} gap={2}>
          <text fg="#888">Сеть:</text>
          <text fg={isWithinLastHour(abonent()!.activity?.network || '') ? "#44ff44" : "#ff4444"}>
            {abonent()!.activity?.network || "—"}
          </text>
          <text fg="#888">|</text>
          <text fg="#888">Интернет:</text>
          <text fg={isWithinLastHour(abonent()!.activity?.internet || '') ? "#44ff44" : "#ff4444"}>
            {abonent()!.activity?.internet || "—"}
          </text>
        </box>
      </Show>

      {/* Заметки */}
      <Show when={abonent()!.notes}>
        <box flexDirection="column" marginTop={1}>
          <text fg="#888" attributes={TextAttributes.BOLD}>Заметки:</text>
          <box flexDirection="column" paddingLeft={1}>
            <For each={abonent()!.notes!.split('\n').filter((l: string) => l.trim())}>
              {(line: string) => (
                <text fg="#aaa">{line.trim()}</text>
              )}
            </For>
          </box>
        </box>
      </Show>

          {/* Таблица IP-MAC */}
          <Show when={allIpMacEntries().length > 0}>
            <box flexDirection="column" marginTop={1}>
              <For each={allIpMacEntries()}>
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

          {/* Оборудование */}
          <box flexDirection="column" marginTop={1}>
            <box flexDirection="row" justifyContent="space-between">
              <text fg="#fff" attributes={TextAttributes.BOLD}>Оборудование ({abonent()!.equipment.length})</text>
              <text fg="#666">↑/↓ выбор | Enter диагностика</text>
            </box>

            <Show when={store.portPollError()}>
              <text fg="#ff4444">⚠ Опрос портов: {store.portPollError()}</text>
            </Show>

            <For each={abonent()!.equipment}>
              {(eq, index) => renderEquipment(eq, index())}
            </For>
          </box>
        </scrollbox>
      </Show>
    </Show>
  );
}
