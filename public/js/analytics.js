export function isLocalHostname(hostname) {
	return hostname === "localhost" ||
	hostname === "127.0.0.1" ||
	hostname === "0.0.0.0" ||
	hostname === "::1" ||
	hostname === "[::1]" ||
	hostname.endsWith(".localhost");
}

if (typeof window !== "undefined") {
	window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

	if (!isLocalHostname(window.location.hostname)) {
		const analyticsScript = document.createElement("script");
		analyticsScript.defer = true;
		analyticsScript.src = "/_vercel/insights/script.js";
		document.head.appendChild(analyticsScript);
	}
}
