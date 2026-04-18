/**
 * Центральное хранилище состояния TUI
 * Управляет всеми данными приложения и навигацией
 * Использует Solid.js signals для реактивности
 */

import { createSignal, createRoot } from "solid-js";

// === Типы ===

export type ScreenId = "search" | "abonent" | "switch" | "olt" | "help";

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

export interface AbonentDetails extends Abonent {
  equipment: Equipment[];
  connections: Connection[];
  services: Service[];
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
  oltPort?: number;
  // Список IP-MAC соответствий
  ipMacList?: IpMacEntry[];
  // Состояние порта (для switch)
  portStatus?: "up" | "down";
  portSpeed?: number;
  // Заметка для порта
  portNote?: string;
  // Счётчики трафика
  inOctets?: number;
  outOctets?: number;
  inErrors?: number;
  outErrors?: number;
}

export interface IpMacEntry {
  ip: string;
  mac: string | null;
}

export type EquipmentType = "switch" | "olt" | "onu" | "router";

export interface Connection {
  id: string;
  type: string;
  status: string;
}

export interface Service {
  id: string;
  name: string;
  status: string;
}

export interface PortStatus {
  port: number;
  status: "up" | "down";
  speed: number;
  duplex: "full" | "half";
  flowControl: boolean;
}

export interface PortErrors {
  port: number;
  crcErrors: number;
  collisions: number;
  fcsErrors: number;
  overflow: number;
  total: number;
}

export interface PortTraffic {
  port: number;
  inOctets: number;
  outOctets: number;
  inUcastPkts: number;
  outUcastPkts: number;
  inErrors: number;
  outErrors: number;
}

export interface MacEntry {
  mac: string;
  vlan: number;
  port: number;
  type: "dynamic" | "static";
}

export interface ONUInfo {
  onuId: string;
  mac: string;
  port: number;
  status: ONUStatus;
}

export type ONUStatus =
  | "registered"
  | "llid-admin-down"
  | "wire-down"
  | "offline"
  | "power-off"
  | "unknown";

export interface ONUDetails extends ONUInfo {
  vendor: string;
  model: string;
  firmware: string;
  uptime: number;
  signal: ONUSignal;
}

export interface ONUSignal {
  rxPower: number;
  txPower: number;
  distance: number;
  attenuation: number;
}

// === Store ===

export function createStore() {
  return createRoot(() => {
    // === Состояние навигации ===
    const [currentScreen, setCurrentScreen] = createSignal<ScreenId>("search");
    const [screenHistory, setScreenHistory] = createSignal<ScreenId[]>([]);

    // === Состояние поиска ===
    const [searchQuery, setSearchQuery] = createSignal("");
    const [searchInputValue, setSearchInputValue] = createSignal("");
    const [searchResults, setSearchResults] = createSignal<Abonent[]>([]);
    const [searchLoading, setSearchLoading] = createSignal(false);
    const [searchError, setSearchError] = createSignal<string | null>(null);

    // === Состояние абонента ===
    const [selectedAbonent, setSelectedAbonent] = createSignal<AbonentDetails | null>(null);
    const [abonentLoading, setAbonentLoading] = createSignal(false);
    const [selectedEquipmentIndex, setSelectedEquipmentIndex] = createSignal(0);

    // === Состояние диагностики Switch ===
    const [switchData, setSwitchData] = createSignal<PortStatus | null>(null);
    const [switchErrors, setSwitchErrors] = createSignal<PortErrors | null>(null);
    const [switchTraffic, setSwitchTraffic] = createSignal<PortTraffic | null>(null);
    const [switchLoading, setSwitchLoading] = createSignal(false);

    // === Состояние диагностики OLT ===
    const [oltData, setOltData] = createSignal<ONUDetails | null>(null);
    const [oltLoading, setOltLoading] = createSignal(false);

    // === UI состояние ===
    const [isHelpVisible, setIsHelpVisible] = createSignal(false);
    const [focusedElement, setFocusedElement] = createSignal<string | null>("searchInput");
    const [statusMessage, setStatusMessage] = createSignal<string | null>(null);

    // === Методы навигации ===
    function navigateTo(screen: ScreenId) {
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
      setSelectedEquipmentIndex(0);
    }

  // Выбор абонента из результатов поиска (конвертирует Abonent в AbonentDetails)
  function selectAbonentFromSearch(abonent: Abonent) {
    // Для организации "МедЦентр Плюс" - несколько подключений с разными состояниями
    if (abonent.account === "12345") {
      const details: AbonentDetails = {
        ...abonent,
        equipment: [
          // Switch 1: порт up, 1G, без ошибок
          {
            type: "switch",
            model: "D-Link DGS-1210-28",
            mac: "AA:BB:CC:DD:EE:01",
            ip: "10.0.0.5",
            port: 1,
            portStatus: "up",
            portSpeed: 1000,
            portNote: "оптика медики",
            inOctets: 5368709120, // 5 GB
            outOctets: 10737418240, // 10 GB
            inErrors: 0,
            outErrors: 0,
            ipMacList: [
              { ip: "192.168.1.10", mac: "AA:BB:CC:11:01:01" },
            ],
          },
          // Switch 2: порт up, 100M, есть ошибки
          {
            type: "switch",
            model: "D-Link DGS-1210-28",
            mac: "AA:BB:CC:DD:EE:02",
            ip: "10.0.0.6",
            port: 5,
            portStatus: "up",
            portSpeed: 100,
            portNote: "AP 192.168.1.50",
            inOctets: 1073741824, // 1 GB
            outOctets: 2147483648, // 2 GB
            inErrors: 12,
            outErrors: 3,
            ipMacList: [
              { ip: "192.168.1.50", mac: "AA:BB:CC:22:02:02" },
            ],
          },
          // Switch 3: порт down
          {
            type: "switch",
            model: "D-Link DGS-1210-28",
            mac: "AA:BB:CC:DD:EE:03",
            ip: "10.0.0.7",
            port: 12,
            portStatus: "down",
            portSpeed: undefined,
            portNote: "на крыше",
            inOctets: 0,
            outOctets: 0,
            inErrors: 0,
            outErrors: 0,
            ipMacList: [],
          },
          // Switch 4: порт up, 10M (медленный линк)
          {
            type: "switch",
            model: "D-Link DES-1008",
            mac: "AA:BB:CC:DD:EE:04",
            ip: "10.0.0.8",
            port: 3,
            portStatus: "up",
            portSpeed: 10,
            portNote: "старый кабель",
            inOctets: 52428800, // 50 MB
            outOctets: 104857600, // 100 MB
            inErrors: 45,
            outErrors: 23,
            ipMacList: [
              { ip: "192.168.1.60", mac: null },
            ],
          },
          // ONU
          {
            type: "onu",
            model: "Huawei HG8245H",
            mac: "11:22:33:44:55:66",
            ip: "192.168.1.100",
            port: 3,
            oltAddress: "10.0.0.1",
            oltPort: 1,
            ipMacList: [
              { ip: "192.168.1.100", mac: "11:22:33:44:55:66" },
            ],
          },
        ],
        connections: [],
        services: [],
      };
      setFullSelectedAbonent(details);
      return;
    }

    // Для остальных абонентов - стандартный набор оборудования
    const details: AbonentDetails = {
      ...abonent,
      equipment: [
        {
          type: "switch",
          model: "D-Link DGS-1210-28",
          mac: "AA:BB:CC:DD:EE:FF",
          ip: "10.0.0.5",
          port: 12,
          portStatus: "up",
          portSpeed: 1000,
          portNote: "основной",
          inOctets: 12345678,
          outOctets: 87654321,
          inErrors: 5,
          outErrors: 2,
          ipMacList: [
            { ip: "192.168.1.100", mac: "AA:BB:CC:DD:EE:FF" },
            { ip: "192.168.1.101", mac: "11:22:33:44:55:66" },
          ],
        },
        {
          type: "onu",
          model: "Huawei HG8245H",
          mac: "11:22:33:44:55:66",
          ip: "192.168.1.100",
          port: 3,
          oltAddress: "10.0.0.1",
          oltPort: 1,
          ipMacList: [
            { ip: "192.168.1.100", mac: "11:22:33:44:55:66" },
          ],
        },
      ],
      connections: [],
      services: [],
    };
    setFullSelectedAbonent(details);
  }

    // === Методы диагностики Switch ===
    function clearSwitchData() {
      setSwitchData(null);
      setSwitchErrors(null);
      setSwitchTraffic(null);
      setSwitchLoading(false);
    }

    // === Методы диагностики OLT ===
    function clearOltData() {
      setOltData(null);
      setOltLoading(false);
    }

    // === Методы UI ===
    function toggleHelp() {
      setIsHelpVisible((prev) => !prev);
    }

    function showHelp() {
      setIsHelpVisible(true);
    }

    function hideHelp() {
      setIsHelpVisible(false);
    }

    return {
      // Signals (read-only)
      currentScreen,
      screenHistory,
      searchQuery,
      searchInputValue,
      searchResults,
      searchLoading,
      searchError,
      selectedAbonent,
      abonentLoading,
      selectedEquipmentIndex,
      switchData,
      switchErrors,
      switchTraffic,
      switchLoading,
      oltData,
      oltLoading,
      isHelpVisible,
      focusedElement,
      statusMessage,

      // Setters
      setCurrentScreen,
      setSearchQuery,
      setSearchInputValue,
      setSearchResults: setFullSearchResults,
      setSearchLoading,
      setSearchError,
      setSelectedAbonent: setFullSelectedAbonent,
      selectAbonentFromSearch,
      setAbonentLoading,
      setSelectedEquipmentIndex,
      setSwitchData,
      setSwitchErrors,
      setSwitchTraffic,
      setSwitchLoading,
      setOltData,
      setOltLoading,
      setFocusedElement,
      setStatusMessage,

      // Methods
      navigateTo,
      goBack,
      clearSearchResults,
      clearSwitchData,
      clearOltData,
      toggleHelp,
      showHelp,
      hideHelp,
    };
  });
}

export type Store = ReturnType<typeof createStore>;
