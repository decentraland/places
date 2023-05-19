import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"

export function useGetRecommendations() {
  return useAsyncMemo(
    async () => {
      return Places.get().getRecommendations("sdgasdgdsagasd")
      return [
        {
          display: {
            title: "Brasil",
            favicon: "favicon_asset",
            navmapThumbnail: "scene-thumbnail.png",
          },
          owner: "",
          contact: { name: "Hamster#27f9", email: "" },
          main: "bin/game.js",
          tags: [],
          scene: { parcels: ["-81,96"], base: "-81,96" },
          source: {
            version: 1,
            origin: "builder",
            projectId: "0a731338-cf32-45c3-bdc6-aab50a449802",
            point: { x: -81, y: 96 },
            rotation: "north",
            layout: { rows: 1, cols: 1 },
          },
        },
        {
          display: {
            title: "Plains of Elon ",
            favicon: "favicon_asset",
            navmapThumbnail: "scene-thumbnail.png",
          },
          owner: "",
          contact: { name: "MetaTrekkers", email: "" },
          main: "bin/game.js",
          tags: [],
          scene: { parcels: ["135,-98"], base: "135,-98" },
          source: {
            version: 1,
            origin: "builder",
            projectId: "4cb42374-2413-47a9-b275-9de2dbb9d7f4",
            point: { x: 135, y: -98 },
            rotation: "east",
            layout: { rows: 1, cols: 1 },
          },
        },
      ]
    },
    [],
    {
      callWithTruthyDeps: true,
      initialValue: [],
    }
  )
}
