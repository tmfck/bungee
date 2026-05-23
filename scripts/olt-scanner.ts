#!/usr/bin/env bun

import { Socket } from 'net';

interface OltAddress {
  ip: string;
  port: number;
}

interface PortReport {
  ip: string;
  oltPort: string;
  subscribers: number;
  wireDown: number;
  dynamicOnu: number;
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

async function processOltWithSocket(ip: string, config: TelnetConfig): Promise<void> {
  const socket = await connectTelnet(ip, 23, config);

  let fullBuffer = '';
  const dataHandler = (data: Buffer) => {
    fullBuffer += data.toString();
  };
  socket.on('data', dataHandler);

  try {
    socket.write(`${config.username}\r\n`);
    await Bun.sleep(1000);

    if (!fullBuffer.includes('Password:')) {
      throw new Error('Did not receive Password prompt');
    }

    socket.write(`${config.password}\r\n`);
    await Bun.sleep(1000);

    if (fullBuffer.includes('>')) {
      socket.write('enable\r\n');
      await Bun.sleep(1000);
    }

    if (!fullBuffer.includes('#')) {
      throw new Error('Not in enable mode');
    }

    socket.write('terminal length 0\r\n');
    await Bun.sleep(500);

    fullBuffer = '';
    socket.write('show epon onu-information\r\n');
    await Bun.sleep(1000);

    let lastLength = 0;
    let stableCount = 0;

    while (stableCount < 3) {
      await Bun.sleep(1000);

      if (fullBuffer.includes('--More--')) {
        socket.write(' ');
        stableCount = 0;
      } else if (fullBuffer.length === lastLength) {
        stableCount++;
      } else {
        stableCount = 0;
        lastLength = fullBuffer.length;
      }
    }

    socket.off('data', dataHandler);

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

  console.log('-'.repeat(70));
  console.log('Done');
}

main();
