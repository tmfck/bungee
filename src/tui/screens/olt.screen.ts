/**
 * Экран диагностики OLT / ONU
 * Отображает информацию об ONU и уровень сигнала
 */

import { Box, Text, TextAttributes } from "@opentui/core";
import type { Store, ONUDetails, ONUSignal } from "../store.js";
import { createSpinner } from "../components/spinner.component.js";

// === Экран диагностики OLT ===

export function createOLTScreen(store: Store) {
  const spinner = createSpinner({ label: "Подключение к OLT", fg: "yellow" });

  // Загрузка данных
  async function loadOLTData() {
    const state = store.getState();
    const abonent = state.selectedAbonent;
    const equipment = abonent?.equipment.find((e) => e.type === "onu");

    if (!equipment) {
      store.setSearchError("Нет информации об ONU для абонента");
      return;
    }

    store.setOltLoading(true);
    spinner.start();

    try {
      // TODO: Интеграция с OLTClient
      // const client = new OLTClient({ host: "10.0.1.1", ... });
      // await client.connect();
      // const details = await client.getOnuDetails(equipment.mac);
      
      // Заглушка для тестирования
      const mockDetails = generateMockONUDetails(equipment.mac);
      store.setOltData(mockDetails);
    } catch (error) {
      store.setSearchError(error instanceof Error ? error.message : "Ошибка подключения");
    } finally {
      spinner.stop();
    }
  }

  // Обработчик клавиш
  function handleKey(key: string) {
    switch (key.toLowerCase()) {
      case "r":
        // Перезагрузка ONU
        rebootONU();
        return true;
      case "e":
        // Экспорт данных (TODO)
        return true;
      case "f5":
        // Обновить данные
        loadOLTData();
        return true;
      default:
        return false;
    }
  }

  // Перезагрузка ONU
  async function rebootONU() {
    store.setStatusMessage("Отправка команды перезагрузки...");
    // TODO: Интеграция с OLTClient
    // await client.rebootONU(onuId);
    store.setStatusMessage("ONU перезагружается...");
    setTimeout(() => {
      store.setStatusMessage(null);
      loadOLTData();
    }, 3000);
  }

  function render() {
    const state = store.getState();

    // Загрузка
    if (state.oltLoading) {
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
    if (!state.oltData) {
      return Box(
        {
          flexDirection: "column",
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        Text({
          content: "Нет данных об ONU",
          attributes: TextAttributes.DIM,
        })
      );
    }

    const abonent = state.selectedAbonent;
    const equipment = abonent?.equipment.find((e) => e.type === "onu");
    const data = state.oltData;

    return Box(
      {
        flexDirection: "column",
        flexGrow: 1,
        padding: 1,
      },
      // Заголовок
      Box(
        {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 1,
        },
        Text({
          content: `Диагностика: ${data.vendor} ${data.model}`,
          attributes: TextAttributes.BOLD,
          fg: "cyan",
        }),
        Text({
          content: ` (ONU)`,
          attributes: TextAttributes.DIM,
        })
      ),

      // Информация о порте и MAC
      Box(
        {
          flexDirection: "row",
          marginBottom: 1,
        },
        Text({
          content: `Порт: ${data.port}`,
          attributes: TextAttributes.BOLD,
        }),
        Text({
          content: "  |  ",
          attributes: TextAttributes.DIM,
        }),
        Text({
          content: `MAC: ${data.mac}`,
        }),
        Text({
          content: "  |  ",
          attributes: TextAttributes.DIM,
        }),
        Text({
          content: `ONU ID: ${data.onuId}`,
        })
      ),

	// Информация ONU
	Box(
	{
	flexDirection: "column",
	marginBottom: 1,
	padding: 1,
	border: true,
	borderStyle: "single",
	borderColor: "gray",
	},
		Text({
			content: "📡 Информация ONU",
			attributes: TextAttributes.BOLD,
		}),
		Box({ height: 1 }),
        Box(
          {
            flexDirection: "row",
            marginBottom: 1,
          },
          Text({
            content: `Vendor: ${data.vendor}`,
          }),
          Text({
            content: "  |  ",
            attributes: TextAttributes.DIM,
          }),
          Text({
            content: `Model: ${data.model}`,
          }),
          Text({
            content: "  |  ",
            attributes: TextAttributes.DIM,
          }),
          Text({
            content: `FW: ${data.firmware}`,
          })
        ),
        Box(
          {
            flexDirection: "row",
          },
          Text({
            content: `Uptime: ${formatUptime(data.uptime)}`,
          }),
          Text({
            content: "  |  ",
            attributes: TextAttributes.DIM,
          }),
          Text({
            content: "Статус: ",
          }),
          Text({
            content: getStatusLabel(data.status),
            fg: getStatusColor(data.status),
            attributes: TextAttributes.BOLD,
          })
        )
      ),

	// Уровень сигнала
	Box(
	{
	flexDirection: "column",
	marginBottom: 1,
	padding: 1,
	border: true,
	borderStyle: "single",
	borderColor: "gray",
	},
		Text({
			content: "📶 Уровень сигнала",
			attributes: TextAttributes.BOLD,
		}),
		Box({ height: 1 }),
        // Rx Power
        createSignalBar("Rx Power", data.signal.rxPower, -8, -28, "dBm", "green"),
        // Tx Power
        createSignalBar("Tx Power", data.signal.txPower, 0, 6, "dBm", "cyan"),
        // Distance
        Box(
          {
            flexDirection: "row",
            marginTop: 1,
          },
          Text({
            content: `Distance: ${data.signal.distance} м`,
          }),
          Text({
            content: "  |  ",
            attributes: TextAttributes.DIM,
          }),
          Text({
            content: `Attenuation: ${data.signal.attenuation.toFixed(1)} dB`,
          })
        ),
        // Диапазон Rx
        Box(
          {
            marginTop: 1,
          },
          Text({
            content: `Диапазон Rx: -8 ... -28 dBm`,
            attributes: TextAttributes.DIM,
          })
        )
      )
    );
  }

  return {
    render,
    handleKey,
    onEnter: () => {
      const state = store.getState();
      if (!state.oltData) {
        loadOLTData();
      }
    },
    onExit: () => {
      spinner.stop();
    },
  };
}

// === Вспомогательные функции ===

function createSignalBar(
  label: string,
  value: number,
  max: number,
  min: number,
  unit: string,
  fg: string
) {
  const range = max - min;
  const percentage = Math.min(Math.max(((value - min) / range) * 100, 0), 100);
  const filled = Math.round(percentage / 5);
  const empty = 20 - filled;

  const isNormal = value >= min && value <= max;

  return Box(
    {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 1,
    },
    Text({
      content: `${label}: `,
      attributes: TextAttributes.DIM,
    }),
    Text({
      content: `${value.toFixed(1)} ${unit} `,
    }),
    Text({
      content: "█".repeat(filled),
      fg: isNormal ? fg : "yellow",
    }),
    Text({
      content: "░".repeat(empty),
      fg: "gray",
    }),
    Text({
      content: isNormal ? " НОРМА" : " ВНИМАНИЕ",
      fg: isNormal ? "green" : "yellow",
      attributes: TextAttributes.BOLD,
    })
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days} дн. ${hours} ч.`;
  }
  if (hours > 0) {
    return `${hours} ч. ${minutes} мин.`;
  }
  return `${minutes} мин.`;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    registered: "● REGISTERED",
    "llid-admin-down": "○ ADMIN DOWN",
    "wire-down": "○ WIRE DOWN",
    offline: "○ OFFLINE",
    "power-off": "○ POWER OFF",
    unknown: "? UNKNOWN",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    registered: "green",
    "llid-admin-down": "yellow",
    "wire-down": "red",
    offline: "red",
    "power-off": "red",
    unknown: "gray",
  };
  return colors[status] || "white";
}

// === Заглушка для тестирования ===

function generateMockONUDetails(mac: string): ONUDetails {
  return {
    onuId: "1",
    mac,
    port: 3,
    status: "registered",
    vendor: "Huawei",
    model: "HG8245H",
    firmware: "V300R018",
    uptime: 15 * 86400 + 3 * 3600, // 15 дней 3 часа
    signal: {
      rxPower: -18.5,
      txPower: 2.3,
      distance: 1234,
      attenuation: 12.5,
    },
  };
}
