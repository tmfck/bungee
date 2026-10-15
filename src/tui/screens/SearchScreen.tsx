/** 
 * Экран поиска абонента
 * Основной экран для поиска и выбора абонента
 */

import { createSignal, createMemo, Show, For, onCleanup, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { Store, Abonent } from "../store.js";
import { createUserSideClient, type UserSideConfig, parseNotesToOltInfo } from "../userside.js";

interface SearchScreenProps {
  store: Store;
}

export default function SearchScreen(props: SearchScreenProps) {
  const store = props.store;

  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [searchTimeout, setSearchTimeout] = createSignal<Timer | null>(null);
  let searchRequestId = 0;

  let inputRef: any = null;

  const usersideConfig: UserSideConfig = {
    baseUrl: process.env.USERSIDE_URL!,
    cookie: process.env.USERSIDE_COOKIE!,
  };
  const userside = createUserSideClient(usersideConfig);

  // Автофокус на input при монтировании
  onMount(() => {
    if (inputRef && inputRef.focus) {
      inputRef.focus();
    }
  });

  // Снимаем фокус при размонтировании
  onCleanup(() => {
    if (inputRef && inputRef.blur) {
      inputRef.blur();
    }
  });

  // Деривированные данные - используем store для значения input
  const query = createMemo(() => store.searchInputValue());
  const results = createMemo(() => store.searchResults());
  const loading = createMemo(() => store.searchLoading());
  const error = createMemo(() => store.searchError());

  // Статус
  const statusText = createMemo(() => {
    if (loading()) return "Поиск...";
    if (error()) return `✗ ${error()}`;
    if (results().length > 0) return `Найдено: ${results().length}`;
    if (query().length < 2) return "";
    return "Ничего не найдено";
  });

  async function handleSearch(value: string) {
    store.setSearchQuery(value);
    store.setSearchInputValue(value);

    const prevTimeout = searchTimeout();
    if (prevTimeout) {
      clearTimeout(prevTimeout);
      setSearchTimeout(null);
    }

    if (value.length < 2) {
      searchRequestId++;
      store.clearSearchResults();
      return;
    }

    const requestId = ++searchRequestId;
    const isStale = () => requestId !== searchRequestId;

    const timeout = setTimeout(async () => {
      store.setSearchLoading(true);

      try {
        const usResults = await userside.search(value);
        if (isStale()) return;
        const abonents: Abonent[] = usResults.map(r => ({
          id: r.id,
          account: r.account,
          fullName: r.fullName,
          address: {
            city: "",
            street: "",
            house: "",
            full: "",
          },
          tariff: "",
          status: "",
          balance: 0,
        }));
        store.setSearchResults(abonents);
        setSelectedIndex(0);
      } catch (e) {
        if (isStale()) return;
        store.setSearchError(e instanceof Error ? e.message : "Ошибка поиска");
      } finally {
        if (!isStale()) {
          store.setSearchLoading(false);
        }
      }
    }, 300);

    setSearchTimeout(timeout);
  }

  // Навигация по результатам
  useKeyboard((key) => {
    if (store.currentScreen() !== "search") return false;
    
    // Если есть результаты - обрабатываем навигацию
    if (results().length > 0) {
      switch (key.name) {
        case "up":
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          return true;
        case "down":
          setSelectedIndex((prev) => Math.min(results().length - 1, prev + 1));
          return true;
        case "return":
        case "enter":
          selectAbonent(selectedIndex());
          return true;
      }
    }

    return false;
  });

  // Функция выбора абонента
  async function selectAbonent(index: number) {
    const selected = results()[index];
    if (selected) {
      store.setAbonentLoading(true);
      store.navigateTo("abonent");
      
      try {
        const details = await userside.getAbonent(selected.id);
        
          const oltInfo = parseNotesToOltInfo(details.notes || '');

          const abonentDetails = {
            id: details.id,
            account: details.account,
            fullName: details.fullName,
            address: {
              ...details.address,
              full: details.address.apartment
              ? `${details.address.full}, кв. ${details.address.apartment}`
              : details.address.full,
            },
            phone: details.phone,
            ip: details.ip,
            tariff: details.tariffs.length > 0
              ? `${details.tariffs[0]!.name} (${details.tariffs[0]!.price} ₽)`
              : '',
            status: details.status,
            contract: details.contract,
            balance: details.balance,
            activity: details.activity,
            login: details.login,
            credit: details.credit || undefined,
            lastPlusDate: details.lastPlusDate || undefined,
            connectionDate: details.connectionDate || undefined,
            connectionTechnology: details.connectionTechnology || undefined,
            isLegalEntity: details.isLegalEntity || undefined,
            notes: details.notes || undefined,
            manager: details.manager || undefined,
            email: details.email || undefined,
            landlinePhone: details.landlinePhone || undefined,
            tariffs: details.tariffs,
            additionalServices: details.additionalServices,
            connectionPoints: details.connectionPoints,
            equipment: details.connectionPoints.map(cp => {
              const eqType = cp.equipmentType || 'switch' as const;
              return {
                type: eqType,
                model: cp.onuModel || cp.deviceModel,
                mac: '',
                ip: cp.ip || '',
                port: cp.port,
                portName: cp.portName,
                portDescription: cp.portDescription,
                deviceId: cp.deviceId,
                location: cp.onuName || cp.deviceLocation || '',
                oltAddress: oltInfo?.oltIp || undefined,
                oltPort: oltInfo?.oltPort || undefined,
                onuMac: oltInfo?.onuMac || undefined,
                ipMacList: details.ipMacList.length > 0 ? [...details.ipMacList] : [],
              };
            }),
            connections: [],
            services: [],
          };
        
        store.setSelectedAbonent(abonentDetails);
      } catch (e) {
        console.error('[SearchScreen] Failed to load abonent:', e);
        store.setAbonentLoading(false);
        store.setSearchError(e instanceof Error ? e.message : "Не удалось загрузить карточку абонента");
        store.goBack();
      }
    }
  }

  // Cleanup
  onCleanup(() => {
    const timeout = searchTimeout();
    if (timeout) {
      clearTimeout(timeout);
    }
    searchRequestId++;
  });

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      {/* Input */}
      <box flexDirection="column" marginBottom={1}>
        <box
          borderColor={store.focusedElement() === "searchInput" ? "#00d9ff" : "#444"}
          borderStyle="single"
          paddingX={1}
          paddingY={0}
          title="Лицевой счёт, ФИО или адрес:"
          titleAlignment="left"
        >
        <input
          ref={inputRef}
          placeholder="Поиск..."
          value={store.searchInputValue()}
          onInput={(value: string) => handleSearch(value)}
        />
        </box>
      </box>

      {/* Статус */}
      <box flexDirection="row" marginBottom={1}>
        <Show when={loading()}>
          <text fg="#00d9ff">⏳ {statusText()}</text>
        </Show>
        <Show when={!loading() && error()}>
          <text fg="#ff4444">{statusText()}</text>
        </Show>
        <Show when={!loading() && !error()}>
          <text fg="#666">{statusText()}</text>
        </Show>
      </box>

      {/* Результаты */}
      <box flexDirection="column" flexGrow={1}>
        <Show when={results().length > 0}>
          {/* Заголовок таблицы */}
          <box flexDirection="row" backgroundColor="#2a2a3e" paddingX={1}>
            <text width={8} fg="#888">Лицевой</text>
            <text width={30} fg="#888">ФИО</text>
            <text flexGrow={1} fg="#888">Адрес</text>
          </box>

        {/* Строки */}
        <For each={results()}>
          {(abonent, index) => (
            <box
              flexDirection="row"
              paddingX={1}
              backgroundColor={selectedIndex() === index() ? "#1a3a5a" : undefined}
              onMouseDown={() => {
                // Клик выбирает абонента
                selectAbonent(index());
              }}
            >
              <text width={8}>{abonent.account}</text>
              <text width={30}>{abonent.fullName}</text>
              <text flexGrow={1}>{abonent.address.full}</text>
            </box>
          )}
        </For>
        </Show>

        <Show when={results().length === 0 && query().length < 2}>
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text fg="#666">Введите минимум 2 символа для поиска</text>
          </box>
        </Show>

        <Show when={results().length === 0 && query().length >= 2 && !loading()}>
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text fg="#666">Ничего не найдено</text>
          </box>
        </Show>
      </box>
    </box>
  );
}
