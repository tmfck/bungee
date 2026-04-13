/** 
 * Экран поиска абонента
 * Основной экран для поиска и выбора абонента
 */

import { createSignal, createMemo, Show, For, onCleanup, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { Store, Abonent } from "../store.js";

interface SearchScreenProps {
  store: Store;
}

export default function SearchScreen(props: SearchScreenProps) {
  const store = props.store;

  // Локальное состояние только для selectedIndex и timeout
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [searchTimeout, setSearchTimeout] = createSignal<Timer | null>(null);

  // Ref для input
  let inputRef: any = null;

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

  // Mock данные
  function generateMockResults(query: string): Abonent[] {
    const mockAbonents: Abonent[] = [
      {
        id: "1",
        account: "123456",
        fullName: "Иванов Иван Иванович",
        address: {
          city: "Город",
          street: "ул. Ленина",
          house: "15",
          apartment: "42",
          full: "ул. Ленина, д. 15, кв. 42",
        },
        tariff: "Базовый",
        status: "active",
        balance: 150.5,
      },
      {
        id: "2",
        account: "234567",
        fullName: "Петров Петр Петрович",
        address: {
          city: "Город",
          street: "ул. Мира",
          house: "8",
          apartment: "15",
          full: "ул. Мира, д. 8, кв. 15",
        },
        tariff: "Премиум",
        status: "active",
        balance: 200.0,
      },
      {
        id: "3",
        account: "345678",
        fullName: "Сидорова Анна Николаевна",
        address: {
          city: "Город",
          street: "ул. Гагарина",
          house: "3",
          apartment: "78",
          full: "ул. Гагарина, д. 3, кв. 78",
        },
        tariff: "Стандарт",
        status: "blocked",
        balance: -50.0,
      },
      {
        id: "4",
        account: "12345",
        fullName: "ООО 'МедЦентр Плюс'",
        address: {
          city: "Город",
          street: "ул. Здоровья",
          house: "1",
          full: "ул. Здоровья, д. 1",
        },
        phone: "+7 (999) 555-00-00",
        tariff: "Корпоративный",
        status: "active",
        balance: 15000.0,
      },
    ];

    return mockAbonents.filter(
      (a) =>
        a.account.includes(query) ||
        a.fullName.toLowerCase().includes(query.toLowerCase()) ||
        a.address.full.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Обработчик поиска с debounce
  function handleSearch(value: string) {
    store.setSearchQuery(value);
    store.setSearchInputValue(value);

    // Очищаем предыдущий timeout
    const prevTimeout = searchTimeout();
    if (prevTimeout) {
      clearTimeout(prevTimeout);
    }

    if (value.length < 2) {
      store.clearSearchResults();
      return;
    }

    // Debounce поиск
    const timeout = setTimeout(() => {
      store.setSearchLoading(true);

      // Симулируем поиск
      setTimeout(() => {
        const results = generateMockResults(value);
        store.setSearchResults(results);
        store.setSearchLoading(false);
        setSelectedIndex(0);
      }, 300);
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
  function selectAbonent(index: number) {
    const selected = results()[index];
    if (selected) {
      store.selectAbonentFromSearch(selected);
      store.navigateTo("abonent");
    }
  }

  // Cleanup
  onCleanup(() => {
    const timeout = searchTimeout();
    if (timeout) {
      clearTimeout(timeout);
    }
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
