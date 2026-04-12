/**
 * Хук для навигации по спискам и таблицам
 * Управляет выбранным элементом и прокруткой
 */

// === Интерфейсы ===

export interface NavigationOptions {
  itemCount: number;
  pageSize?: number;
  onSelect?: (index: number) => void;
  onChange?: (index: number) => void;
}

export interface NavigationState {
  selectedIndex: number;
  offset: number;
}

export interface NavigationHook {
  getState: () => NavigationState;
  up: () => void;
  down: () => void;
  left: () => void;
  right: () => void;
  pageUp: () => void;
  pageDown: () => void;
  home: () => void;
  end: () => void;
  select: () => void;
  setIndex: (index: number) => void;
  setItemCount: (count: number) => void;
  handleKey: (key: string) => boolean;
}

// === Хук ===

export function useNavigation(options: NavigationOptions): NavigationHook {
  const {
    itemCount: initialItemCount,
    pageSize = 10,
    onSelect,
    onChange,
  } = options;

  let state: NavigationState = {
    selectedIndex: 0,
    offset: 0,
  };

  let itemCount = initialItemCount;

  // Ограничение индекса в допустимых пределах
  function clampIndex(index: number): number {
    if (itemCount === 0) return 0;
    return Math.max(0, Math.min(index, itemCount - 1));
  }

  // Установка нового индекса
  function setIndex(index: number) {
    const newIndex = clampIndex(index);
    if (newIndex !== state.selectedIndex) {
      state = {
        ...state,
        selectedIndex: newIndex,
      };
      onChange?.(newIndex);
    }
  }

  // Обновление смещения для видимой области
  function updateOffset(viewportHeight: number) {
    const { selectedIndex } = state;
    const halfViewport = Math.floor(viewportHeight / 2);

    // Центрирование выбранного элемента
    let newOffset = selectedIndex - halfViewport;
    newOffset = Math.max(0, Math.min(newOffset, itemCount - viewportHeight));

    state = {
      ...state,
      offset: Math.max(0, newOffset),
    };
  }

  return {
    getState: () => state,

    up() {
      setIndex(state.selectedIndex - 1);
    },

    down() {
      setIndex(state.selectedIndex + 1);
    },

    left() {
      // Можно использовать для горизонтальной навигации
      setIndex(state.selectedIndex - 1);
    },

    right() {
      // Можно использовать для горизонтальной навигации
      setIndex(state.selectedIndex + 1);
    },

    pageUp() {
      setIndex(state.selectedIndex - pageSize);
    },

    pageDown() {
      setIndex(state.selectedIndex + pageSize);
    },

    home() {
      setIndex(0);
    },

    end() {
      setIndex(itemCount - 1);
    },

    select() {
      if (state.selectedIndex >= 0 && state.selectedIndex < itemCount) {
        onSelect?.(state.selectedIndex);
      }
    },

    setIndex,

    setItemCount(count: number) {
      itemCount = count;
      // Корректировка выбранного индекса если количество элементов уменьшилось
      if (state.selectedIndex >= count) {
        setIndex(count - 1);
      }
    },

    handleKey(key: string): boolean {
      switch (key.toLowerCase()) {
        case "up":
        case "k":
          this.up();
          return true;
        case "down":
        case "j":
          this.down();
          return true;
        case "left":
          this.left();
          return true;
        case "right":
          this.right();
          return true;
        case "pageup":
          this.pageUp();
          return true;
        case "pagedown":
          this.pageDown();
          return true;
        case "home":
          this.home();
          return true;
        case "end":
          this.end();
          return true;
        case "return":
        case "enter":
          this.select();
          return true;
        default:
          return false;
      }
    },
  };
}

// === Вспомогательные функции ===

/**
 * Вычисляет видимый диапазон элементов
 */
export function getVisibleRange(
  selectedIndex: number,
  itemCount: number,
  viewportHeight: number
): { start: number; end: number } {
  const halfViewport = Math.floor(viewportHeight / 2);

  let start = selectedIndex - halfViewport;
  start = Math.max(0, Math.min(start, itemCount - viewportHeight));

  const end = Math.min(start + viewportHeight, itemCount);

  return { start, end };
}

/**
 * Проверяет, виден ли элемент с указанным индексом
 */
export function isIndexVisible(
  index: number,
  offset: number,
  viewportHeight: number
): boolean {
  return index >= offset && index < offset + viewportHeight;
}
