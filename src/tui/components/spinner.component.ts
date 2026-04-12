/**
 * Компонент индикатора загрузки
 * Анимированный спиннер для отображения процесса загрузки
 */

import { Box, Text, TextAttributes } from "@opentui/core";

// === Константы ===

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const DOTS_FRAMES = ["⠄", "⠆", "⠇", "⠋", "⠙", "⠸", "⠴", "⠦"];
const BAR_FRAMES = ["[          ]", "[=         ]", "[==        ]", "[===       ]", "[====      ]", "[=====     ]", "[======    ]", "[=======   ]", "[========  ]", "[========= ]", "[==========]"];

// === Типы ===

export type SpinnerStyle = "dots" | "bar" | "arrow";

export interface SpinnerProps {
  label?: string;
  style?: SpinnerStyle;
  fg?: string;
}

// === Компонент ===

export function createSpinner(props: SpinnerProps = {}) {
  const { label = "Загрузка", style = "dots", fg = "cyan" } = props;

  let frameIndex = 0;
  let intervalId: Timer | null = null;

  const frames = style === "bar" ? BAR_FRAMES : style === "arrow" ? DOTS_FRAMES : SPINNER_FRAMES;

  function render() {
    const frame = frames[frameIndex];

    return Box(
      {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
      },
      Text({
        content: `${frame} `,
        fg,
        attributes: TextAttributes.BOLD,
      }),
      Text({
        content: `${label}...`,
        attributes: TextAttributes.DIM,
      })
    );
  }

  function tick() {
    frameIndex = (frameIndex + 1) % frames.length;
  }

  function start(interval: number = 80) {
    if (intervalId) return;
    intervalId = setInterval(tick, interval);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    render,
    tick,
    start,
    stop,
  };
}

// === Специализированные спиннеры ===

/**
 * Спиннер для поиска
 */
export function createSearchSpinner() {
  return createSpinner({
    label: "Поиск",
    style: "dots",
    fg: "cyan",
  });
}

/**
 * Спиннер для подключения
 */
export function createConnectionSpinner(target: string) {
  return createSpinner({
    label: `Подключение к ${target}`,
    style: "dots",
    fg: "yellow",
  });
}

/**
 * Прогресс-бар
 */
export function createProgressBar(
  current: number,
  total: number,
  label: string = "Прогресс"
) {
  const percentage = Math.min(Math.max((current / total) * 100, 0), 100);
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;

  function render() {
    return Box(
      {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
      },
      Text({
        content: `${label}: ${current}/${total}`,
        attributes: TextAttributes.DIM,
      }),
      Box(
        {
          flexDirection: "row",
          marginTop: 1,
        },
        Text({
          content: "█".repeat(filled),
          fg: "green",
        }),
        Text({
          content: "░".repeat(empty),
          fg: "gray",
        }),
        Text({
          content: ` ${percentage.toFixed(0)}%`,
          attributes: TextAttributes.BOLD,
        })
      )
    );
  }

  return {
    render,
    getPercentage: () => percentage,
  };
}

/**
 * Индикатор статуса с цветом
 */
export function createStatusIndicator(
  status: "success" | "error" | "warning" | "loading",
  message: string
) {
  const statusConfig = {
    success: { icon: "✓", fg: "green" },
    error: { icon: "✗", fg: "red" },
    warning: { icon: "⚠", fg: "yellow" },
    loading: { icon: "◌", fg: "cyan" },
  };

  const config = statusConfig[status];

  function render() {
    return Box(
      {
        flexDirection: "row",
        alignItems: "center",
      },
      Text({
        content: `${config.icon} `,
        fg: config.fg,
        attributes: TextAttributes.BOLD,
      }),
      Text({
        content: message,
      })
    );
  }

  return {
    render,
  };
}
