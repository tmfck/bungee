import { createUserSideClient } from "./userside.js";

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
