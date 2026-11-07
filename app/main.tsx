/**
 * Entry for the App Store build (and any static hosting): the game alone, with the
 * Arabic font bundled so it works offline, and the native shell prepared first.
 */
import "@fontsource/noto-kufi-arabic/400.css";
import "@fontsource/noto-kufi-arabic/500.css";
import "@fontsource/noto-kufi-arabic/700.css";
import "@fontsource/noto-kufi-arabic/800.css";
import "./app.css";
import { createRoot } from "react-dom/client";
import { CityGame } from "@/components/city-game";
import { bootNative, nativeReady } from "@/native/native";

void bootNative().finally(() => {
  createRoot(document.getElementById("root")!).render(<CityGame />);
  nativeReady();
});
