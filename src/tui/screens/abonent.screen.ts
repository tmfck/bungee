/**
 * Экран карточки абонента
 * Отображает детальную информацию об абоненте и его оборудовании
 */

import { Box, Text, TextAttributes } from "@opentui/core";
import type { Store, AbonentDetails, Equipment } from "../store.js";
import { createEquipmentTable } from "../components/table.component.js";
import { createSpinner } from "../components/spinner.component.js";
import { useNavigation } from "../hooks/useNavigation.js";

// === Экран абонента ===

export function createAbonentScreen(store: Store) {
  let selectedIndex = 0;
  const spinner = createSpinner({ label: "Загрузка данных", fg: "cyan" });

  // Навигация по оборудованию
  const navigation = useNavigation({
    itemCount: 0,
    pageSize: 5,
    onSelect: (index) => {
      const state = store.getState();
      const equipment = state.selectedAbonent?.equipment[index];
      if (equipment) {
        navigateToEquipment(equipment);
      }
    },
    onChange: (index) => {
      selectedIndex = index;
      store.setSelectedEquipmentIndex(index);
    },
  });

  // Навигация к оборудованию
  function navigateToEquipment(equipment: Equipment) {
    switch (equipment.type) {
      case "switch":
        store.clearSwitchData();
        store.setScreen("switch");
        break;
      case "onu":
        store.clearOltData();
        store.setScreen("olt");
        break;
      default:
        // Другое оборудование - не поддерживается
        break;
    }
  }

  // Обработчик клавиш
  function handleKey(key: string) {
    if (navigation.handleKey(key)) {
      return true;
    }

    const state = store.getState();
    const equipment = state.selectedAbonent?.equipment[selectedIndex];

    switch (key.toLowerCase()) {
      case "d":
        // Диагностика - переход к соответствующему оборудованию
        if (equipment) {
          navigateToEquipment(equipment);
        }
        return true;
      case "s":
        // Switch
        if (equipment?.type === "switch" || equipment?.type === "onu") {
          navigateToEquipment(equipment);
        }
        return true;
      case "o":
        // OLT
        if (equipment?.type === "onu") {
          store.clearOltData();
          store.setScreen("olt");
        }
        return true;
      case "r":
        // Обновить данные
        loadAbonentDetails();
        return true;
      default:
        return false;
    }
  }

  // Загрузка деталей абонента
  async function loadAbonentDetails() {
    const state = store.getState();
    const abonent = state.searchResults[0]; // TODO: передавать ID выбранного абонента
    
    if (!abonent) return;

    store.setAbonentLoading(true);
    spinner.start();

    try {
      // TODO: Интеграция с ScraperService
      // const details = await scraper.getAbonentDetails(abonent.id);
      
      // Заглушка для тестирования
      const mockDetails = generateMockDetails(abonent.id);
      store.setSelectedAbonent(mockDetails);
      navigation.setItemCount(mockDetails.equipment.length);
    } catch (error) {
      store.setSearchError(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      spinner.stop();
    }
  }

  function render() {
    const state = store.getState();

    // Загрузка
    if (state.abonentLoading) {
      return Box(
        {
          flexDirection: "column",
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        spinner.render()
      );
    }

    // Нет данных
    if (!state.selectedAbonent) {
      return Box(
        {
          flexDirection: "column",
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        Text({
          content: "Нет данных об абоненте",
          attributes: TextAttributes.DIM,
        })
      );
    }

    const abonent = state.selectedAbonent;

    return Box(
      {
        flexDirection: "column",
        flexGrow: 1,
        padding: 1,
      },
      // Заголовок с ФИО и статусом
      Box(
        {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 1,
        },
        Text({
          content: abonent.fullName,
          attributes: TextAttributes.BOLD,
          fg: "white",
        }),
        Text({
          content: " ",
        }),
        Text({
          content: getStatusLabel(abonent.status),
          fg: getStatusColor(abonent.status),
          attributes: TextAttributes.BOLD,
        })
      ),

      // Адрес
      Box(
        {
          marginBottom: 1,
        },
        Text({
          content: `📍 ${abonent.address.full}`,
          attributes: TextAttributes.DIM,
        })
      ),

      // Контактная информация
      Box(
        {
          flexDirection: "row",
          marginBottom: 1,
        },
        Text({
          content: `📞 ${abonent.phone || "—"}`,
        }),
        Text({
          content: "  |  ",
          attributes: TextAttributes.DIM,
        }),
        Text({
          content: `🌐 ${abonent.ip || "—"}`,
        }),
        Text({
          content: "  |  ",
          attributes: TextAttributes.DIM,
        }),
        Text({
          content: `📦 ${abonent.tariff}`,
        })
      ),

      // Баланс
      Box(
        {
          flexDirection: "row",
          marginBottom: 1,
          padding: 1,
          border: { type: "line" },
          borderColor: "gray",
        },
        Text({
          content: `💰 Баланс: `,
        }),
        Text({
          content: `${abonent.balance.toFixed(2)} ₽`,
          fg: abonent.balance >= 0 ? "green" : "red",
          attributes: TextAttributes.BOLD,
        })
      ),

      // Оборудование
      Box(
        {
          flexDirection: "column",
          marginTop: 1,
          flexGrow: 1,
        },
        Text({
          content: "🔧 Оборудование:",
          attributes: TextAttributes.BOLD,
          marginBottom: 1,
        }),
        abonent.equipment.length > 0
          ? createEquipmentTable(
              abonent.equipment,
              selectedIndex,
              (index) => {
                const equipment = abonent.equipment[index];
                navigateToEquipment(equipment);
              }
            ).render()
          : Text({
              content: "Нет оборудования",
              attributes: TextAttributes.DIM,
            })
      )
    );
  }

  return {
    render,
    handleKey,
    onEnter: () => {
      const state = store.getState();
      if (!state.selectedAbonent) {
        loadAbonentDetails();
      } else {
        navigation.setItemCount(state.selectedAbonent.equipment.length);
      }
    },
    onExit: () => {
      spinner.stop();
    },
  };
}

// === Вспомогательные функции ===

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "● Активен",
    blocked: "● Заблокирован",
    suspended: "● Приостановлен",
    disconnected: "○ Отключён",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "green",
    blocked: "red",
    suspended: "yellow",
    disconnected: "gray",
  };
  return colors[status] || "white";
}

// === Заглушка для тестирования ===

function generateMockDetails(id: string): AbonentDetails {
  return {
    id,
    account: "123456",
    fullName: "Иванов Иван Иванович",
    address: {
      city: "Красноярск",
      street: "Ленина",
      house: "15",
      apartment: "42",
      full: "г. Красноярск, ул. Ленина, д. 15, кв. 42",
    },
    phone: "+7 (999) 123-45-67",
    ip: "192.168.1.100",
    tariff: "Премиум 100",
    status: "active",
    balance: 1234.56,
    equipment: [
      {
        type: "switch",
        model: "D-Link DGS-1210-28",
        mac: "AA:BB:CC:DD:EE:FF",
        ip: "10.0.0.5",
        port: 12,
      },
      {
        type: "onu",
        model: "Huawei HG8245H",
        mac: "11:22:33:44:55:66",
        port: 3,
      },
    ],
    connections: [],
    services: [],
  };
}
