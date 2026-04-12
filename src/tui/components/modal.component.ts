/**
 * Компонент модального окна
 * Используется для справки, ошибок и диалогов
 */

import { Box, Text, TextAttributes } from "@opentui/core";

// === Типы ===

export interface ModalProps {
  title: string;
  content: string | string[];
  width?: number;
  onClose?: () => void;
}

// === Компонент ===

export function createModal(props: ModalProps) {
  const { title, content, width = 60, onClose } = props;
  const lines = Array.isArray(content) ? content : [content];

  function render() {
    return Box(
      {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
      Box(
        {
          width,
          flexDirection: "column",
          borderColor: "white",
          backgroundColor: "black",
        },
      // Заголовок
      Box(
        {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        Text({
          content: title,
          attributes: TextAttributes.BOLD,
        }),
        Text({
          content: "[X]",
          attributes: TextAttributes.DIM,
        })
      ),

      // Контент
      Box(
        {
          flexDirection: "column",
          padding: 1,
        },
        ...lines.map((line) =>
          Text({
            content: line,
          })
        )
      ),

      // Кнопка закрытия
      Box(
        {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          padding: 1,
        },
        Text({
          content: "[ Enter ] Закрыть",
          attributes: TextAttributes.BOLD,
          fg: "cyan",
        })
      )
    )
  );
  }

  return {
    render,
  };
}

// === Специализированные модальные окна ===

/**
 * Модальное окно справки
 */
export function createHelpModal(onClose?: () => void) {
  const content = [
    "НАВИГАЦИЯ",
    "────────────────────────────────────────",
    "↑/↓/←/→     Перемещение по списку",
    "Enter        Выбрать / Подтвердить",
    "Tab          Переключение между полями",
    "Esc          Назад / Выход",
    "",
    "ПОИСК",
    "────────────────────────────────────────",
    "F3           Быстрый поиск",
    "Ctrl+F       Расширенный поиск",
    "",
    "ДЕЙСТВИЯ",
    "────────────────────────────────────────",
    "D            Диагностика абонента",
    "S            Подключение к Switch",
    "O            Подключение к OLT",
    "R            Обновить данные",
    "F5           Обновить текущий экран",
    "",
    "ОКНО",
    "────────────────────────────────────────",
    "F1           Справка",
    "F10          Выход",
  ];

  return createModal({
    title: "СПРАВКА",
    content,
    width: 50,
    onClose,
  });
}

/**
 * Модальное окно ошибки
 */
export function createErrorModal(
  title: string,
  message: string,
  details?: string[],
  onClose?: () => void
) {
  const content = [
    message,
    "",
    ...(details || []),
    "",
    "Рекомендации:",
    "• Проверьте подключение к сети",
    "• Убедитесь, что сервис доступен",
    "• Попробуйте повторить запрос позже",
  ];

  return createModal({
    title: `⚠ ${title}`,
    content,
    width: 60,
    onClose,
  });
}

/**
 * Модальное окно подтверждения
 */
export function createConfirmModal(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel: () => void
) {
  function render() {
    return Box(
      {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      },
      Box(
        {
          width: 50,
          flexDirection: "column",
          borderColor: "yellow",
          backgroundColor: "black",
        },
        // Заголовок
        Box(
          {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            padding: 1,
          },
          Text({
            content: title,
            attributes: TextAttributes.BOLD,
            fg: "yellow",
          })
        ),

        // Сообщение
        Box(
          {
            flexDirection: "column",
            alignItems: "center",
            padding: 1,
          },
          Text({
            content: message,
          })
        ),

        // Кнопки
        Box(
          {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            padding: 1,
          },
          Text({
            content: "[ Y ] Да ",
            attributes: TextAttributes.BOLD,
            fg: "green",
          }),
          Text({
            content: "[ N ] Нет",
            attributes: TextAttributes.BOLD,
            fg: "red",
          })
        )
      )
    );
  }

  return {
    render,
    onConfirm,
    onCancel,
  };
}
