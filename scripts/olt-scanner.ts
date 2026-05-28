#!/usr/bin/env bun

import { Socket } from 'net';

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
      ip: ip.trim(),
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
  const portStats = [];
  const interfaceRegex = /Interface (EPON\S+)/g;
  let match;

  while ((match = interfaceRegex.exec(output)) !== null) {
    const portName = match[1];
    const startIndex = match.index;

    const savedLastIndex = interfaceRegex.lastIndex;
    const nextMatch = interfaceRegex.exec(output);
    const endIndex = nextMatch ? nextMatch.index : output.length;
    interfaceRegex.lastIndex = savedLastIndex;

    const portData = output.slice(startIndex, endIndex);

    const subscribersMatch = portData.match(/has registered (\d+) ONUs/);
    const subscribers = subscribersMatch ? parseInt(subscribersMatch[1], 10) : 0;

    const wireDownCount = (portData.match(/wire-down/g) || []).length;
    const dynamicOnuCount = (portData.match(/\bdynamic\b/g) || []).length;

    portStats.push({
      port: portName,
      subscribers,
      wireDown: wireDownCount,
      dynamicOnu: dynamicOnuCount
    });

    if (!nextMatch) break;
  }

  return portStats;
}

async function waitForPattern(socket: Socket, pattern: string | RegExp, timeoutMs: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.off('data', onData);
        reject(new Error(`Timeout waiting for pattern: ${pattern}`));
      }
    };

    const timeout = setTimeout(cleanup, timeoutMs);

    const onData = (data: Buffer) => {
      buffer += data.toString();
      
      const matches = typeof pattern === 'string' 
        ? buffer.includes(pattern) 
        : pattern.test(buffer);
      
      if (matches) {
        resolved = true;
        clearTimeout(timeout);
        socket.off('data', onData);
        resolve(buffer);
      }
    };

    socket.on('data', onData);
  });
}

async function collectUntilEnd(socket: Socket, endMarker: RegExp, debugIp?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let hasMore = false;
    let isResolved = false;
    
    const checkComplete = () => {
      const lines = buffer.split('\n');
      const lastLine = lines[lines.length - 1];
      
      if (lastLine && endMarker.test(lastLine) && !hasMore) {
        cleanup();
        resolve(buffer);
        return true;
      }
      return false;
    };

    const cleanup = () => {
      if (!isResolved) {
        isResolved = true;
        socket.off('data', onData);
        socket.off('end', onEnd);
        socket.off('close', onClose);
        socket.off('error', onError);
      }
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

    const onEnd = () => {
      cleanup();
      resolve(buffer);
    };

    const onClose = () => {
      cleanup();
      resolve(buffer);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    socket.on('data', onData);
    socket.on('end', onEnd);
    socket.on('close', onClose);
    socket.on('error', onError);
  });
}

async function processOltWithSocket(ip: string, config: TelnetConfig): Promise<void> {
  const socket = await connectTelnet(ip, 23, config);

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

    fullBuffer = '';
    socket.write('show epon onu-information\r\n');

    const commandOutput = await collectUntilEnd(socket, /^[^\n]*#/m);
    fullBuffer = commandOutput;

    const portStats = parsePortStats(fullBuffer);

    for (const ps of portStats) {
      const oltPort = ps.port.replace('EPON', '');
      console.log(
        `${ip}\t${oltPort}\t${ps.subscribers}\t\t${ps.wireDown}\t\t${ps.dynamicOnu}`
      );
    }

    socket.end();
  } catch (error) {
    socket.off('data', dataHandler);
    socket.end();
    throw error;
  }
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

  const config: TelnetConfig = {
    username: process.env.TELNET_OLT_USERNAME || 'admin',
    password: process.env.TELNET_OLT_PASSWORD || 'password',
    timeout: parseInt(process.env.TELNET_TIMEOUT || '5000', 10)
  };

  console.log('=== OLT Report ===');
  console.log('IP\t\tPort\tSubscribers\tWire-Down\tDynamic ONU');
  console.log('-'.repeat(70));

  for (const addr of addresses) {
    try {
      await processOltWithSocket(addr.ip, config);
    } catch (error) {
      console.error(`Error processing ${addr.ip}:23: ${error}`);
    }
  }

  const endTime = performance.now();
  const elapsedTime = (endTime - startTime) / 1000;
  console.log('-'.repeat(70));
  console.log(`Done in ${elapsedTime.toFixed(2)}s`);
}

main().catch(console.error);
