/**
 * DHCP log client
 * Queries the DHCP server log page for a given MAC address and extracts
 * DHCP message types (DISCOVER/OFFER/REQUEST/ACK/NAK) with timestamps.
 */

export interface DhcpEntry {
  type: "discover" | "offer" | "request" | "ack" | "nak" | "unknown";
  mac: string;
  ip?: string;
  timestamp: string;
  raw: string;
}

export interface DhcpInfo {
  mac: string;
  entries: DhcpEntry[];
  hasDiscover: boolean;
  hasOffer: boolean;
  hasRequest: boolean;
  hasAck: boolean;
  hasNak: boolean;
  success: boolean; // true when at least one DHCPACK present
  lastAcquireTime: string | undefined; // timestamp of the last DHCPACK
  error: string | null;
  loading: boolean;
}

const EMPTY: DhcpInfo = {
  mac: "",
  entries: [],
  hasDiscover: false,
  hasOffer: false,
  hasRequest: false,
  hasAck: false,
  hasNak: false,
  success: false,
  lastAcquireTime: undefined,
  error: null,
  loading: false,
};

function b64(str: string): string {
  return Buffer.from(str).toString("base64");
}

function parseDhcpTimestamp(text: string): string | undefined {
  // Common timestamp patterns: 2024-01-15 10:30:45, 15/01/2024 10:30:45, etc.
  const patterns = [
    /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/,
    /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
    /(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/,
    /(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/,
    /(\d{2}:\d{2}:\d{2})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

function classifyType(text: string): DhcpEntry["type"] {
  const upper = text.toUpperCase();
  if (upper.includes("DHCPACK")) return "ack";
  if (upper.includes("DHCPNAK")) return "nak";
  if (upper.includes("DHCPOFFER")) return "offer";
  if (upper.includes("DHCPREQUEST")) return "request";
  if (upper.includes("DHCPDISCOVER")) return "discover";
  return "unknown";
}

function extractMac(text: string): string {
  const m = text.match(/([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/);
  return m ? m[0] : "";
}

function extractIp(text: string): string | undefined {
  const m = text.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  return m ? m[1] : undefined;
}

export function createDhcpClient(config: { baseUrl: string; username: string; password: string }) {
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  async function fetchDhcpLogs(mac: string): Promise<DhcpInfo> {
    const result: DhcpInfo = { ...EMPTY, mac, loading: true };

    if (!mac) {
      result.loading = false;
      return result;
    }

    const url = `${baseUrl}/logs/?dhcplog_search=${encodeURIComponent(mac)}`;

    try {
      const auth = b64(`${config.username}:${config.password}`);
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        result.error = `DHCP HTTP ${response.status}`;
        result.loading = false;
        return result;
      }

      const html = await response.text();
      const entries: DhcpEntry[] = [];

      // Split into log lines/rows. Look for table rows or lines containing DHCP keywords.
      const lines = html.split(/<br\s*\/?>|<\/tr>|\n|\r/).map(l => l.replace(/<[^>]*>/g, " ").trim()).filter(l => l.length > 0);

      const dhcpKeyword = /dhcp(discover|offer|request|ack|nak)/i;
      for (const line of lines) {
        if (!dhcpKeyword.test(line)) continue;
        const type = classifyType(line);
        const ts = parseDhcpTimestamp(line) || "";
        const mac = extractMac(line);
        const ip = extractIp(line);
        entries.push({ type, mac, ip, timestamp: ts, raw: line });
      }

      entries.sort((a, b) => {
        // crude sort: ACKs first by timestamp presence, then by order
        const pa = a.timestamp ? new Date(a.timestamp.replace(" ", "T")).getTime() : 0;
        const pb = b.timestamp ? new Date(b.timestamp.replace(" ", "T")).getTime() : 0;
        return pb - pa;
      });

      const hasAck = entries.some(e => e.type === "ack");
      const ackEntries = entries.filter(e => e.type === "ack");
      const lastAck = ackEntries.length > 0 ? ackEntries[0]!.timestamp : undefined;

      result.entries = entries;
      result.hasDiscover = entries.some(e => e.type === "discover");
      result.hasOffer = entries.some(e => e.type === "offer");
      result.hasRequest = entries.some(e => e.type === "request");
      result.hasAck = hasAck;
      result.hasNak = entries.some(e => e.type === "nak");
      result.success = hasAck;
      result.lastAcquireTime = lastAck || undefined;
      result.loading = false;
    } catch (err) {
      result.error = err instanceof Error ? err.message : "DHCP error";
      result.loading = false;
    }

    return result;
  }

  return { fetchDhcpLogs };
}
