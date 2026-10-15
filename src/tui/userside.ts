/**
 * UserSide API client
 */

export interface UserSideConfig {
    baseUrl: string;
    cookie: string;
}

const REQUEST_TIMEOUT_MS = 15000;

const DEBUG = Boolean(process.env.BUNGEE_DEBUG);

function debug(...args: unknown[]): void {
  if (DEBUG) {
    console.log(...args);
  }
}

export interface UserSideSearchResult {
  id: string;
  account: string;
  fullName: string;
}

export interface IpMacEntry {
  ip: string;
  mac: string | null;
  lastSeen?: string;
}

export interface TariffEntry {
  name: string;
  price: number;
}

export interface ConnectionPointData {
  deviceId: string;
  deviceModel: string;
  deviceLocation: string;
  ip: string;
  port: number;
  portName?: string;
  portDescription?: string;
  equipmentType?: "switch" | "onu" | "olt" | "router";
  onuModel?: string;
  onuName?: string;
  onuLogin?: string;
}

export interface OltInfoFromNotes {
  oltIp: string;
  oltPort: string;
  onuMac: string;
}

export interface UserSideAbonentDetails {
  id: string;
  account: string;
  fullName: string;
  login: string;
  contract: string;
  balance: number;
  credit: number;
  lastPlusDate: string;
  status: string;
  tariffs: TariffEntry[];
  additionalServices: string[];
  address: {
    city: string;
    street: string;
    house: string;
    apartment?: string;
    full: string;
  };
  phone?: string;
  landlinePhone?: string;
  email?: string;
  ip: string;
  mac: string;
  ipMacList: IpMacEntry[];
  connectionPoints: ConnectionPointData[];
  activity: {
    network: string;
    internet: string;
  };
  billing: string;
  billingId: string;
  connectionDate: string;
  connectionTechnology: string;
  isLegalEntity: boolean;
  notes: string;
  manager: string;
  inboundTraffic: string;
  outboundTraffic: string;
}

export interface IfacePortData {
  ifIndex: number;
  ifType: number;
  ifName: string;
  ifNumber: number;
  ifAlias: string;
  ifAdminStatus: number;
  ifOperStatus: number;
  ifInErrors: number;
  ifOutErrors: number;
  ifHighSpeed?: number;
  ifSpeed: number;
  ifHCInOctets: number;
  ifHCOutOctets: number;
  ifInOctets: number;
  ifOutOctets: number;
  position: number;
  count: number;
}

export interface IfaceJsonResponse {
  time: number;
  isIfaceAnimation: number;
  data: IfacePortData[];
}

export function createUserSideClient(config: UserSideConfig) {
  const baseUrl = config.baseUrl;

  function getAbonentUrl(id: string): string {
    return `${baseUrl}/oper/?core_section=customer&action=show&id=${id}`;
  }

  async function search(query: string): Promise<UserSideSearchResult[]> {
    const url = `${config.baseUrl}/oper/?core_section=customer_list&action=ajax_search&search=${encodeURIComponent(query)}`;

    debug(`[UserSide] Searching for: ${query}`);
    debug(`[UserSide] URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Cookie': config.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[UserSide] HTTP error: ${response.status}`);
      throw new Error(`UserSide API error: ${response.status}`);
    }

    const text = await response.text();

    return parseSearchResponse(text);
  }

  async function getAbonent(id: string): Promise<UserSideAbonentDetails> {
    const url = `${config.baseUrl}/oper/?core_section=customer&action=show&id=${id}`;

    debug(`[UserSide] Fetching abonent: ${id}`);
    debug(`[UserSide] URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Cookie': config.cookie,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[UserSide] HTTP error: ${response.status}`);
      throw new Error(`UserSide API error: ${response.status}`);
    }

    const html = await response.text();
    debug(`[UserSide] Response length: ${html.length}`);

    const abonent = parseAbonentPage(html);

    if (!abonent.id && !abonent.account) {
      throw new Error('Не удалось разобрать карточку абонента (изменилась вёрстка UserSide или истекла сессия)');
    }

    return abonent;
  }

  async function getIfaceData(deviceId: string, referer?: string): Promise<IfaceJsonResponse> {
    const url = `${config.baseUrl}/oper/?core_section=device&action=iface_json_data&id=${deviceId}`;

    debug(`[UserSide] Fetching iface data for device: ${deviceId}`);

    const headers: Record<string, string> = {
      'Cookie': config.cookie,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (referer) {
      headers['Referer'] = referer;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[UserSide] HTTP error: ${response.status}`);
      throw new Error(`UserSide API error: ${response.status}`);
    }

    const text = await response.text();

    let data: IfaceJsonResponse;
    try {
      data = JSON.parse(text) as IfaceJsonResponse;
    } catch {
      throw new Error('UserSide вернул некорректный ответ iface_json_data');
    }

    if (!data || !Array.isArray(data.data)) {
      throw new Error('В ответе iface_json_data отсутствуют данные портов');
    }

    debug(`[UserSide] Iface data: ${data.data.length} ports`);
    return data;
  }

  return { search, getAbonent, getIfaceData, getAbonentUrl };
}

export function parseSearchResponse(text: string): UserSideSearchResult[] {
  const results: UserSideSearchResult[] = [];

  let json: { data?: unknown };
  try {
    json = JSON.parse(text) as { data?: unknown };
  } catch {
    throw new Error('UserSide вернул не-JSON ответ поиска (истекла сессия или изменился раздел)');
  }

  const data = json.data;
  if (typeof data !== 'string') {
    throw new Error('Неожиданная структура ответа поиска UserSide');
  }

  const decodedData = data
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\\\/g, '\\')
      .replace(/\\"/g, '"');

  debug(`[UserSide Parser] Decoded data length: ${decodedData.length}`);

  const linkRegex = /<a href="\?core_section=customer&action=show&id=(\d+)"><i[^>]*><\/i>(\d+) &middot; \d+ &middot; (?:\[x\] )?([^<]+)<\/a>/g;

  let match;
  let matchCount = 0;
  while ((match = linkRegex.exec(decodedData)) !== null) {
    matchCount++;
    const id = match[1];
    const account = match[2];
    const fullNameRaw = match[3];

    if (!id || !account || !fullNameRaw) continue;

    let fullName = fullNameRaw;
    const atIndex = fullName.indexOf('@');
    if (atIndex > 0) {
      fullName = fullName.substring(0, atIndex).trim();
    }
    fullName = fullName.replace(/@[^\s@]+/g, '').trim();

    results.push({
      id,
      account,
      fullName,
    });
  }

  if (matchCount === 0 && decodedData.includes('core_section=customer')) {
    throw new Error('Не удалось разобрать результаты поиска: изменился формат ответа UserSide');
  }

  return results;
}

export function parseNotesToOltInfo(notes: string): OltInfoFromNotes | null {
  if (!notes) return null;

  const macRegex = /(?<![0-9.])([0-9a-f]{4})\.([0-9a-f]{4})\.([0-9a-f]{4})(?![0-9.])/i;
  const oltPortRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*-\s*(\d+\/\d+:\d+)/;

  const lines = notes.split(/\n/);
  let onuMac = '';
  let oltIp = '';
  let oltPort = '';

  for (const line of lines) {
    const trimmed = line.trim();

    const macMatch = trimmed.match(macRegex);
    if (macMatch) {
      onuMac = `${macMatch[1]}${macMatch[2]}${macMatch[3]}`.replace(/(.{2})/g, '$1:').replace(/:$/, '').toUpperCase();
    }

    const oltMatch = trimmed.match(oltPortRegex);
    if (oltMatch) {
      oltIp = oltMatch[1]!.trim();
      oltPort = oltMatch[2]!.trim();
    }
  }

  if (oltIp && oltPort) {
    return { oltIp, oltPort, onuMac };
  }

  return null;
}

export function parseAbonentPage(html: string): UserSideAbonentDetails {
  function extractValue(label: string): string | null {
    const regex = new RegExp(`<div class="left_data">\\s*${escapeRegex(label)}[\\s\\S]*?<\\/div>\\s*<div>([\\s\\S]*?)<\\/div>`, 'i');
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1].replace(/<[^>]*>/g, '').trim();
    }
    return null;
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractValueByLabel(label: string): string | null {
    const regex = new RegExp(`${escapeRegex(label)}[\\s\\S]*?<div>\\s*([\\s\\S]*?)<\\/div>`, 'i');
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1].replace(/<[^>]*>/g, '').trim();
    }
    return null;
  }

  const idMatch = html.match(/<div id="customer-card-customer-id">[\s\S]*?<div>\s*(\d+)/);
  const id = idMatch?.[1]?.trim() ?? '';

  const fullNameMatch = html.match(/Наименование:[\s\S]*?<div>\s*([^<]+)/);
  const nameFromLabel = fullNameMatch?.[1]?.trim();
  const fullName = nameFromLabel || (html.match(/<title>([^-]+)\s*-/)?.[1]?.trim() ?? '');

  const accountMatch = html.match(/Лицевой счет:[\s\S]*?<div>\s*(\d+)/);
  const account = accountMatch?.[1]?.trim() ?? '';

  const loginMatch = html.match(/Учетная запись\/Логин:[\s\S]*?<div>([^<]+)/);
  const login = loginMatch?.[1]?.trim() ?? '';

  const contractMatch = html.match(/Договор:[\s\S]*?<div>([^<]+)/);
  const contract = contractMatch?.[1]?.trim() ?? '';

  const balanceMatch = html.match(/Баланс:[\s\S]*?(-?[\d.]+)\s*руб/);
  const balance = balanceMatch?.[1] ? parseFloat(balanceMatch[1]) : 0;

  const creditMatch = html.match(/Кредит:[\s\S]*?(-?[\d.]+)\s*руб/);
  const credit = creditMatch?.[1] ? parseFloat(creditMatch[1]) : 0;

  const lastPlusMatch = html.match(/Последний плюс:[\s\S]*?<div>\s*([^<]+)/);
  const lastPlusDate = lastPlusMatch?.[1]?.trim() ?? '';

  const statusMatch = html.match(/Статус:[\s\S]*?<i[^>]*>[^<]*<\/i>\s*([^<]+)/);
  const status = statusMatch?.[1]?.trim() ?? '';

  const tariffs: TariffEntry[] = [];
  const tariffRegex = /Тариф:[\s\S]*?<div[^>]*>([^<]+)<i>\(([\d.]+)\s*руб/g;
  let tariffMatch;
  while ((tariffMatch = tariffRegex.exec(html)) !== null) {
    tariffs.push({
      name: tariffMatch[1]!.trim(),
      price: parseFloat(tariffMatch[2]!),
    });
  }

  const additionalServices: string[] = [];
  const serviceRegex = /Доп\.услуги:[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/g;
  let serviceMatch;
  while ((serviceMatch = serviceRegex.exec(html)) !== null) {
      const serviceText = serviceMatch[1]!.replace(/<[^>]*>/g, '').trim();
    if (serviceText) {
      additionalServices.push(serviceText);
    }
  }

  const addressMatch = html.match(/Адрес:[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
  const addressFull = addressMatch?.[1]?.trim() ?? '';

  const parts = addressFull.split(',').map(s => s.trim());
  const city = parts[0] || '';
  const street = parts[1] || '';
  const house = parts[2] || '';

  const apartmentMatch = html.match(/Кв\.:[\s\S]*?<div>([^<]+)/);
  const apartment = apartmentMatch?.[1]?.trim() || undefined;

  const phoneMatch = html.match(/Мобильный телефон:[\s\S]*?<div>([^<]+)/);
  const phone = phoneMatch?.[1]?.trim() || undefined;

  const landlinePhoneMatch = html.match(/Телефон:[\s\S]*?<div>\s*([^<\s•·]+)/);
  const landlinePhone = landlinePhoneMatch?.[1]?.trim() || undefined;

  const emailMatch = html.match(/E-mail:[\s\S]*?<div>([^<]+)/);
  const email = emailMatch?.[1]?.trim() || undefined;

  const ipMacList: IpMacEntry[] = [];
  let ipMacSection = '';
  const ipMacLabelIndex = html.search(/IP\/MAC-адреса/);
  if (ipMacLabelIndex >= 0) {
    const sectionEndIndex = html.indexOf('<a id="ref_', ipMacLabelIndex);
    ipMacSection = sectionEndIndex >= 0
      ? html.slice(ipMacLabelIndex, sectionEndIndex)
      : html.slice(ipMacLabelIndex);
  }
  const ipMacRegex = /<div class="item">[\s\S]*?<div>\s*([\d.]+)<\/div>\s*<div>\s*([A-Fa-f0-9:]+)?[\s\S]*?<\/div>\s*<div>\s*([^<]*)<\/div>/g;
  let ipMacMatch;
  while ((ipMacMatch = ipMacRegex.exec(ipMacSection)) !== null) {
    const ipVal = ipMacMatch[1]!.trim();
    const macVal = ipMacMatch[2]?.trim() || null;
    const lastSeen = ipMacMatch[3]?.trim() || undefined;
    if (ipVal) {
      ipMacList.push({ ip: ipVal, mac: macVal, lastSeen });
    }
  }
  const ip = ipMacList.length > 0 ? ipMacList[0]!.ip : '';
  const mac = ipMacList.length > 0 ? (ipMacList[0]!.mac ?? '') : '';

  const connectionPoints: ConnectionPointData[] = [];

  const cpRegexWithIp = /<a href="\?core_section=device&action=device&type2=show&code=(\d+)"[^>]*>[^<]*<\/a><br>\s*<i>([^<]+)<\/i>?<br>\s*IP:\s*([\d.]+)<br>\s*порт:\s*(\d+)(?:\s*\(([^)]+)\))?/g;
  let cpMatch;
  while ((cpMatch = cpRegexWithIp.exec(html)) !== null) {
    const cpDeviceId = cpMatch[1]!.trim();
    const cpDeviceInfo = cpMatch[2]!.trim().replace(/&#047;/g, '/');
    const cpIp = cpMatch[3]!.trim();
    const cpPort = parseInt(cpMatch[4]!, 10);
    const cpPortName = cpMatch[5]?.trim() || undefined;

    const dashIndex = cpDeviceInfo.indexOf(' - ');
    const hashIndex = cpDeviceInfo.indexOf('#');
    let cpModel = cpDeviceInfo;
    let cpLocation = '';
    if (dashIndex > 0) {
      cpModel = cpDeviceInfo.substring(0, dashIndex).trim();
      const afterDash = cpDeviceInfo.substring(dashIndex + 3).trim();
      if (hashIndex > 0) {
        cpLocation = afterDash.substring(0, hashIndex - dashIndex - 3).trim();
      } else {
        cpLocation = afterDash;
      }
    }

    connectionPoints.push({
      deviceId: cpDeviceId,
      deviceModel: cpModel,
      deviceLocation: cpLocation,
      ip: cpIp,
      port: cpPort,
      portName: cpPortName,
    });
  }

  const cpRegexNoIp = /<a href="\?core_section=device&action=device&type2=show&code=(\d+)"[^>]*>[^<]*<\/a><br>\s*<i>([^<]+)<\/i>?<br>\s*порт:\s*(\d+)(?:\s*\(([^)]+)\))?/g;
  while ((cpMatch = cpRegexNoIp.exec(html)) !== null) {
    const cpDeviceId = cpMatch[1]!.trim();
    const cpDeviceInfo = cpMatch[2]!.trim().replace(/&#047;/g, '/');
    const cpPort = parseInt(cpMatch[3]!, 10);
    const cpPortName = cpMatch[4]?.trim() || undefined;

    if (connectionPoints.some(cp => cp.deviceId === cpDeviceId && cp.port === cpPort)) {
      continue;
    }

    const dashIndex = cpDeviceInfo.indexOf(' - ');
    let cpModel = cpDeviceInfo;
    let cpName = '';
    let cpLogin = '';
    let cpType: "switch" | "onu" | "olt" | "router" = "switch";

    if (dashIndex > 0) {
      cpModel = cpDeviceInfo.substring(0, dashIndex).trim();
      const afterDash = cpDeviceInfo.substring(dashIndex + 3).trim();

      const secondDash = afterDash.indexOf(' - ');
      if (secondDash > 0) {
        cpName = afterDash.substring(0, secondDash).trim();
        cpLogin = afterDash.substring(secondDash + 3).trim();
      } else {
        cpName = afterDash;
      }

      const modelLower = cpModel.toLowerCase();
      if (modelLower.includes('onu') || modelLower.includes('ont') || modelLower.includes('epon') || modelLower.includes('gpon')) {
        cpType = 'onu';
      } else if (modelLower.includes('olt')) {
        cpType = 'olt';
      }
    }

    connectionPoints.push({
      deviceId: cpDeviceId,
      deviceModel: cpModel,
      deviceLocation: '',
      ip: '',
      port: cpPort,
      portName: cpPortName,
      equipmentType: cpType,
      onuModel: cpType === 'onu' ? cpModel : undefined,
      onuName: cpType === 'onu' ? cpName : undefined,
      onuLogin: cpType === 'onu' ? cpLogin : undefined,
    });
  }

  const activityNetMatch = html.match(/Активность в сети:[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
  const activityNetwork = activityNetMatch?.[1]?.trim() ?? '';

  const activityInetMatch = html.match(/Активность в интернете:[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
  const activityInternet = activityInetMatch?.[1]?.trim() ?? '';

  const billingMatch = html.match(/Биллинг:[\s\S]*?<div>\s*([^<]+)/);
  const billing = billingMatch?.[1]?.trim() ?? '';

  const billingIdMatch = html.match(/ID в UTM5:[\s\S]*?<div>\s*(\d+)/);
  const billingId = billingIdMatch?.[1]?.trim() ?? '';

  const connectionDateMatch = html.match(/Дата подключения:[\s\S]*?<div>\s*([^<]+)/);
  const connectionDate = connectionDateMatch?.[1]?.trim() ?? '';

  const connectionTechMatch = html.match(/Технология подключения:[\s\S]*?<span[^>]*>([^<]+)<\/span>/)
    ?? html.match(/Технология подключения:[\s\S]*?<div>\s*([^<]+)/);
  const connectionTechnology = connectionTechMatch?.[1]?.trim() ?? '';

  const isLegalEntity = /<div class="div_info_block important">[\s\S]*?Юр\.лицо/.test(html);

  const notesMatch = html.match(/Заметки:[\s\S]*?<textarea[^>]*>([^<]*)<\/textarea>/)
    ?? html.match(/Заметки:[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/);
  const notesRaw = notesMatch?.[1]?.replace(/<[^>]*>/g, '') ?? '';
  const notes = notesRaw.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10))).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

  const managerMatch = html.match(/Менеджер:[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
  const manager = managerMatch?.[1]?.trim() ?? '';

  const inboundTrafficMatch = html.match(/Вх\.трафик:[\s\S]*?<div>\s*([^<]+)/);
  const inboundTraffic = inboundTrafficMatch?.[1]?.trim() ?? '';

  const outboundTrafficMatch = html.match(/Исх\.трафик:[\s\S]*?<div>\s*([^<]+)/);
  const outboundTraffic = outboundTrafficMatch?.[1]?.trim() ?? '';

  return {
    id,
    account,
    fullName,
    login,
    contract,
    balance,
    credit,
    lastPlusDate,
    status,
    tariffs,
    additionalServices,
    address: {
      city,
      street,
      house,
      apartment,
      full: addressFull,
    },
    phone,
    landlinePhone,
    email,
    ip,
    mac,
    ipMacList,
    connectionPoints,
    activity: {
      network: activityNetwork,
      internet: activityInternet,
    },
    billing,
    billingId,
    connectionDate,
    connectionTechnology,
    isLegalEntity,
    notes,
    manager,
    inboundTraffic,
    outboundTraffic,
  };
}
