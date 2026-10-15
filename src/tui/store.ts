/**
 * Центральное хранилище состояния TUI
 * Управляет всеми данными приложения и навигацией
 * Использует Solid.js signals для реактивности
 */

import { createSignal, createRoot } from "solid-js";
import type { IpMacEntry, TariffEntry } from "./userside.js";

export type { IpMacEntry, TariffEntry };

// === Типы ===

export type ScreenId = "search" | "abonent" | "switch" | "olt";

export interface Abonent {
  id: string;
  account: string;
  fullName: string;
  address: Address;
  phone?: string;
  ip?: string;
  tariff: string;
  status: string;
  contract?: string;
  balance: number;
  activity?: {
    network: string;
    internet: string;
  };
}

export interface Address {
  city: string;
  street: string;
  house: string;
  apartment?: string;
  full: string;
}

export interface ConnectionPoint {
  deviceId: string;
  deviceModel: string;
  deviceLocation: string;
  ip: string;
  port: number;
  portName?: string;
  portDescription?: string;
}

export interface AbonentDetails extends Abonent {
  equipment: Equipment[];
  login?: string;
  contract?: string;
  credit?: number;
  lastPlusDate?: string;
  connectionDate?: string;
  connectionTechnology?: string;
  isLegalEntity?: boolean;
  notes?: string;
  manager?: string;
  email?: string;
  landlinePhone?: string;
  tariffs: TariffEntry[];
  additionalServices: string[];
  connectionPoints: ConnectionPoint[];
}

export interface Equipment {
  type: EquipmentType;
  model: string;
  mac: string;
  ip?: string;
  port?: number;
  location?: string;
  // Дополнительные поля для ONU
  oltAddress?: string;
  oltPort?: string;
  onuMac?: string;
  // Список IP-MAC соответствий
  ipMacList?: IpMacEntry[];
  // Состояние порта (для switch)
  portAdmin?: "on" | "off";
  portSpeed?: number;
  portStatus?: "up" | "down";
  // Заметка для порта
  portNote?: string;
  // Описание порта
  portDescription?: string;
  // Имя порта (например 1/4)
  portName?: string;
  // Счётчики трафика
  inOctets?: number;
  outOctets?: number;
  inErrors?: number;
  outErrors?: number;
  // Device ID для опроса состояния портов
  deviceId?: string;
}

export type EquipmentType = "switch" | "olt" | "onu" | "router";

// === Store ===

export function createStore() {
  return createRoot(() => {
    // === Состояние навигации ===
    const [currentScreen, setCurrentScreen] = createSignal<ScreenId>("search");
    const [screenHistory, setScreenHistory] = createSignal<ScreenId[]>([]);

    // === Состояние поиска ===
    const [searchInputValue, setSearchInputValue] = createSignal("");
    const [searchResults, setSearchResults] = createSignal<Abonent[]>([]);
    const [searchLoading, setSearchLoading] = createSignal(false);
    const [searchError, setSearchError] = createSignal<string | null>(null);

    // === Состояние абонента ===
    const [selectedAbonent, setSelectedAbonent] = createSignal<AbonentDetails | null>(null);
    const [abonentLoading, setAbonentLoading] = createSignal(false);
    const [portPollError, setPortPollError] = createSignal<string | null>(null);

    // === UI состояние ===
    const [isHelpVisible, setIsHelpVisible] = createSignal(false);

    // === Методы навигации ===
    function navigateTo(screen: ScreenId) {
      if (currentScreen() === screen) return;
      setScreenHistory((prev) => [...prev, currentScreen()]);
      setCurrentScreen(screen);
    }

    function goBack() {
      const history = screenHistory();
      if (history.length === 0) {
        setCurrentScreen("search");
        return;
      }
      const previous = history[history.length - 1]!;
      setScreenHistory(history.slice(0, -1));
      setCurrentScreen(previous);
    }

    // === Методы поиска ===
    function clearSearchResults() {
      setSearchResults([]);
      setSearchError(null);
    }

    function setFullSearchResults(results: Abonent[]) {
      setSearchResults(results);
      setSearchLoading(false);
      setSearchError(null);
    }

  // === Методы абонента ===
  function setFullSelectedAbonent(abonent: AbonentDetails) {
    setSelectedAbonent(abonent);
    setAbonentLoading(false);
    setPortPollError(null);
  }

  // === Методы обновления портов ===
  function updateEquipmentPortData(
    equipmentIndex: number,
    data: {
      portAdmin?: "on" | "off";
      portStatus?: "up" | "down";
      portSpeed?: number;
      inOctets?: number;
      outOctets?: number;
      inErrors?: number;
      outErrors?: number;
    }
  ) {
    const current = selectedAbonent();
    if (!current) return;

    const updatedEquipment = current.equipment.map((eq, idx) => {
      if (idx === equipmentIndex) {
        return { ...eq, ...data };
      }
      return eq;
    });

    setSelectedAbonent({ ...current, equipment: updatedEquipment });
  }

  // === Методы UI ===
  function toggleHelp() {
    setIsHelpVisible((prev) => !prev);
  }

  function hideHelp() {
    setIsHelpVisible(false);
  }

  return {
    // Signals (read-only)
    currentScreen,
    screenHistory,
    searchInputValue,
    searchResults,
    searchLoading,
    searchError,
    selectedAbonent,
    abonentLoading,
    portPollError,
    isHelpVisible,

    // Setters
    setSearchInputValue,
    setSearchResults: setFullSearchResults,
    setSearchLoading,
    setSearchError,
    setSelectedAbonent: setFullSelectedAbonent,
    setAbonentLoading,
    setPortPollError,
    updateEquipmentPortData,

    // Methods
    navigateTo,
    goBack,
    clearSearchResults,
    toggleHelp,
    hideHelp,
  };
});
}

export type Store = ReturnType<typeof createStore>;
