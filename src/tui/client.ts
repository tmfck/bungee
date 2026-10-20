import { createUserSideClient } from "./userside.js";
import { createDhcpClient } from "./dhcp.js";
import { createNetBoxClient } from "./netbox.js";

const USERSIDE_URL = process.env.USERSIDE_URL;
const USERSIDE_COOKIE = process.env.USERSIDE_COOKIE;

if (!USERSIDE_URL || !USERSIDE_COOKIE) {
	console.error("Error: USERSIDE_URL and USERSIDE_COOKIE must be set in .env");
	process.exit(1);
}

export const usersideClient = createUserSideClient({
	baseUrl: USERSIDE_URL,
	cookie: USERSIDE_COOKIE,
});

const DHCP_URL = process.env.DHCP_URL;
const DHCP_USERNAME = process.env.DHCP_USERNAME;
const DHCP_PASSWORD = process.env.DHCP_PASSWORD;

export const dhcpClient =
	DHCP_URL && DHCP_USERNAME && DHCP_PASSWORD
		? createDhcpClient({ baseUrl: DHCP_URL, username: DHCP_USERNAME, password: DHCP_PASSWORD })
		: null;

const NETBOX_URL = process.env.NETBOX_URL;
const NETBOX_USERNAME = process.env.NETBOX_USERNAME;
const NETBOX_PASSWORD = process.env.NETBOX_PASSWORD;

export const netboxClient =
	NETBOX_URL && NETBOX_USERNAME && NETBOX_PASSWORD
		? createNetBoxClient({ baseUrl: NETBOX_URL, username: NETBOX_USERNAME, password: NETBOX_PASSWORD })
		: null;
