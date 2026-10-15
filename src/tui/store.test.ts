import { describe, expect, test } from "bun:test";
import { createStore, type AbonentDetails } from "./store.js";

function makeAbonent(id: string, account: string): AbonentDetails {
	return {
		id,
		account,
		fullName: `Абонент ${account}`,
		address: { city: "Омск", street: "Ленина", house: "5", full: "Омск, Ленина, 5" },
		balance: 0,
		tariff: "",
		status: "Активен",
		tariffs: [],
		additionalServices: [],
		connectionPoints: [],
		equipment: [],
	};
}

describe("навигация", () => {
	test("navigateTo пишет историю и не дублирует текущий экран", () => {
		const store = createStore();

		store.navigateTo("abonent");
		store.navigateTo("abonent");
		store.navigateTo("switch");

		expect(store.currentScreen()).toBe("switch");
		expect(store.screenHistory()).toEqual(["search", "abonent"]);
	});

	test("goBack возвращает на предыдущий экран", () => {
		const store = createStore();

		store.navigateTo("abonent");
		store.navigateTo("olt");
		store.goBack();

		expect(store.currentScreen()).toBe("abonent");
		expect(store.screenHistory()).toEqual(["search"]);
	});

	test("goBack без истории остаётся на поиске", () => {
		const store = createStore();

		store.goBack();

		expect(store.currentScreen()).toBe("search");
		expect(store.screenHistory()).toEqual([]);
	});
});

describe("состояние абонента", () => {
	test("выбор абонента сбрасывает индекс оборудования и ошибки опроса", () => {
		const store = createStore();

		store.setSelectedEquipmentIndex(3);
		store.setPortPollError("Ошибка");

		const abonent = makeAbonent("1", "55501");
		abonent.equipment = [
			{ type: "switch", model: "D-Link", mac: "", ip: "10.0.0.1", port: 5 },
			{ type: "onu", model: "ONU", mac: "AA:BB" },
		];

		store.setSelectedAbonent(abonent);

		expect(store.selectedEquipmentIndex()).toBe(0);
		expect(store.portPollError()).toBeNull();
		expect(store.abonentLoading()).toBe(false);
	});

	test("updateEquipmentPortData обновляет только выбранное оборудование", () => {
		const store = createStore();

		const abonent = makeAbonent("1", "55501");
		abonent.equipment = [
			{ type: "switch", model: "D-Link", mac: "", ip: "10.0.0.1", port: 5 },
			{ type: "switch", model: "D-Link", mac: "", ip: "10.0.0.2", port: 7 },
		];

		store.setSelectedAbonent(abonent);
		store.updateEquipmentPortData(1, { portStatus: "up", portSpeed: 100, inOctets: 1024 });

		const equipment = store.selectedAbonent()!.equipment;

		expect(equipment[0]!.portStatus).toBeUndefined();
		expect(equipment[1]!.portStatus).toBe("up");
		expect(equipment[1]!.portSpeed).toBe(100);
		expect(equipment[1]!.inOctets).toBe(1024);
	});
});

describe("поиск и справка", () => {
	test("setSearchResults гасит загрузку и ошибку", () => {
		const store = createStore();

		store.setSearchLoading(true);
		store.setSearchError("Сетевая ошибка");
		store.setSearchResults([]);

		expect(store.searchLoading()).toBe(false);
		expect(store.searchError()).toBeNull();
	});

	test("clearSearchResults не трогает введённый запрос", () => {
		const store = createStore();

		store.setSearchInputValue("Иванов");
		store.setSearchError("Сетевая ошибка");
		store.clearSearchResults();

		expect(store.searchInputValue()).toBe("Иванов");
		expect(store.searchResults()).toEqual([]);
		expect(store.searchError()).toBeNull();
	});

	test("toggleHelp и hideHelp переключают модалку", () => {
		const store = createStore();

		expect(store.isHelpVisible()).toBe(false);
		store.toggleHelp();
		expect(store.isHelpVisible()).toBe(true);
		store.toggleHelp();
		expect(store.isHelpVisible()).toBe(false);

		store.toggleHelp();
		store.hideHelp();
		expect(store.isHelpVisible()).toBe(false);
	});
});
