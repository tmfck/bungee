import { afterAll, describe, expect, test } from "bun:test";
import { createUserSideClient } from "./userside.js";

const SEARCH_ROWS =
	'<a href="?core_section=customer&action=show&id=777"><i></i>55501 &middot; 7 &middot; Иванов Иван Иванович</a>';

const ABONENT_CARD = [
	'<html><body>',
	'<div id="customer-card-customer-id"><div>4242</div></div>',
	'Наименование: <div>Иванов Иван Иванович</div>',
	'Лицевой счет: <div>55501</div>',
	'Статус: <div><i class="dot"></i>Активен</div>',
	'Баланс: <div>1234.56 руб</div>',
	'Тариф: <div>Домашний<i>(500.00 руб)</i></div>',
	'Адрес: <div><a>Омск, Ленина, 5</a></div>',
	'IP/MAC-адреса',
	'<div class="item"><div>10.0.0.1</div><div>AA:BB:CC:DD:EE:FF</div><div>15.10.2026 10:00</div></div>',
	'<a id="ref_notes"></a>',
	'<a href="?core_section=device&action=device&type2=show&code=99">свич</a><br>',
	'<i>D-Link DES-3200 - Шкаф 1</i><br>',
	'IP: 10.1.1.1<br>',
	'порт: 5 (1/4)',
	'</body></html>',
].join('\n');

const IFACE_DATA = {
	time: 0,
	isIfaceAnimation: 0,
	data: [
		{
			ifIndex: 5,
			ifType: 6,
			ifName: "5",
			ifNumber: 5,
			ifAlias: "abonent",
			ifAdminStatus: 1,
			ifOperStatus: 1,
			ifInErrors: 0,
			ifOutErrors: 0,
			ifHighSpeed: 100,
			ifSpeed: 100000000,
			ifHCInOctets: 1048576,
			ifHCOutOctets: 2097152,
			ifInOctets: 0,
			ifOutOctets: 0,
			position: 1,
			count: 1,
		},
	],
};

const requestLog: string[] = [];
const failures = new Set<string>();

const server = Bun.serve({
	port: 0,
	fetch(request) {
		const url = new URL(request.url);
		requestLog.push(`${request.method} ${url.pathname}${url.search}`);

		if (url.pathname !== "/oper/") {
			return new Response("not found", { status: 404 });
		}

		const section = url.searchParams.get("core_section") ?? "";
		if (failures.has(section)) {
			return new Response("boom", { status: 500 });
		}

		if (section === "customer_list") {
			return Response.json({ data: SEARCH_ROWS });
		}
		if (section === "customer") {
			return new Response(ABONENT_CARD, { headers: { "content-type": "text/html" } });
		}
		if (section === "device") {
			return Response.json(IFACE_DATA);
		}
		return new Response("not found", { status: 404 });
	},
});

const client = createUserSideClient({
	baseUrl: `http://localhost:${server.port}`,
	cookie: "session=abc",
});

afterAll(() => {
	server.stop(true);
});

describe("search", () => {
	test("возвращает разобранные результаты и шлёт cookie", async () => {
		const results = await client.search("Иванов");

		expect(results).toEqual([
			{ id: "777", account: "55501", fullName: "Иванов Иван Иванович" },
		]);
		expect(requestLog.at(-1)).toContain("/oper/?core_section=customer_list");
	});

	test("ошибка сервера пробрасывается", async () => {
		failures.add("customer_list");

		await expect(client.search("Иванов")).rejects.toThrow("UserSide API error: 500");

		failures.delete("customer_list");
	});
});

describe("getAbonent", () => {
	test("разбирает карточку абонента", async () => {
		const abonent = await client.getAbonent("777");

		expect(abonent.id).toBe("4242");
		expect(abonent.account).toBe("55501");
		expect(abonent.fullName).toBe("Иванов Иван Иванович");
		expect(abonent.balance).toBe(1234.56);
		expect(abonent.tariffs).toEqual([{ name: "Домашний", price: 500 }]);
		expect(abonent.address.full).toBe("Омск, Ленина, 5");
		expect(abonent.ip).toBe("10.0.0.1");
		expect(abonent.ipMacList).toEqual([
			{ ip: "10.0.0.1", mac: "AA:BB:CC:DD:EE:FF", lastSeen: "15.10.2026 10:00" },
		]);
	});

	test("разбирает точки подключения", async () => {
		const abonent = await client.getAbonent("777");
		const point = abonent.connectionPoints[0]!;

		expect(point.deviceId).toBe("99");
		expect(point.deviceModel).toBe("D-Link DES-3200");
		expect(point.deviceLocation).toBe("Шкаф 1");
		expect(point.ip).toBe("10.1.1.1");
		expect(point.port).toBe(5);
		expect(point.portName).toBe("1/4");
	});

	test("ошибка сервера при опросе портов пробрасывается", async () => {
		failures.add("device");

		await expect(client.getIfaceData("99")).rejects.toThrow("UserSide API error: 500");

		failures.delete("device");
	});
});

describe("getIfaceData", () => {
	test("возвращает данные портов", async () => {
		const data = await client.getIfaceData("99", "?core_section=customer&action=show&id=4242");

		expect(data.data).toHaveLength(1);
		expect(data.data[0]!.ifNumber).toBe(5);
		expect(data.data[0]!.ifOperStatus).toBe(1);
		expect(data.data[0]!.ifHighSpeed).toBe(100);
	});
});
