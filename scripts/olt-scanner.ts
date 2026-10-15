#!/usr/bin/env bun

import { Socket } from 'net';

const CONCURRENCY = 8;
const COMMAND_TIMEOUT_MS = 15000;

interface OltAddress {
  ip: string;
  port: number;
}

interface TelnetConfig {
  username: string;
  password: string;
  timeout: number;
}

async function readAddresses(filePath: string): Promise<OltAddress[]> {
  const content = await Bun.file(filePath).text();
  const lines = content.split('\n').filter(line => line.trim() !== '');

  return lines.map(line => {
    const [ip, port = '23'] = line.split(':');
    return {
      ip: ip!.trim(),
      port: parseInt(port.trim(), 10) || 23
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

function parsePortStats(output: string): { port: string; subscribers: number; wireDown: number; dynamicOnu: number }[] {
  const portStats: { port: string; subscribers: number; wireDown: number; dynamicOnu: number }[] = [];
  const interfaceRegex = /Interface (EPON\S+)/g;
  let match;

  while ((match = interfaceRegex.exec(output)) !== null) {
    const portName = match[1]!;
    const startIndex = match.index;

    const savedLastIndex = interfaceRegex.lastIndex;
    const nextMatch = interfaceRegex.exec(output);
    const endIndex = nextMatch ? nextMatch.index : output.length;
    interfaceRegex.lastIndex = savedLastIndex;

    const portData = output.slice(startIndex, endIndex);

    const subscribersMatch = portData.match(/has registered (\d+) ONUs/);
    const subscribers = subscribersMatch ? parseInt(subscribersMatch[1]!, 10) : 0;

    const wireDownCount = (portData.match(/wire-down/g) || []).length;
    const dynamicOnuCount = (portData.match(/\bdynamic\b/g) || []).length;

    portStats.push({
      port: portName,
      subscribers,
      wireDown: wireDownCount,
      dynamicOnu: dynamicOnuCount
    });
  }

  return portStats;
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

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
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

    const checkComplete = () => {
      const lines = buffer.split('\n');
      const lastLine = lines[lines.length - 1];

      if (lastLine && endMarker.test(lastLine) && !hasMore) {
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
    };

    const onEnd = () => finish();
    const onClose = () => finish();
    const onError = (err: Error) => finish(err);

    const timeout = setTimeout(() => finish(new Error(`Timeout waiting for command output (${endMarker})`)), timeoutMs);

    socket.on('data', onData);
    socket.on('end', onEnd);
    socket.on('close', onClose);
    socket.on('error', onError);
  });
}

async function processOltWithSocket(addr: OltAddress, config: TelnetConfig): Promise<string[]> {
  const socket = await connectTelnet(addr.ip, addr.port, config);
  const rows: string[] = [];

  let fullBuffer = '';

    const dataHandler = (data: Buffer) => {
    const chunk = data.toString();
    fullBuffer += chunk;
  };
  socket.on('data', dataHandler);

  try {
    socket.write(`${config.username}\r\n`);
    fullBuffer = await waitForPattern(socket, 'Password:', 5000);

    socket.write(`${config.password}\r\n`);
    fullBuffer = await waitForPattern(socket, /[>#]/, 5000);

    if (fullBuffer.includes('>')) {
      socket.write('enable\r\n');
      fullBuffer = await waitForPattern(socket, '#', 5000);
    }

    socket.off('data', dataHandler);

    socket.write('show epon onu-information\r\n');

    const commandOutput = await collectUntilEnd(socket, /^[^\n]*#/m);

    const portStats = parsePortStats(commandOutput);

    for (const ps of portStats) {
      const oltPort = ps.port.replace('EPON', '');
      rows.push(
        `${addr.ip}\t${oltPort}\t${ps.subscribers}\t\t${ps.wireDown}\t\t${ps.dynamicOnu}`
      );
    }

    socket.end();
    return rows;
  } catch (error) {
    socket.destroy();
    throw error;
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

async function main() {
  const startTime = performance.now();
  const args = Bun.argv.slice(2);
  let addresses: OltAddress[];

  if (args.length > 0) {
    addresses = args.map(ip => ({ ip, port: 23 }));
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

  console.log('=== OLT Report ===');
  console.log('IP\t\tPort\tSubscribers\tWire-Down\tDynamic ONU');
  console.log('-'.repeat(70));

  let failed = 0;

  const reports = await mapLimit(addresses, CONCURRENCY, async (addr) => {
    try {
      return await processOltWithSocket(addr, config);
    } catch (error) {
      failed++;
      console.error(`Error processing ${addr.ip}:${addr.port}: ${error}`);
      return [];
    }
  });

  for (const rows of reports) {
    for (const row of rows) {
      console.log(row);
    }
  }

  const endTime = performance.now();
  const elapsedTime = (endTime - startTime) / 1000;
  console.log('-'.repeat(70));
  console.log(`Done in ${elapsedTime.toFixed(2)}s`);

  if (failed > 0) {
    console.error(`${failed} of ${addresses.length} OLT(s) failed`);
    process.exitCode = 1;
  }
}

main().catch(console.error);
