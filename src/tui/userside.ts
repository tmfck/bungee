/**
 * UserSide API client
 */

export interface UserSideConfig {
    baseUrl: string;
    cookie: string;
}

export interface UserSideSearchResult {
  id: string;
  account: string;
  fullName: string;
}

export interface UserSideAbonentDetails {
  id: string;
  account: string;
  fullName: string;
  login: string;
  contract: string;
  balance: number;
  status: string;
  tariff: {
    name: string;
    price: number;
  };
  address: {
    city: string;
    street: string;
    house: string;
    apartment?: string;
    full: string;
  };
  phone?: string;
  ip: string;
  mac: string;
  connectionPoint: {
    device: string;
    ip: string;
    port: number;
  };
  activity: {
    network: string;
    internet: string;
  };
  billing: string;
  billingId: string;
}

export function createUserSideClient(config: UserSideConfig) {
  async function search(query: string): Promise<UserSideSearchResult[]> {
    const url = `${config.baseUrl}/oper/?core_section=customer_list&action=ajax_search&search=${encodeURIComponent(query)}`;

    console.log(`[UserSide] Searching for: ${query}`);
    console.log(`[UserSide] URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Cookie': config.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      console.error(`[UserSide] HTTP error: ${response.status}`);
      throw new Error(`UserSide API error: ${response.status}`);
    }

    const text = await response.text();
    console.log(`[UserSide] Response: ${text}`);

    const results = parseSearchResponse(text);
    console.log(`[UserSide] Parsed results: ${JSON.stringify(results)}`);

    return results;
  }

  async function getAbonent(id: string): Promise<UserSideAbonentDetails> {
    const url = `${config.baseUrl}/oper/?core_section=customer&action=show&id=${id}`;

    console.log(`[UserSide] Fetching abonent: ${id}`);
    console.log(`[UserSide] URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Cookie': config.cookie,
      },
    });

    if (!response.ok) {
      console.error(`[UserSide] HTTP error: ${response.status}`);
      throw new Error(`UserSide API error: ${response.status}`);
    }

    const html = await response.text();
    console.log(`[UserSide] Response length: ${html.length}`);

    const abonent = parseAbonentPage(html);
    console.log(`[UserSide] Parsed abonent:`, abonent);

    return abonent;
  }

  return { search, getAbonent };
}

function parseSearchResponse(html: string): UserSideSearchResult[] {
  const results: UserSideSearchResult[] = [];

  console.log(`[UserSide Parser] Input length: ${html.length}`);

  try {
    const json = JSON.parse(html);
    const data = json.data;

    console.log(`[UserSide Parser] Data field length: ${data.length}`);

    const decodedData = data
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\\\/g, '\\')
      .replace(/\\"/g, '"');

    console.log(`[UserSide Parser] Decoded data preview: ${decodedData.substring(0, 300)}`);

    const linkRegex = /<a href="\?core_section=customer&action=show&id=(\d+)"><i[^>]*><\/i>(\d+) &middot; \d+ &middot; (?:\[x\] )?([^<]+)<\/a>/g;

    let match;
    let matchCount = 0;
    while ((match = linkRegex.exec(decodedData)) !== null) {
      matchCount++;
      const id = match[1];
      const account = match[2];
      const fullNameRaw = match[3];

      console.log(`[UserSide Parser] Match ${matchCount}: id=${id}, account=${account}, fullNameRaw=${fullNameRaw}`);

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

    console.log(`[UserSide Parser] Total regex matches: ${matchCount}`);
  } catch (e) {
    console.error('[UserSide Parser] Failed to parse:', e);
    console.log(`[UserSide Parser] Response preview: ${html.substring(0, 300)}`);
  }

  return results;
}

function parseAbonentPage(html: string): UserSideAbonentDetails {
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

  const idMatch = html.match(/<div id="customer-card-customer-id">[\s\S]*?<div>\s*(\d+)/);
  const id = idMatch?.[1]?.trim() ?? '';

  const fullNameMatch = html.match(/<title>([^-]+)\s*-/);
  const fullName = fullNameMatch?.[1]?.trim() ?? '';

  const accountMatch = html.match(/Лицевой счет:[\s\S]*?<div>\s*(\d+)/);
  const account = accountMatch?.[1]?.trim() ?? '';

  const loginMatch = html.match(/Учетная запись\/Логин:[\s\S]*?<div>([^<]+)/);
  const login = loginMatch?.[1]?.trim() ?? '';

  const contractMatch = html.match(/Договор:[\s\S]*?<div>([^<]+)/);
  const contract = contractMatch?.[1]?.trim() ?? '';

  const balanceMatch = html.match(/Баланс:[\s\S]*?(-?[\d.]+)\s*руб/);
  const balance = balanceMatch?.[1] ? parseFloat(balanceMatch[1]) : 0;

  const statusMatch = html.match(/Статус:[\s\S]*?<i[^>]*>[^<]*<\/i>\s*([^<]+)/);
  const status = statusMatch?.[1]?.trim() ?? '';

  const tariffMatch = html.match(/Тариф:[\s\S]*?<div[^>]*>([^<]+)<i>\(([\d.]+)\s*руб/);
  const tariffName = tariffMatch?.[1]?.trim() ?? '';
  const tariffPrice = tariffMatch?.[2] ? parseFloat(tariffMatch[2]) : 0;

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

  const ipMatch = html.match(/IP\/MAC-адреса[\s\S]*?<div>\s*([\d.]+)/);
  const ip = ipMatch?.[1]?.trim() ?? '';

  const macMatch = html.match(/IP\/MAC-адреса[\s\S]*?<div>\s*[\d.]+\s*<\/div>\s*<div>\s*([A-F0-9:]+)/i);
  const mac = macMatch?.[1]?.trim() ?? '';

  const deviceMatch = html.match(/Точка подключения:[\s\S]*?<i>([^<]+)<br>\s*IP:\s*([\d.]+)<br>\s*порт:\s*(\d+)/);
  const deviceName = deviceMatch?.[1]?.trim() ?? '';
  const deviceIp = deviceMatch?.[2]?.trim() ?? '';
  const devicePort = deviceMatch?.[3] ? parseInt(deviceMatch[3], 10) : 0;

  const activityNetMatch = html.match(/Активность в сети:[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
  const activityNetwork = activityNetMatch?.[1]?.trim() ?? '';

  const activityInetMatch = html.match(/Активность в интернете:[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
  const activityInternet = activityInetMatch?.[1]?.trim() ?? '';

  const billingMatch = html.match(/Биллинг:[\s\S]*?<div>\s*([^<]+)/);
  const billing = billingMatch?.[1]?.trim() ?? '';

  const billingIdMatch = html.match(/ID в UTM5:[\s\S]*?<div>\s*(\d+)/);
  const billingId = billingIdMatch?.[1]?.trim() ?? '';

  return {
    id,
    account,
    fullName,
    login,
    contract,
    balance,
    status,
    tariff: {
      name: tariffName,
      price: tariffPrice,
    },
    address: {
      city,
      street,
      house,
      apartment,
      full: addressFull,
    },
    phone,
    ip,
    mac,
    connectionPoint: {
      device: deviceName,
      ip: deviceIp,
      port: devicePort,
    },
    activity: {
      network: activityNetwork,
      internet: activityInternet,
    },
    billing,
    billingId,
  };
}
