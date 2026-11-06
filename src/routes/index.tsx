import { createFileRoute } from "@tanstack/react-router";
import { CityGame } from "@/components/city-game";

export const Route = createFileRoute("/")({
  component: CityGame,
});
