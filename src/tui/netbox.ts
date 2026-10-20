/**
 * NetBox API client
 * Queries NetBox for device interface / VLAN / IP information.
 * Used to determine port VLAN state (untagged VLAN count) and port details.
 */

export interface NetBoxVlan {
  id: number;
  name: string;
  vid: number;
}

export interface NetBoxIpAddress {
  address: string; // e.g. "10.10.20.5/24"
  ip: string; // just the IP part
  description?: string;
}

export interface NetBoxPortInfo {
  interfaceName: string;
  interfaceType?: string;
  macAddress?: string;
  enabled: boolean;
  untaggedVlan: NetBoxVlan | null;
  taggedVlans: NetBoxVlan[];
  ipAddresses: NetBoxIpAddress[];
  connectedEndpoint?: {
    device: string;
    interface: string;
  };
  error: string | null;
  loading: boolean;
}

const EMPTY_PORT: NetBoxPortInfo = {
  interfaceName: "",
  enabled: false,
  untaggedVlan: null,
  taggedVlans: [],
  ipAddresses: [],
  error: null,
  loading: false,
};

function b64(str: string): string {
  return Buffer.from(str).toString("base64");
}

async function fetchJson<T>(url: string, username: string, password: string, signal?: AbortSignal): Promise<T> {
  const auth = b64(`${username}:${password}`);
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`NetBox HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function createNetBoxClient(config: { baseUrl: string; username: string; password: string }) {
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  async function getPortInfo(ip: string, port: number | undefined): Promise<NetBoxPortInfo> {
    const result: NetBoxPortInfo = { ...EMPTY_PORT, loading: true };

    if (!ip || !port) {
      result.error = "No switch IP or port";
      result.loading = false;
      return result;
    }

    try {
      // 1. Find device by primary IP
      const devicesUrl = `${baseUrl}/api/dcim/devices/?primary_ip=${encodeURIComponent(ip)}`;
      const devices = await fetchJson<{ count: number; results: any[] }>(devicesUrl, config.username, config.password, AbortSignal.timeout(15000));

      if (devices.count === 0 || devices.results.length === 0) {
        result.error = `Device not found for IP ${ip}`;
        result.loading = false;
        return result;
      }

      const device = devices.results[0];
      const deviceId = device.id;

      // 2. Get interfaces for the device
      const ifacesUrl = `${baseUrl}/api/dcim/interfaces/?device_id=${deviceId}`;
      const ifaces = await fetchJson<{ count: number; results: any[] }>(ifacesUrl, config.username, config.password, AbortSignal.timeout(15000));

      // Try to match by port number (name like "1/4", "GigabitEthernet1/0/4", or just "4")
      const portStr = String(port);
      let iface: any = undefined;

      // Exact match on name first
      iface = ifaces.results.find((i: any) => i.name === portStr || i.name === `eth${portStr}` || i.name === `GigabitEthernet${portStr}`);

      // Fallback: match by name containing port number
      if (!iface) {
        iface = ifaces.results.find((i: any) => String(i.name || "").includes(portStr));
      }

      if (!iface) {
        result.error = `Interface port ${port} not found on device ${device.display_name ?? device.name}`;
        result.loading = false;
        return result;
      }

      const ifaceId = iface.id;

      // 3. Get VLANs for this interface (untagged + tagged)
      // NetBox: interface VLANs are accessed via the interface itself or /api/ipam/vlans/?interface=...
      const vlansUrl = `${baseUrl}/api/ipam/vlans/?interface_id=${ifaceId}`;
      let vlansData: { count: number; results: any[] } = { count: 0, results: [] };
      try {
        vlansData = await fetchJson<{ count: number; results: any[] }>(vlansUrl, config.username, config.password, AbortSignal.timeout(15000));
      } catch {
        // VLANs endpoint may not exist in older NetBox versions; continue with empty
      }

      const untagged = vlansData.results.find((v: any) => v.role === "untagged" || v.untagged_interface?.id === ifaceId);
      const tagged = vlansData.results.filter((v: any) => v.role === "tagged" || (v.tagged_interfaces || []).some((ti: any) => ti.id === ifaceId));

      // 4. Get IP addresses assigned to this interface
      const ipsUrl = `${baseUrl}/api/ipam/ip-addresses/?interface_id=${ifaceId}`;
      let ipsData: { count: number; results: any[] } = { count: 0, results: [] };
      try {
        ipsData = await fetchJson<{ count: number; results: any[] }>(ipsUrl, config.username, config.password, AbortSignal.timeout(15000));
      } catch {
        // continue with empty
      }

      const ipAddresses: NetBoxIpAddress[] = ipsData.results.map((a: any) => {
        const addr = a.address || "";
        const ipPart = addr.split("/")[0];
        return { address: addr, ip: ipPart, description: a.description || undefined };
      });

      // 5. Connected endpoint
      let connectedEndpoint: { device: string; interface: string } | undefined;
      if (iface.connected_endpoint) {
        const ce = iface.connected_endpoint;
        connectedEndpoint = {
          device: ce.device?.display_name ?? ce.device?.name ?? "",
          interface: ce.name ?? ce.interface ?? "",
        };
      } else if (iface.connected_interface) {
        connectedEndpoint = {
          device: iface.connected_interface.device?.display_name ?? iface.connected_interface.device?.name ?? "",
          interface: iface.connected_interface.name ?? "",
        };
      }

      result.interfaceName = iface.name ?? "";
      result.interfaceType = iface.type?.label ?? iface.type?.value ?? undefined;
      result.macAddress = iface.mac_address ?? undefined;
      result.enabled = iface.enabled ?? false;
      result.untaggedVlan = untagged ? { id: untagged.id, name: untagged.name, vid: untagged.vid } : null;
      result.taggedVlans = tagged.map((v: any) => ({ id: v.id, name: v.name, vid: v.vid }));
      result.ipAddresses = ipAddresses;
      result.connectedEndpoint = connectedEndpoint;
      result.loading = false;
    } catch (err) {
      result.error = err instanceof Error ? err.message : "NetBox error";
      result.loading = false;
    }

    return result;
  }

  return { getPortInfo };
}
