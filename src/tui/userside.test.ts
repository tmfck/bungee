import { describe, expect, test } from "bun:test";
import { parseSearchResponse, parseNotesToOltInfo, parseAbonentPage } from "./userside.js";

function searchPayload(data: string): string {
	return JSON.stringify({ data });
}

const searchRow = (id: string, account: string, name: string) =>
	`<a href="?core_section=customer&action=show&id=${id}"><i></i>${account} &middot; 7 &middot; ${name}</a>`;

const DISTRACTOR_ITEM =
	'<div class="item"><div>192.168.99.99</div><div>FF:FF:FF:FF:FF:FF</div><div>01.01.2020</div></div>';

const IP_MAC_ITEMS =
	'<div class="item"><div>10.0.0.1</div><div>AA:BB:CC:DD:EE:FF</div><div>15.10.2026 10:00</div></div>' +
	'<div class="item"><div>10.0.0.2</div><div></div><div></div></div>';

function abonentPage(options: { ipMacAnchor: boolean; ipMacLabel: boolean; distractor: string }) {
	return [
		'<html><body>',
		'<div id="customer-card-customer-id"><div>4242</div></div>',
		options.distractor,
		'Лицевой счет: <div>987654</div>',
		'Адрес: <div><a>Омск, Ленина, 5</a></div>',
		options.ipMacLabel ? 'IP/MAC-адреса' + IP_MAC_ITEMS : IP_MAC_ITEMS,
		options.ipMacAnchor ? '<a id="ref_notes"></a>' : '',
		'</body></html>',
	].join('\n');
}

describe("parseSearchResponse", () => {
	test("разбирает результаты и чистит ФИО", () => {
		const results = parseSearchResponse(searchPayload(searchRow("101", "55501", "Иванов Иван Иванович")));

		expect(results).toEqual([{ id: "101", account: "55501", fullName: "Иванов Иван Иванович" }]);
	});

	test("не-JSON ответ бросает ошибку", () => {
		expect(() => parseSearchResponse("<html>login form</html>")).toThrow(/не-JSON/);
	});

	test("ответ без строки data бросает ошибку", () => {
		expect(() => parseSearchResponse(JSON.stringify({ ok: true }))).toThrow(/структура/);
	});

	test("непустой ответ с непривычной разметкой бросает ошибку", () => {
		const payload = searchPayload('<a href="?core_section=customer&action=show&id=101">старый формат</a>');

		expect(() => parseSearchResponse(payload)).toThrow(/формат/);
	});

	test("пустая выдача остаётся пустой", () => {
		expect(parseSearchResponse(searchPayload(""))).toEqual([]);
		expect(parseSearchResponse(searchPayload("<div>нет результатов</div>"))).toEqual([]);
	});
});

describe("parseAbonentPage", () => {
	test("извлекает id, лицевой счёт и адрес", () => {
		const abonent = parseAbonentPage(
			abonentPage({ ipMacAnchor: true, ipMacLabel: true, distractor: "" })
		);

		expect(abonent.id).toBe("4242");
		expect(abonent.account).toBe("987654");
		expect(abonent.address.full).toBe("Омск, Ленина, 5");
	});

	test("берёт IP/MAC только из своей секции при наличии якоря", () => {
		const abonent = parseAbonentPage(
			abonentPage({ ipMacAnchor: true, ipMacLabel: true, distractor: DISTRACTOR_ITEM })
		);

		expect(abonent.ipMacList).toEqual([
			{ ip: "10.0.0.1", mac: "AA:BB:CC:DD:EE:FF", lastSeen: "15.10.2026 10:00" },
			{ ip: "10.0.0.2", mac: null, lastSeen: undefined },
		]);
		expect(abonent.ip).toBe("10.0.0.1");
	});

	test("без якоря не подхватывает записи до метки секции", () => {
		const abonent = parseAbonentPage(
			abonentPage({ ipMacAnchor: false, ipMacLabel: true, distractor: DISTRACTOR_ITEM })
		);

		expect(abonent.ipMacList.map((entry) => entry.ip)).toEqual(["10.0.0.1", "10.0.0.2"]);
	});

	test("без метки секции IP/MAC остаётся пустым", () => {
		const abonent = parseAbonentPage(
			abonentPage({ ipMacAnchor: false, ipMacLabel: false, distractor: DISTRACTOR_ITEM })
		);

		expect(abonent.ipMacList).toEqual([]);
	});
});

describe("parseNotesToOltInfo", () => {
	test("достаёт IP OLT, порт и MAC ONU", () => {
		const info = parseNotesToOltInfo("ONU aabb.ccdd.eeff\n10.0.1.8 - 0/1:1");

		expect(info).toEqual({ oltIp: "10.0.1.8", oltPort: "0/1:1", onuMac: "AA:BB:CC:DD:EE:FF" });
	});

	test("пустые заметки дают null", () => {
		expect(parseNotesToOltInfo("")).toBeNull();
	});

	test("заметки без OLT-данных дают null", () => {
		expect(parseNotesToOltInfo("aabb.ccdd.eeff")).toBeNull();
	});
});
