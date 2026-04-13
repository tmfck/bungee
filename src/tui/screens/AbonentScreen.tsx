/**
 * Экран карточки абонента
 * Отображает детальную информацию об абоненте
 */

import { Show, For, createSignal } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import type { Store, Equipment, IpMacEntry } from "../store.js";

interface AbonentScreenProps {
  store: Store;
}

export default function AbonentScreen(props: AbonentScreenProps) {
  const store = props.store;
  const abonent = () => store.selectedAbonent();
  const [selectedEquipment, setSelectedEquipment] = createSignal(0);

  useKeyboard((key) => {
    if (store.currentScreen() !== "abonent") return false;

    switch (key.name) {
      case "escape":
        store.goBack();
        return true;
      case "up":
        if (abonent() && selectedEquipment() > 0) {
          setSelectedEquipment(prev => prev - 1);
        }
        return true;
      case "down":
        if (abonent() && selectedEquipment() < abonent()!.equipment.length - 1) {
          setSelectedEquipment(prev => prev + 1);
        }
        return true;
      case "return":
      case "enter":
        const eq = abonent()?.equipment[selectedEquipment()];
        if (eq) {
          if (eq.type === "switch") {
            store.navigateTo("switch");
          } else if (eq.type === "onu") {
            store.navigateTo("olt");
          }
        }
        return true;
    }

    return false;
  });

  // Форматирование трафика в читаемые единицы
  function formatTraffic(octets: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = octets;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    if (unitIndex === 0) {
      return `${value} ${units[unitIndex]}`;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  // Фон для статуса порта (up/down)
  function getPortStatusBg(status: "up" | "down" | undefined): string {
    if (status === "down") return "#440000";
    if (status === "up") return "#004400";
    return "#222";
  }

  // Текст для статуса порта
  function getPortStatusText(status: "up" | "down" | undefined): string {
    if (status === "down") return "down";
    if (status === "up") return "up";
    return "—";
  }

  // Фон для скорости линка
  function getLinkSpeedBg(speed: number | undefined): string {
    if (!speed) return "#222";
    if (speed === 10) return "#442200";
    if (speed === 100) return "#006600";
    if (speed >= 1000) return "#008800";
    return "#222";
  }

  // Текст для скорости линка
  function getLinkSpeedText(speed: number | undefined): string {
    if (!speed) return "—";
    if (speed >= 1000) return `${speed / 1000}G`;
    return `${speed}M`;
  }

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
            <Show when={eq.ip}>
              <text fg="#00d9ff">{eq.ip}</text>
            </Show>
            <Show when={eq.oltAddress}>
              <text fg="#888">{eq.oltAddress}:{eq.oltPort}</text>
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

  const allIpMacEntries = getAllIpMacEntries();

  return (
    <Show when={abonent()} fallback={
      <box flexDirection="column" flexGrow={1} padding={1} alignItems="center" justifyContent="center">
        <text fg="#888">Нет данных об абоненте</text>
      </box>
    }>
      <box flexDirection="column" flexGrow={1} padding={1}>
        {/* Верхняя часть: ФИО слева, статус/тариф/баланс справа */}
        <box flexDirection="row" justifyContent="space-between">
          {/* Левая колонка: ФИО и адрес */}
          <box flexDirection="column">
            <text fg="#fff" attributes={TextAttributes.BOLD}>
              {abonent()!.fullName}
            </text>
            <text fg="#888">📍 {abonent()!.address.full}</text>
            <text>📞 {abonent()!.phone || "-"}</text>
          </box>

          {/* Правая колонка: Статус, Тариф, Баланс */}
          <box flexDirection="column" alignItems="flex-end">
            <text
              fg={abonent()!.status === "active" ? "#44ff44" : "#ff4444"}
              attributes={TextAttributes.BOLD}
            >
              {abonent()!.status === "active" ? "● Активен" : 
               abonent()!.status === "blocked" ? "○ Заблокирован" :
               abonent()!.status === "suspended" ? "◐ Приостановлен" : "○ Отключён"}
            </text>
            <text fg="#888">{abonent()!.tariff}</text>
            <text
              fg={abonent()!.balance >= 0 ? "#44ff44" : "#ff4444"}
              attributes={TextAttributes.BOLD}
            >
              {abonent()!.balance.toFixed(2)} ₽
            </text>
          </box>
        </box>

        {/* Таблица IP-MAC */}
        <Show when={allIpMacEntries.length > 0}>
          <box flexDirection="column" marginTop={1}>
            <For each={allIpMacEntries}>
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
        <box flexDirection="column" flexGrow={1} marginTop={1}>
          <text fg="#fff" attributes={TextAttributes.BOLD}>Оборудование ({abonent()!.equipment.length})</text>
          <text fg="#666">↑/↓ выбор | Enter диагностика</text>

          <For each={abonent()!.equipment}>
            {(eq, index) => renderEquipment(eq, index())}
          </For>
        </box>
      </box>
    </Show>
  );
}
