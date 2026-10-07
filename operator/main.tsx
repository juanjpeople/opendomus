import { createRoot } from "react-dom/client";
import { App, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";
import { OperatorApp } from "./Login";
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
createRoot(document.getElementById("root")!).render(<ConfigProvider locale={esES} theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { colorPrimary: "#1677ff", borderRadius: 8, fontFamily: "system-ui, sans-serif" } }}><App><OperatorApp /></App></ConfigProvider>);
