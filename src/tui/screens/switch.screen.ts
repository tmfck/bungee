/**
 * Экран диагностики Switch
 * Отображает статус порта, ошибки и трафик
 */

import { Box, Text, TextAttributes } from "@opentui/core";
import type { Store, PortStatus, PortErrors, PortTraffic } from "../store.js";
import { createSpinner } from "../components/spinner.component.js";

// === Экран диагностики Switch ===

export function createSwitchScreen(store: Store) {
  const spinner = createSpinner({ label: "Подключение к Switch", fg: "yellow" });

  // Загрузка данных
  async function loadSwitchData() {
    const state = store.getState();
    const abonent = state.selectedAbonent;
    const equipment = abonent?.equipment.find((e) => e.type === "switch");

    if (!equipment) {
      store.setSearchError("Нет информации о Switch для абонента");
      return;
    }

    store.setSwitchLoading(true);
    spinner.start();

    try {
      // TODO: Интеграция с DLinkClient
      // const client = new DLinkClient({ host: equipment.ip, ... });
      // await client.connect();
      // const status = await client.getPortStatus(equipment.port);
      // const errors = await client.getPortErrors(equipment.port);
      // const traffic = await client.getPortTraffic(equipment.port);
      
      // Заглушка для тестирования
      const mockStatus = generateMockPortStatus(equipment.port);
      const mockErrors = generateMockPortErrors(equipment.port);
      const mockTraffic = generateMockPortTraffic(equipment.port);

      store.setSwitchData(mockStatus);
      store.setSwitchErrors(mockErrors);
      store.setSwitchTraffic(mockTraffic);
    } catch (error) {
      store.setSearchError(error instanceof Error ? error.message : "Ошибка подключения");
    } finally {
      spinner.stop();
    }
  }

  // Обработчик клавиш
  function handleKey(key: string) {
    switch (key.toLowerCase()) {
      case "c":
        // Очистка счетчиков ошибок
        clearCounters();
        return true;
      case "l":
        // Лог команд (TODO)
        return true;
      case "r":
      case "f5":
        // Обновить данные
        loadSwitchData();
        return true;
      default:
        return false;
    }
  }

  // Очистка счетчиков
  async function clearCounters() {
    store.setStatusMessage("Очистка счетчиков...");
    // TODO: Интеграция с DLinkClient
    // await client.clearCounters();
    store.setStatusMessage("Счетчики очищены");
    setTimeout(() => store.setStatusMessage(null), 2000);
  }

  function render() {
    const state = store.getState();

    // Загрузка
    if (state.switchLoading) {
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
    if (!state.switchData) {
      return Box(
        {
          flexDirection: "column",
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        Text({
          content: "Нет данных о Switch",
          attributes: TextAttributes.DIM,
        })
      );
    }

    const abonent = state.selectedAbonent;
    const equipment = abonent?.equipment.find((e) => e.type === "switch");
    const data = state.switchData;
    const errors = state.switchErrors;
    const traffic = state.switchTraffic;

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
          content: `Диагностика: ${equipment?.model || "Switch"}`,
          attributes: TextAttributes.BOLD,
          fg: "cyan",
        }),
        Text({
          content: ` (${equipment?.ip || "N/A"})`,
          attributes: TextAttributes.DIM,
        })
      ),

      // Информация о порте
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
          content: `MAC: ${abonent?.equipment[0]?.mac || "N/A"}`,
        })
      ),

	// Статус порта
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
			content: "📊 Статус порта",
			attributes: TextAttributes.BOLD,
		}),
		Box({ height: 1 }),
        Box(
          {
            flexDirection: "row",
          },
          Text({
            content: "Статус: ",
          }),
          Text({
            content: data.status === "up" ? "● UP" : "○ DOWN",
            fg: data.status === "up" ? "green" : "red",
            attributes: TextAttributes.BOLD,
          }),
          Text({
            content: "  |  ",
            attributes: TextAttributes.DIM,
          }),
          Text({
            content: `Скорость: ${data.speed} Mbps`,
          }),
          Text({
            content: "  |  ",
            attributes: TextAttributes.DIM,
          }),
          Text({
            content: `Дуплекс: ${data.duplex}`,
          }),
          Text({
            content: "  |  ",
            attributes: TextAttributes.DIM,
          }),
          Text({
            content: `Flow Control: ${data.flowControl ? "On" : "Off"}`,
          })
        )
      ),

	// Ошибки
	errors
	? Box(
	{
	flexDirection: "column",
	marginBottom: 1,
	padding: 1,
	border: true,
	borderStyle: "single",
	borderColor: "gray",
	},
			Text({
				content: "⚠️ Ошибки (за последний час)",
				attributes: TextAttributes.BOLD,
			}),
			Box({ height: 1 }),
            Box(
              {
                flexDirection: "row",
              },
              Text({
                content: `CRC: ${errors.crcErrors}`,
                fg: errors.crcErrors > 0 ? "red" : undefined,
              }),
              Text({
                content: "  |  ",
                attributes: TextAttributes.DIM,
              }),
              Text({
                content: `FCS: ${errors.fcsErrors}`,
                fg: errors.fcsErrors > 0 ? "red" : undefined,
              }),
              Text({
                content: "  |  ",
                attributes: TextAttributes.DIM,
              }),
              Text({
                content: `Collisions: ${errors.collisions}`,
                fg: errors.collisions > 0 ? "yellow" : undefined,
              }),
              Text({
                content: "  |  ",
                attributes: TextAttributes.DIM,
              }),
              Text({
                content: `Overflow: ${errors.overflow}`,
                fg: errors.overflow > 0 ? "yellow" : undefined,
              }),
              Text({
                content: "  |  ",
                attributes: TextAttributes.DIM,
              }),
              Text({
                content: `Total: ${errors.total}`,
                fg: errors.total > 0 ? "red" : "green",
                attributes: TextAttributes.BOLD,
              })
            )
          )
        : null,

	// Трафик
	traffic
	? Box(
	{
	flexDirection: "column",
	marginBottom: 1,
	padding: 1,
	border: true,
	borderStyle: "single",
	borderColor: "gray",
	},
			Text({
				content: "📈 Трафик",
				attributes: TextAttributes.BOLD,
			}),
			Box({ height: 1 }),
            // Входящий трафик
            Box(
              {
                flexDirection: "column",
                marginBottom: 1,
              },
              Text({
                content: "Входящий:",
                attributes: TextAttributes.DIM,
              }),
              createTrafficBar(traffic.inOctets, traffic.inUcastPkts, "green")
            ),
            // Исходящий трафик
            Box(
              {
                flexDirection: "column",
              },
              Text({
                content: "Исходящий:",
                attributes: TextAttributes.DIM,
              }),
              createTrafficBar(traffic.outOctets, traffic.outUcastPkts, "cyan")
            )
          )
        : null
    );
  }

  return {
    render,
    handleKey,
    onEnter: () => {
      const state = store.getState();
      if (!state.switchData) {
        loadSwitchData();
      }
    },
    onExit: () => {
      spinner.stop();
    },
  };
}

// === Вспомогательные функции ===

function createTrafficBar(bytes: number, packets: number, fg: string) {
  const mb = bytes / (1024 * 1024);
  const percentage = Math.min(mb / 100, 1); // Максимум 100 MB
  const filled = Math.round(percentage * 20);
  const empty = 20 - filled;

  return Box(
    {
      flexDirection: "row",
      alignItems: "center",
    },
    Text({
      content: "█".repeat(filled),
      fg,
    }),
    Text({
      content: "░".repeat(empty),
      fg: "gray",
    }),
    Text({
      content: ` ${formatBytes(bytes)} (${formatNumber(packets)} pkt)`,
      attributes: TextAttributes.DIM,
    })
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatNumber(num: number): string {
  return num.toLocaleString("ru-RU");
}

// === Заглушки для тестирования ===

function generateMockPortStatus(port: number): PortStatus {
  return {
    port,
    status: "up",
    speed: 100,
    duplex: "full",
    flowControl: true,
  };
}

function generateMockPortErrors(port: number): PortErrors {
  return {
    port,
    crcErrors: 0,
    collisions: 0,
    fcsErrors: 0,
    overflow: 0,
    total: 0,
  };
}

function generateMockPortTraffic(port: number): PortTraffic {
  return {
    port,
    inOctets: 12345678,
    outOctets: 23456789,
    inUcastPkts: 12345,
    outUcastPkts: 23456,
    inErrors: 0,
    outErrors: 0,
  };
}
