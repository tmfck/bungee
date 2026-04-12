/**
* Экран поиска абонента
* Основной экран для поиска и выбора абонента
*/

import { Box, Text, TextAttributes, Input, InputRenderableEvents } from "@opentui/core";
import type { Store } from "../store.js";
import { createAbonentSearchTable } from "../components/table.component.js";
import { createSpinner } from "../components/spinner.component.js";
import { useNavigation } from "../hooks/useNavigation.js";

// === Экран поиска ===

export function createSearchScreen(store: Store) {
  let searchTimeout: Timer | null = null;
  let selectedIndex = 0;

  const spinner = createSpinner({ label: "Поиск", fg: "cyan" });

  // Создаём Input один раз
  const inputVNode = Input({
    placeholder: "Поиск...",
    value: "",
  });

  // Навигация по результатам
  const navigation = useNavigation({
    itemCount: 0,
    pageSize: 10,
    onSelect: (index) => {
      const state = store.getState();
      const abonent = state.searchResults[index];
      if (abonent) {
        store.setScreen("abonent");
      }
    },
    onChange: (index) => {
      selectedIndex = index;
    },
  });

  // Обработчик поиска с debounce
  async function handleSearch(query: string) {
    store.setSearchQuery(query);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < 2) {
      store.clearSearchResults();
      navigation.setItemCount(0);
      return;
    }

    searchTimeout = setTimeout(async () => {
      store.setSearchLoading(true);
      spinner.start();

      try {
        const mockResults = generateMockResults(query);
        store.setSearchResults(mockResults);
        navigation.setItemCount(mockResults.length);
        selectedIndex = 0;
      } catch (error) {
        store.setSearchError(error instanceof Error ? error.message : "Ошибка поиска");
      } finally {
        spinner.stop();
      }
    }, 300);
  }

  // Немедленное выполнение поиска
  async function executeSearch(query: string) {
    store.setSearchLoading(true);
    spinner.start();

    try {
      const mockResults = generateMockResults(query);
      store.setSearchResults(mockResults);
      navigation.setItemCount(mockResults.length);
      selectedIndex = 0;
    } catch (error) {
      store.setSearchError(error instanceof Error ? error.message : "Ошибка поиска");
    } finally {
      spinner.stop();
    }
  }

  // Подписываемся на события Input
  inputVNode.on(InputRenderableEvents.INPUT, (value: string) => {
    handleSearch(value);
  });

  inputVNode.on(InputRenderableEvents.ENTER, () => {
    const state = store.getState();
    if (state.searchQuery.length >= 2) {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      executeSearch(state.searchQuery);
    }
  });

  function render() {
    const state = store.getState();

    return Box(
      { flexDirection: "column", flexGrow: 1, padding: 1 },

      Box(
        { flexDirection: "column" },
        Box(
          {
            borderColor: state.focusedElement === "searchInput" ? "cyan" : "gray",
            borderStyle: "single",
            padding: 0,
            title: "Лицевой счёт, ФИО или адрес:",
            titleAlignment: "left",
          },
          inputVNode
        )
      ),

      Box(
        { flexDirection: "column", flexGrow: 1, marginTop: 0 },
        state.searchLoading
          ? spinner.render()
          : state.searchError
            ? Box(
                { flexDirection: "row", alignItems: "center" },
                Text({ content: "✗ ", fg: "red" }),
                Text({ content: state.searchError, fg: "red" })
              )
            : state.searchResults.length > 0
              ? Text({
                  content: `Найдено: ${state.searchResults.length}`,
                  attributes: TextAttributes.DIM,
                })
              : state.searchQuery.length < 2
                ? Text({
                    content: "Введите минимум 2 символа для поиска",
                    attributes: TextAttributes.DIM,
                  })
                : Text({ content: "Ничего не найдено", attributes: TextAttributes.DIM }),

        state.searchResults.length > 0
          ? createAbonentSearchTable(
              state.searchResults,
              selectedIndex,
              (index) => {
                const abonent = state.searchResults[index];
                if (abonent) {
                  store.setScreen("abonent");
                }
              }
            ).render()
          : null
      )
    );
  }

  return {
    render,
    onEnter: () => {
      inputVNode.focus();
    },
    onExit: () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      spinner.stop();
    },
  };
}

// === Заглушка для тестирования ===

function generateMockResults(query: string) {
  const mockAbonents = [
    {
      id: "1",
      account: "123456",
      fullName: "Иванов Иван Иванович",
      address: {
        city: "Город",
        street: "ул. Ленина",
        house: "15",
        apartment: "42",
        full: "ул. Ленина, д. 15, кв. 42"
      },
      tariff: "Базовый",
      status: "active" as const,
      balance: 150.50,
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
        full: "ул. Мира, д. 8, кв. 15"
      },
      tariff: "Премиум",
      status: "active" as const,
      balance: 200.00,
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
        full: "ул. Гагарина, д. 3, кв. 78"
      },
      tariff: "Стандарт",
      status: "blocked" as const,
      balance: -50.00,
    },
  ];

  return mockAbonents.filter(
    (a) =>
      a.account.includes(query) ||
      a.fullName.toLowerCase().includes(query.toLowerCase()) ||
      a.address.full.toLowerCase().includes(query.toLowerCase())
  );
}
