/**
 * Компонент таблицы
 * Отображает данные в виде таблицы с навигацией
 */

import { Box, Text, TextAttributes } from "@opentui/core";

// === Типы ===

export interface TableColumn<T> {
  key: keyof T | string;
  title: string;
  width: number;
  align?: "left" | "center" | "right";
  fg?: string;
  format?: (value: any, row: T) => string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
  onHighlight?: (index: number) => void;
  showHeader?: boolean;
  showBorders?: boolean;
  emptyMessage?: string;
}

// === Компонент ===

export function createTable<T extends Record<string, any>>(
  props: TableProps<T>
) {
  const {
    columns,
    data,
    selectedIndex,
    onSelect,
    onHighlight,
    showHeader = true,
    showBorders = true,
    emptyMessage = "Нет данных",
  } = props;

  function render() {
    // Пустая таблица
    if (data.length === 0) {
      return Box(
        {
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 1,
          padding: 2,
        },
        Text({
          content: emptyMessage,
          attributes: TextAttributes.DIM,
        })
      );
    }

    return Box(
      { flexDirection: "column", width: "100%", flexGrow: 1 },
      // Заголовок таблицы
      showHeader
        ? Box(
            {
              flexDirection: "row",
              width: "100%",
              paddingBottom: 1,
              marginBottom: 1,
            },
            ...columns.map((col) =>
              Text({
                content: padString(col.title, col.width, col.align),
                attributes: TextAttributes.BOLD,
                fg: "gray",
              })
            )
          )
        : null,

      // Строки данных
      ...data.map((row, index) =>
        Box(
          {
            flexDirection: "row",
            width: "100%",
            paddingLeft: index === selectedIndex ? 1 : 0,
            backgroundColor: index === selectedIndex ? "blue" : undefined,
          },
          ...columns.map((col) => {
            const value = getNestedValue(row, col.key as string);
            const formattedValue = col.format
              ? col.format(value, row)
              : String(value ?? "");

            return Text({
              content: padString(formattedValue, col.width, col.align),
              attributes: index === selectedIndex
                ? TextAttributes.BOLD
                : undefined,
              fg: index === selectedIndex
                ? "white"
                : col.fg || undefined,
            });
          })
        )
      )
    );
  }

  return {
    render,
  };
}

// === Вспомогательные функции ===

/**
 * Получение вложенного значения из объекта
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

/**
 * Дополнение строки до указанной ширины
 */
function padString(
  str: string,
  width: number,
  align: "left" | "center" | "right" = "left"
): string {
  const len = getStringWidth(str);
  const diff = width - len;

  if (diff <= 0) {
    return str.slice(0, width);
  }

  switch (align) {
    case "left":
      return str + " ".repeat(diff);
    case "right":
      return " ".repeat(diff) + str;
    case "center":
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return " ".repeat(left) + str + " ".repeat(right);
    default:
      return str;
  }
}

/**
 * Вычисление ширины строки (учитывая кириллицу)
 */
function getStringWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    // Кириллица и другие "широкие" символы
    width += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return width;
}

// === Специализированные таблицы ===

/**
 * Таблица результатов поиска абонентов
 */
export function createAbonentSearchTable(
  abonents: Array<{
    account: string;
    fullName: string;
    address: { full: string };
    status: string;
  }>,
  selectedIndex: number,
  onSelect?: (index: number) => void
) {
  return createTable({
    columns: [
      { key: "account", title: "Лицевой счёт", width: 14 },
      { key: "fullName", title: "ФИО", width: 28 },
      { key: "address.full", title: "Адрес", width: 32 },
      {
        key: "status",
        title: "Статус",
        width: 12,
        fg: (value: string) => {
          switch (value) {
            case "active":
              return "green";
            case "blocked":
              return "red";
            case "suspended":
              return "yellow";
            default:
              return "gray";
          }
        },
        format: (value: string) => {
          const labels: Record<string, string> = {
            active: "Активен",
            blocked: "Заблокирован",
            suspended: "Приостановлен",
            disconnected: "Отключён",
          };
          return labels[value] || value;
        },
      },
    ],
    data: abonents,
    selectedIndex,
    onSelect,
    emptyMessage: "Введите критерий поиска",
  });
}

/**
 * Таблица оборудования абонента
 */
export function createEquipmentTable(
  equipment: Array<{
    type: string;
    model: string;
    mac: string;
    ip?: string;
    port?: number;
  }>,
  selectedIndex: number,
  onSelect?: (index: number) => void
) {
  return createTable({
    columns: [
      {
        key: "type",
        title: "Тип",
        width: 8,
        format: (value: string) => {
          const labels: Record<string, string> = {
            switch: "Switch",
            olt: "OLT",
            onu: "ONU",
            router: "Router",
          };
          return labels[value] || value;
        },
      },
      { key: "model", title: "Модель", width: 18 },
      { key: "mac", title: "MAC", width: 18 },
      { key: "ip", title: "IP", width: 16 },
      { key: "port", title: "Порт", width: 8, align: "center" },
    ],
    data: equipment,
    selectedIndex,
    onSelect,
    emptyMessage: "Нет оборудования",
  });
}
