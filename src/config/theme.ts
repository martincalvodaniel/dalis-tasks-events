import { themePreferenceSchema } from "@/schemas/theme"
export const THEME_STORAGE_KEY = "dalis:theme:v1"
export const THEME_CHANGE_EVENT = "dalis:theme-change"
// Apply a validated device preference before hydration; CSS resolves system changes itself.
export const themeBootstrapScript = `(() => {let theme="system";try {const value=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if (${JSON.stringify(themePreferenceSchema.options)}.includes(value)) theme=value;} catch {} document.documentElement.setAttribute("data-theme",theme);})();`
