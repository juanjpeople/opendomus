import { createRoot } from "react-dom/client";
import { useSyncExternalStore } from "react";
import { App, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";
import { MotionConfig } from "framer-motion";
import { LucideProvider } from "lucide-react";
import { DEFAULT_PREFERENCES } from "../src/lib/preferences";
import { createTheme } from "../src/lib/theme";
import { OperatorApp } from "./Login";
import "./styles.css";

const dark = matchMedia("(prefers-color-scheme: dark)");
const subscribe = (callback: () => void) => {
  dark.addEventListener("change", callback);
  return () => dark.removeEventListener("change", callback);
};
function Surface() {
  const { token } = theme.useToken();
  return <div style={{ minHeight: "100vh", background: token.colorBgLayout, color: token.colorText }}><OperatorApp /></div>;
}
function OperatorRoot() {
  const isDark = useSyncExternalStore(subscribe, () => dark.matches);
  return <ConfigProvider locale={esES} theme={createTheme(DEFAULT_PREFERENCES, isDark)}>
    <LucideProvider strokeWidth={2}><MotionConfig reducedMotion="user"><App><Surface /></App></MotionConfig></LucideProvider>
  </ConfigProvider>;
}
createRoot(document.getElementById("root")!).render(<OperatorRoot />);
