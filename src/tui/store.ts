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
	// Device ID для опроса состояния портов
	deviceId?: string;
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

	function selectAbonentFromSearch(abonent: Abonent) {
		const details: AbonentDetails = {
			...abonent,
			equipment: [],
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

	// === Методы обновления портов ===
	function updateEquipmentPortData(
		equipmentIndex: number,
		data: {
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
		updateEquipmentPortData,

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
