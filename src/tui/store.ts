/**
 * Центральное хранилище состояния TUI
 * Управляет всеми данными приложения и навигацией
 */

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
  status: AbonentStatus;
  balance: number;
}

export interface Address {
  city: string;
  street: string;
  house: string;
  apartment?: string;
  full: string;
}

export type AbonentStatus = "active" | "blocked" | "suspended" | "disconnected";

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

// === Состояние приложения ===

export interface AppState {
  // Навигация
  currentScreen: ScreenId;
  screenHistory: ScreenId[];

  // Данные поиска
  searchQuery: string;
  searchResults: Abonent[];
  searchLoading: boolean;
  searchError: string | null;

  // Выбранный абонент
  selectedAbonent: AbonentDetails | null;
  abonentLoading: boolean;
  selectedEquipmentIndex: number;

  // Диагностика Switch
  switchData: PortStatus | null;
  switchErrors: PortErrors | null;
  switchTraffic: PortTraffic | null;
  switchLoading: boolean;

  // Диагностика OLT
  oltData: ONUDetails | null;
  oltLoading: boolean;

  // UI состояние
  isHelpVisible: boolean;
  focusedElement: string | null;
  statusMessage: string | null;
}

export type StoreSubscriber = (state: AppState) => void;

// === Начальное состояние ===

function createInitialState(): AppState {
  return {
    currentScreen: "search",
    screenHistory: [],
    searchQuery: "",
    searchResults: [],
    searchLoading: false,
    searchError: null,
    selectedAbonent: null,
    abonentLoading: false,
    selectedEquipmentIndex: 0,
    switchData: null,
    switchErrors: null,
    switchTraffic: null,
    switchLoading: false,
    oltData: null,
    oltLoading: false,
    isHelpVisible: false,
    focusedElement: "searchInput",
    statusMessage: null,
  };
}

// === Store ===

export function createStore() {
  let state: AppState = createInitialState();
  const subscribers: Set<StoreSubscriber> = new Set();

  function notify() {
    subscribers.forEach((fn) => fn(state));
  }

  return {
    getState: () => state,

    subscribe(fn: StoreSubscriber) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    // === Навигация ===

    setScreen(screen: ScreenId) {
      state = {
        ...state,
        screenHistory: [...state.screenHistory, state.currentScreen],
        currentScreen: screen,
      };
      notify();
    },

    back() {
      const history = [...state.screenHistory];
      const previous = history.pop() || "search";
      state = {
        ...state,
        screenHistory: history,
        currentScreen: previous,
      };
      notify();
    },

    // === Поиск ===

    setSearchQuery(query: string) {
      state = { ...state, searchQuery: query };
      notify();
    },

    setSearchResults(results: Abonent[]) {
      state = {
        ...state,
        searchResults: results,
        searchLoading: false,
        searchError: null,
      };
      notify();
    },

    setSearchLoading(loading: boolean) {
      state = { ...state, searchLoading: loading };
      notify();
    },

    setSearchError(error: string | null) {
      state = {
        ...state,
        searchError: error,
        searchLoading: false,
      };
      notify();
    },

    clearSearchResults() {
      state = {
        ...state,
        searchResults: [],
        searchError: null,
      };
      notify();
    },

    // === Абонент ===

    setSelectedAbonent(abonent: AbonentDetails) {
      state = {
        ...state,
        selectedAbonent: abonent,
        abonentLoading: false,
        selectedEquipmentIndex: 0,
      };
      notify();
    },

    setAbonentLoading(loading: boolean) {
      state = { ...state, abonentLoading: loading };
      notify();
    },

    setSelectedEquipmentIndex(index: number) {
      state = { ...state, selectedEquipmentIndex: index };
      notify();
    },

    // === Диагностика Switch ===

    setSwitchData(data: PortStatus) {
      state = { ...state, switchData: data, switchLoading: false };
      notify();
    },

    setSwitchErrors(errors: PortErrors) {
      state = { ...state, switchErrors: errors };
      notify();
    },

    setSwitchTraffic(traffic: PortTraffic) {
      state = { ...state, switchTraffic: traffic };
      notify();
    },

    setSwitchLoading(loading: boolean) {
      state = { ...state, switchLoading: loading };
      notify();
    },

    clearSwitchData() {
      state = {
        ...state,
        switchData: null,
        switchErrors: null,
        switchTraffic: null,
        switchLoading: false,
      };
      notify();
    },

    // === Диагностика OLT ===

    setOltData(data: ONUDetails) {
      state = { ...state, oltData: data, oltLoading: false };
      notify();
    },

    setOltLoading(loading: boolean) {
      state = { ...state, oltLoading: loading };
      notify();
    },

    clearOltData() {
      state = {
        ...state,
        oltData: null,
        oltLoading: false,
      };
      notify();
    },

    // === UI ===

    showHelp() {
      state = { ...state, isHelpVisible: true };
      notify();
    },

    hideHelp() {
      state = { ...state, isHelpVisible: false };
      notify();
    },

    toggleHelp() {
      state = { ...state, isHelpVisible: !state.isHelpVisible };
      notify();
    },

    setFocusedElement(element: string | null) {
      state = { ...state, focusedElement: element };
      notify();
    },

    setStatusMessage(message: string | null) {
      state = { ...state, statusMessage: message };
      notify();
    },

    // === Обновление ===

    refresh() {
      notify();
    },

    // === Сброс ===

    reset() {
      state = createInitialState();
      notify();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
