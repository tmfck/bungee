/**
 * Экран поиска абонента
 * Основной экран для поиска и выбора абонента
 */

import { Box, Text, TextAttributes, Input } from "@opentui/core";
import type { Store } from "../store.js";
import { createTable, createAbonentSearchTable } from "../components/table.component.js";
import { createSpinner } from "../components/spinner.component.js";
import { useNavigation } from "../hooks/useNavigation.js";

// === Экран поиска ===

export function createSearchScreen(store: Store) {
  let searchTimeout: Timer | null = null;
  let currentQuery = "";
  let selectedIndex = 0;

  const spinner = createSpinner({ label: "Поиск", fg: "cyan" });

  // Навигация по результатам
  const navigation = useNavigation({
    itemCount: 0,
    pageSize: 10,
    onSelect: (index) => {
      const state = store.getState();
      const abonent = state.searchResults[index];
      if (abonent) {
        // Переход к карточке абонента
        store.setScreen("abonent");
        // Загрузка деталей будет в экране абонента
      }
    },
    onChange: (index) => {
      selectedIndex = index;
    },
  });

  // Обработчик поиска с debounce
  async function handleSearch(query: string) {
    currentQuery = query;
    store.setSearchQuery(query);

    // Отмена предыдущего таймера
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Минимальная длина запроса
    if (query.length < 2) {
      store.clearSearchResults();
      navigation.setItemCount(0);
      return;
    }

    // Debounce
    searchTimeout = setTimeout(async () => {
      store.setSearchLoading(true);
      spinner.start();

      try {
        // TODO: Интеграция с ScraperService
        // const results = await scraper.searchAbonent({ type: "account", value: query });
        
        // Заглушка для тестирования
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

  // Обработчик клавиш
  function handleKey(key: string) {
    if (navigation.handleKey(key)) {
      return true;
    }

    switch (key.toLowerCase()) {
      case "/":
        // Фокус на поле поиска
        return true;
      default:
        return false;
    }
  }

  function render() {
    const state = store.getState();

    return Box(
      {
        flexDirection: "column",
        flexGrow: 1,
        padding: 1,
      },
      // Заголовок
      Text({
        content: "Поиск абонента",
        attributes: TextAttributes.BOLD,
        fg: "cyan",
      }),

      // Поле поиска
      Box(
        {
          marginTop: 1,
          marginBottom: 1,
          flexDirection: "column",
        },
        Text({
          content: "Введите лицевой счёт, ФИО или адрес:",
          attributes: TextAttributes.DIM,
        }),
        Box(
          {
            marginTop: 1,
            border: { type: "line" },
            borderColor: state.focusedElement === "searchInput" ? "cyan" : "gray",
            padding: 1,
          },
          Input({
            placeholder: "Поиск...",
            value: currentQuery,
            onChange: handleSearch,
            focus: state.focusedElement === "searchInput",
          })
        )
      ),

      // Результаты поиска
      Box(
        {
          flexDirection: "column",
          flexGrow: 1,
          marginTop: 1,
        },
        // Статус
        state.searchLoading
          ? spinner.render()
          : state.searchError
          ? Box(
              {
                flexDirection: "row",
                alignItems: "center",
              },
              Text({
                content: "✗ ",
                fg: "red",
              }),
              Text({
                content: state.searchError,
                fg: "red",
              })
            )
          : state.searchResults.length > 0
          ? Text({
              content: `Найдено: ${state.searchResults.length}`,
              attributes: TextAttributes.DIM,
            })
          : currentQuery.length < 2
          ? Text({
              content: "Введите минимум 2 символа для поиска",
              attributes: TextAttributes.DIM,
            })
          : Text({
              content: "Ничего не найдено",
              attributes: TextAttributes.DIM,
            }),

        // Таблица результатов
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
    handleKey,
    onEnter: () => {
      store.setFocusedElement("searchInput");
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
  // Моковые данные для тестирования UI
  const mockAbonents = [
    {
      id: "1",
      account: "123456",
      fullName: "Иванов Иван Иванович",
      address: { full: "ул. Ленина, д. 15, кв. 42" },
      status: "active" as const,
    },
    {
      id: "2",
      account: "234567",
      fullName: "Петров Петр Петрович",
      address: { full: "ул. Мира, д. 8, кв. 15" },
      status: "active" as const,
    },
    {
      id: "3",
      account: "345678",
      fullName: "Сидорова Анна Николаевна",
      address: { full: "ул. Гагарина, д. 3, кв. 78" },
      status: "blocked" as const,
    },
  ];

  // Фильтрация по запросу
  return mockAbonents.filter(
    (a) =>
      a.account.includes(query) ||
      a.fullName.toLowerCase().includes(query.toLowerCase()) ||
      a.address.full.toLowerCase().includes(query.toLowerCase())
  );
}
