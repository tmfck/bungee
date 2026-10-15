/** 
 * Модальное окно справки
 * Отображает список горячих клавиш
 */

import { For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";

interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal(props: HelpModalProps) {
  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "f1" || key.name === "q") {
      props.onClose();
      return true;
    }
    return false;
  });

const shortcuts = [
  { key: "F1", description: "Справка" },
  { key: "F3", description: "Поиск абонента" },
  { key: "F10", description: "Выход" },
  { key: "F12", description: "Консоль отладки" },
  { key: "ESC", description: "Назад/Закрыть" },
  { key: "↑/↓", description: "Навигация по списку" },
  { key: "Enter", description: "Выбор" },
  { key: "Клик", description: "Выбор элементов" },
];

  return (
    <box
      position="absolute"
      top="25%"
      left="25%"
      width="50%"
      border
      borderStyle="double"
      borderColor="#00d9ff"
      backgroundColor="#1a1a2e"
      paddingX={2}
    >
      <box flexDirection="column">
        <text fg="#00d9ff" attributes={TextAttributes.BOLD} paddingBottom={1}>
          📖 Справка - Горячие клавиши
        </text>

        <For each={shortcuts}>
          {(shortcut) => (
            <box flexDirection="row" gap={2} marginBottom={1}>
              <text width={10} fg="#ffd700">{shortcut.key}</text>
              <text>{shortcut.description}</text>
            </box>
          )}
        </For>

        <text fg="#666">
          ESC или Q - закрыть
        </text>
      </box>
    </box>
  );
}
