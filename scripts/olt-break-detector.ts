#!/usr/bin/env bun

import fs from 'fs';

/**
 * Детектор обрывов канала к ONU (режим сканера).
 *
 * Берёт адреса OLTs из файла data/olt-addresses.txt (или аргументов CLI),
 * авторизуется на каждом через telnet, запрашивает список неактивных ONU
 * по всем EPON-портам и находит группы ONU на одном порте со статусом
 * wire-down, отпавшие в одно и то же время или с разницей до заданного
 * окна (по умолчанию 1 минута). Такая групповая потеря связи признаётся
 * вероятным обрывом кабеля на порту.
 *
 * Использование:
 *   bun run scripts/olt-break-detector.ts [ip1 ip2 ...] [--window N]
 *   bun run scripts/olt-break-detector.ts 10.0.1.8 10.0.1.9 --window 2
 *   echo "10.0.1.8" | bun run scripts/olt-break-detector.ts -
 *
 * Переменные окружения (.env):
 *   TELNET_OLT_USERNAME, TELNET_OLT_PASSWORD, TELNET_TIMEOUT
 */

import { Socket } from 'net';

const CONCURRENCY = 8;
const COMMAND_TIMEOUT_MS = 30000;

interface OltAddress {
  ip: string;
  port: number;
}

interface TelnetConfig {
  username: string;
  password: string;
  timeout: number;
}

interface InactiveOnu {
  intfName: string; // EPON0/10:3
  mac: string; // 9845.62f8.d56b
  status: string; // deregistered
  lastRegTime: Date | null;
  lastDeregTime: Date | null;
  lastDeregReason: string; // wire-down | power-off | unknow
  absentTime: string; // 0.14:11:48
  port: string; // EPON0/10
  onu: string; // 3
}

interface BreakCluster {
  port: string;
  startTime: Date;
  endTime: Date;
  count: number;
  spanSeconds: number;
  onus: InactiveOnu[];
}

const WINDOW_DEFAULT_MINUTES = 1;
const INACTIVE_COMMAND = 'show epon inactive-onu';

// ROW: EPON0/10:3  9845.62f8.d56b deregistered  2026-10-19 17:35:33 2026-10-19 22:16:51 power-off  0.14:11:48
//      EPON0/10:5  9845.6212.a9a7 deregistered  N/A                 2026-09-28 17:18:36 unknow     21.19:10:03
const ROW_REGEX =
  /(EPON\S+)\s+([0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4})\s+(\S+)\s+(N\/A|\d{4}[-.]\d{2}[-.]\d{2})(?:[\s.]+(\d{2}:\d{2}:\d{2}))?\s+(N\/A|\d{4}[-.]\d{2}[-.]\d{2})(?:[\s.]+(\d{2}:\d{2}:\d{2}))?\s+(\S+)\s+(\S+)/;

function parseDateTime(date: string | undefined, time: string | undefined): Date | null {
  if (!date || date === "N/A" || !time) return null;
  const d = date.replace(/\./g, '-');
  return new Date(`${d}T${time}`);
}

function parseIntfName(intfName: string): { port: string; onu: string } {
  const lastColon = intfName.lastIndexOf(":");
  if (lastColon === -1) return { port: intfName, onu: "" };
  return { port: intfName.slice(0, lastColon), onu: intfName.slice(lastColon + 1) };
}

function parseInactiveOnuOutput(output: string): InactiveOnu[] {
  const onus: InactiveOnu[] = [];

  // Убрать escape-последовательности терминала (backspace при --More--, ANSI коды),
  // разрывы строк и набрать все строки ONU глобальным regex (\s+ между полями
  // покрывает любые пробелы/переносы).
  const cleaned = output
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // ANSI escape sequences
    .replace(/\x08/g, '')                   // backspace
    .replace(/\r/g, '');
  const flat = cleaned.replace(/\n/g, ' '); // строки склеиваются через пробел, а не срастаются
  const rowRegex = new RegExp(ROW_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(flat)) !== null) {
    const intfName = match[1]!;
    const mac = match[2]!;
    const status = match[3]!;
    const regDate = match[4]!;
    const regTime = match[5];
    const deregDate = match[6]!;
    const deregTime = match[7];
    const reason = match[8]!;
    const absent = match[9]!;

    const { port, onu } = parseIntfName(intfName);

    onus.push({
      intfName,
      mac,
      status,
      lastRegTime: parseDateTime(regDate, regTime),
      lastDeregTime: parseDateTime(deregDate, deregTime),
      lastDeregReason: reason,
      absentTime: absent,
      port,
      onu,
    });
  }

  return onus;
}

interface PortWireDown {
  port: string;
  onus: InactiveOnu[]; // все wire-down ONU на порту, отсортировано по времени
  clusters: BreakCluster[]; // кластеры (обрывы) внутри порта
}

function makeCluster(port: string, onus: InactiveOnu[]): BreakCluster {
  const times = onus.map((o) => o.lastDeregTime!.getTime());
  return {
    port,
    startTime: new Date(Math.min(...times)),
    endTime: new Date(Math.max(...times)),
    count: onus.length,
    spanSeconds: (Math.max(...times) - Math.min(...times)) / 1000,
    onus,
  };
}

function detectWireDown(onus: InactiveOnu[], windowMinutes = WINDOW_DEFAULT_MINUTES): PortWireDown[] {
  const wireDown = onus.filter(
    (o) => o.lastDeregReason.toLowerCase() === "wire-down" && o.lastDeregTime !== null
  );

  const byPort = new Map<string, InactiveOnu[]>();
  for (const onu of wireDown) {
    const list = byPort.get(onu.port) ?? [];
    list.push(onu);
    byPort.set(onu.port, list);
  }

  const windowMs = windowMinutes * 60 * 1000;
  const result: PortWireDown[] = [];

  for (const [port, list] of byPort) {
    list.sort((a, b) => a.lastDeregTime!.getTime() - b.lastDeregTime!.getTime());

    const clusters: BreakCluster[] = [];
    let current: InactiveOnu[] = [];
    for (const onu of list) {
      if (current.length === 0) {
        current = [onu];
        continue;
      }
      const gap = onu.lastDeregTime!.getTime() - current[current.length - 1]!.lastDeregTime!.getTime();
      if (gap <= windowMs) {
        current.push(onu);
      } else {
        if (current.length >= 2) clusters.push(makeCluster(port, current));
        current = [onu];
      }
    }
    if (current.length >= 2) clusters.push(makeCluster(port, current));

    result.push({ port, onus: list, clusters });
  }

  return result.sort((a, b) => b.onus.length - a.onus.length);
}

function fmtTime(d: Date): string {
  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
};

function formatReport(ip: string, port: number, pds: PortWireDown[], windowMinutes: number): string {
  const lines: string[] = [];
  lines.push(`${C.bold}=== OLT ${ip}:${port} ===${C.reset}`);

  const totalWireDown = pds.reduce((s, p) => s + p.onus.length, 0);
  const totalClusters = pds.reduce((s, p) => s + p.clusters.length, 0);

  if (totalWireDown === 0) {
    lines.push(`${C.green}wire-down ONU не найдено.${C.reset}`);
    return lines.join("\n");
  }

  lines.push(`${C.yellow}wire-down ONU: ${totalWireDown}${C.reset}, ${C.red}обрывов: ${totalClusters}${C.reset}`);

  for (const pd of pds) {
    const inCluster = new Set(pd.clusters.flatMap((c) => c.onus.map((o) => o.intfName)));
    lines.push(`${C.bold}Порт: ${pd.port} (wire-down: ${pd.onus.length})${C.reset}`);
    for (const onu of pd.onus) {
      const mark = inCluster.has(onu.intfName)
        ? `${C.red}[ОБРЫВ]${C.reset}`
        : `${C.yellow}[единично]${C.reset}`;
      lines.push(
        `    ${onu.intfName.padEnd(14)} ${onu.mac.padEnd(18)} ${fmtTime(onu.lastDeregTime!)}  wire-down  ${mark}`
      );
    }
    for (const cluster of pd.clusters) {
      lines.push(
        `    ${C.bold}>>> ОБРЫВ: ${cluster.count} ONU, ${fmtTime(cluster.startTime)} → ${fmtTime(cluster.endTime)} (разброс ${cluster.spanSeconds} с)${C.reset}`
      );
    }
    lines.push("");
  }

  lines.push(`${C.bold}Итого wire-down: ${totalWireDown}, обрывов: ${totalClusters}${C.reset}`);
  return lines.join("\n");
}

// === Telnet (по аналогии со сканером) ===

async function readAddresses(filePath: string): Promise<OltAddress[]> {
  const content = await Bun.file(filePath).text();
  const lines = content.split('\n').filter((line: string) => line.trim() !== '');
  return lines.map((line: string) => {
    const [ip, port = '23'] = line.split(':');
    return {
      ip: ip!.trim(),
      port: parseInt(port.trim(), 10) || 23,
    };
  });
}

function connectTelnet(ip: string, port: number, config: TelnetConfig): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Connection timeout to ${ip}:${port}`));
    }, config.timeout);

    socket.connect(port, ip, () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function waitForPattern(socket: Socket, pattern: string | RegExp, timeoutMs: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.off('data', onData);
      socket.off('error', onError);
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    };

    const onData = (data: Buffer) => {
      buffer += data.toString();

      const matches = typeof pattern === 'string'
        ? buffer.includes(pattern)
        : pattern.test(buffer);

      if (matches) {
        finish();
      }
    };

    const onError = (err: Error) => finish(err);

    const timeout = setTimeout(() => finish(new Error(`Timeout waiting for pattern: ${pattern}`)), timeoutMs);

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function collectUntilEnd(socket: Socket, endMarker: RegExp, timeoutMs: number = COMMAND_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let hasMore = false;
    let settled = false;
    let quietTimer: NodeJS.Timeout | null = null;
    let overallTimeout: NodeJS.Timeout | null = null;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (quietTimer) clearTimeout(quietTimer);
      if (overallTimeout) clearTimeout(overallTimeout);
      socket.off('data', onData);
      socket.off('end', onEnd);
      socket.off('close', onClose);
      socket.off('error', onError);
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    };

    const resetQuietTimer = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => finish(), 3000);
    };

    const checkComplete = () => {
      const trimmed = buffer.trimEnd();
      if (!hasMore && /#\s*$/.test(trimmed)) {
        finish();
        return true;
      }
      return false;
    };

    const onData = (data: Buffer) => {
      const chunk = data.toString();
      buffer += chunk;

      if (chunk.includes('--More--')) {
        hasMore = true;
        socket.write(' ');
      } else if (hasMore) {
        hasMore = false;
      }

      if (checkComplete()) return;
      resetQuietTimer();
    };

    const onEnd = () => finish();
    const onClose = () => finish();
    const onError = (err: Error) => finish(err);

    overallTimeout = setTimeout(() => finish(new Error(`Timeout waiting for command output (${endMarker})`)), timeoutMs);

    resetQuietTimer();

    socket.on('data', onData);
    socket.on('end', onEnd);
    socket.on('close', onClose);
    socket.on('error', onError);
  });
}

async function processOlt(addr: OltAddress, config: TelnetConfig, windowMinutes: number, debugPath?: string): Promise<{ pds: PortWireDown[]; error?: string }> {
  const socket = await connectTelnet(addr.ip, addr.port, config);

  let debugStream: { write: (s: string) => void; end: () => void } | undefined;
  if (debugPath) {
    const stream = fs.createWriteStream(debugPath, { flags: 'a' });
    debugStream = stream;
    const tee = (dir: string, data: Buffer | string) => {
      const text = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
      const safe = text.replace(/\r\n/g, '\\r\\n').replace(/\n/g, '\\n');
      stream.write(`[${addr.ip}] ${dir} ${safe}\n`);
    };
    const origWrite = socket.write.bind(socket);
    socket.write = ((chunk: any, ...rest: any[]) => {
      tee('SEND', chunk);
      return origWrite(chunk, ...rest);
    }) as any;
    socket.on('data', (chunk: Buffer) => tee('RECV', chunk));
  }

  try {
    socket.write(`${config.username}\r\n`);
    let buffer = await waitForPattern(socket, 'Password:', 5000);

    socket.write(`${config.password}\r\n`);
    buffer = await waitForPattern(socket, /[>#]/, 5000);

    if (buffer.includes('>')) {
      socket.write('enable\r\n');
      buffer = await waitForPattern(socket, '#', 5000);
    }

    // Terminal length off to avoid pagination
    socket.write(`${INACTIVE_COMMAND}\r\n`);

    const commandOutput = await collectUntilEnd(socket, /^[^\n]*#/m);

    const onus = parseInactiveOnuOutput(commandOutput);
    const pds = detectWireDown(onus, windowMinutes);

    if (debugPath) {
      socket.write('show epon onu-information\r\n');
      const onuInfo = await collectUntilEnd(socket, /^[^\n]*#/m);
      debugStream?.write(`[${addr.ip}] ONU-INFO\n${onuInfo.replace(/\r\n/g, '\\r\\n').replace(/\n/g, '\\n')}\n`);
    }

    socket.end();
    debugStream?.end();
    return { pds };
  } catch (error) {
    socket.destroy();
    debugStream?.end();
    return { pds: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!);
    }
  });

  await Promise.all(runners);
  return results;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.from(chunk));
    });
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}

function parseArgs(args: string[]): { inputs: string[]; windowMinutes: number } {
  let inputs: string[] = [];
  let windowMinutes = WINDOW_DEFAULT_MINUTES;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--window" || arg === "-w") {
      const val = parseInt(args[++i]!, 10);
      if (!Number.isNaN(val) && val > 0) windowMinutes = val;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Использование: bun run scripts/olt-break-detector.ts [ip...|-] [--window N]

Аргументы:
  ip          Адрес OLT (может быть несколько). Если не задан — читаются из data/olt-addresses.txt.
              Используйте '-' для чтения списка адресов из stdin (по одному на строку).
  --window N  Окно группировки wire-down ONU в минутах (по умолчанию ${WINDOW_DEFAULT_MINUTES}).

Пример:
  bun run scripts/olt-break-detector.ts 10.0.1.8 10.0.1.9 --window 2
  cat data/olt-addresses.txt | bun run scripts/olt-break-detector.ts -
`);
      process.exit(0);
    } else {
      inputs.push(arg);
    }
  }

  return { inputs, windowMinutes };
}

async function main() {
  const args = Bun.argv.slice(2);
  const { inputs, windowMinutes } = parseArgs(args);

  let addresses: OltAddress[];

  if (inputs.length > 0) {
    if (inputs[0] === "-") {
      const stdin = await readStdin();
      const ips = stdin.split('\n').map(l => l.trim()).filter(Boolean);
      addresses = ips.map(ip => ({ ip, port: 23 }));
    } else {
      addresses = inputs.map(ip => ({ ip, port: 23 }));
    }
  } else {
    const addressesFile = 'data/olt-addresses.txt';
    addresses = await readAddresses(addressesFile);
  }

  const username = process.env.TELNET_OLT_USERNAME;
  const password = process.env.TELNET_OLT_PASSWORD;

  if (!username || !password) {
    console.error('Error: TELNET_OLT_USERNAME and TELNET_OLT_PASSWORD must be set in .env');
    process.exit(1);
  }

  const config: TelnetConfig = {
    username,
    password,
    timeout: parseInt(process.env.TELNET_TIMEOUT || '5000', 10)
  };

  const debug = process.env.BUNGEE_DEBUG === '1';
  const debugPath = debug ? 'data/olt-break-debug.log' : undefined;
  if (debugPath) {
    fs.writeFileSync(debugPath, '', { flag: 'w' });
  }

  console.log(`=== Детектор обрывов ONU (все порты, окно ${windowMinutes} мин) ===`);
  console.log(`Адресов OLT: ${addresses.length}`);
  console.log('-'.repeat(70));

  let failed = 0;
  let totalBreaks = 0;
  let totalWireDown = 0;

  const reports = await mapLimit(addresses, CONCURRENCY, async (addr) => {
    const result = await processOlt(addr, config, windowMinutes, debugPath);
    if (result.error) {
      failed++;
      console.error(`Error processing ${addr.ip}:${addr.port}: ${result.error}`);
      return { ip: addr.ip, port: addr.port, pds: [], error: result.error };
    }
    totalBreaks += result.pds.reduce((s, p) => s + p.clusters.length, 0);
    totalWireDown += result.pds.reduce((s, p) => s + p.onus.length, 0);
    return { ip: addr.ip, port: addr.port, pds: result.pds };
  });

  for (const r of reports) {
    if (r.error) continue;
    console.log(formatReport(r.ip, r.port, r.pds, windowMinutes));
    console.log('-'.repeat(70));
  }

  console.log(`Всего wire-down: ${totalWireDown}, обрывов: ${totalBreaks}`);
  if (failed > 0) {
    console.error(`${failed} of ${addresses.length} OLT(s) failed`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`Непредвиденная ошибка: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
