export function formatTraffic(octets: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = octets;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${value} ${units[unitIndex]}`;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function getPortStatusBg(status: "up" | "down" | undefined): string {
  if (status === "down") return "#440000";
  if (status === "up") return "#004400";
  return "#222";
}

export function getPortStatusText(status: "up" | "down" | undefined): string {
  if (status === "down") return "down";
  if (status === "up") return "up";
  return "—";
}

export function getLinkSpeedBg(speed: number | undefined): string {
  if (!speed) return "#440000";
  if (speed === 10) return "#442200";
  if (speed === 100) return "#006600";
  if (speed >= 1000) return "#008800";
  return "#222";
}

export function getLinkSpeedText(speed: number | undefined): string {
  if (!speed) return "—";
  if (speed >= 1000) return `${speed / 1000}G`;
  return `${speed}M`;
}
