import {
  contentEntitySceneGenesisPlaza,
  genesisPlazaThumbnailMap,
  hotSceneGenesisPlaza,
  placeGenesisPlaza,
  placeGenesisPlazaWithAggregatedAttributes,
  sceneStatsGenesisPlaza,
  sqsMessageWorld,
  worldContentEntitySceneParalax,
} from "../../__data__/entities"
import {
  explorerPlaceUrl,
  explorerUrl,
  getThumbnailFromContentDeployment,
  getThumbnailFromDeployment,
  placeUrl,
  placesWithUserCount,
  placesWithUserVisits,
  siteUrl,
} from "./utils"

describe("Instance of URL", () => {
  test("should return an URL instance of play decentraland", () => {
    const url = explorerUrl("/")
    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe("https://play.decentraland.org/")
  })

  test("should return an URL instance of a place in places", () => {
    const url = placeUrl(placeGenesisPlaza)
    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe(
      "https://places.decentraland.org/place/?position=-9.-9"
    )
  })

  test("should return an URL instance of places", () => {
    const url = siteUrl("/")
    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe("https://places.decentraland.org/")
  })
})

describe("explorerPlaceUrl", () => {
  test("should return a string with an URL of a places with the realm", () => {
    const url = explorerPlaceUrl({ base_position: "-9,-9" }, "dg")
    expect(url).toBe("https://play.decentraland.org/?position=-9%2C-9&realm=dg")
  })
  test("should return a string with an URL of a places without the realm", () => {
    const url = explorerPlaceUrl({ base_position: "-9,-9" })
    expect(url).toBe("https://play.decentraland.org/?position=-9%2C-9")
  })
})

describe("getThumbnail", () => {
  test("should return a string of the thumbnail", () => {
    const url = getThumbnailFromDeployment(contentEntitySceneGenesisPlaza)
    expect(url).toBe(
      "https://decentraland.org/images/thumbnail/genesis-plaza.png"
    )
  })

  test("should return a string of the thumbnail where a navmapThumbnail is a path", () => {
    const url = getThumbnailFromDeployment({
      ...contentEntitySceneGenesisPlaza,
      metadata: {
        ...contentEntitySceneGenesisPlaza.metadata,
        display: { navmapThumbnail: "images/gray.png" },
      },
    })
    expect(url).toBe(
      "https://peer.decentraland.org/content/contents/bafkreiae5v3gkg57q6mhzozynimyxgt6uafu32rnt6klpui6po3xk53mbe"
    )
  })
  test("should return a string of the thumbnail where a navmapThumbnail is a path to a non-existent image", () => {
    const url = getThumbnailFromDeployment({
      ...contentEntitySceneGenesisPlaza,
      metadata: {
        ...contentEntitySceneGenesisPlaza.metadata,
        display: { navmapThumbnail: "images/not-an-image.png" },
      },
    })
    expect(url).toBe(genesisPlazaThumbnailMap)
  })

  test("should return a string of the thumbnail", () => {
    const url = getThumbnailFromContentDeployment(
      contentEntitySceneGenesisPlaza
    )
    expect(url).toBe(
      "https://decentraland.org/images/thumbnail/genesis-plaza.png"
    )
  })

  test("should return a string of the thumbnail as a map", () => {
    const url = getThumbnailFromContentDeployment({
      ...contentEntitySceneGenesisPlaza,
      metadata: {
        ...contentEntitySceneGenesisPlaza.metadata,
        display: { navmapThumbnail: undefined },
      },
    })
    expect(url).toBe(genesisPlazaThumbnailMap)
  })

  test("should return a string of the thumbnail of a world", () => {
    const url = getThumbnailFromContentDeployment(
      worldContentEntitySceneParalax,
      { url: sqsMessageWorld.contentServerUrls![0] }
    )
    expect(url).toBe(
      "https://api.decentraland.org/v2/map.png?height=1024&width=1024&selected=0%2C0&center=0%2C0&size=20"
    )
  })
})

describe("get of AggregatePlaceAttributes", () => {
  test("should return a place of type AggregatePlaceAttributes with user_visits", () => {
    const places = placesWithUserVisits(
      [placeGenesisPlazaWithAggregatedAttributes],
      sceneStatsGenesisPlaza
    )
    expect(places).toEqual([
      {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_visits:
          sceneStatsGenesisPlaza[
            placeGenesisPlazaWithAggregatedAttributes.base_position
          ].last_30d.users,
      },
    ])
  })

  test("should return a place of type AggregatePlaceAttributes with user_visits when not match the base position", () => {
    const places = placesWithUserVisits(
      [
        {
          ...placeGenesisPlazaWithAggregatedAttributes,
          base_position: "-1,-1",
        },
      ],
      sceneStatsGenesisPlaza
    )
    expect(places).toEqual([
      {
        ...placeGenesisPlazaWithAggregatedAttributes,
        base_position: "-1,-1",
        user_visits:
          sceneStatsGenesisPlaza[
            placeGenesisPlazaWithAggregatedAttributes.base_position
          ].last_30d.users,
      },
    ])
  })

  test("should return a place of type AggregatePlaceAttributes with user_count ", () => {
    const places = placesWithUserCount(
      [placeGenesisPlazaWithAggregatedAttributes],
      [hotSceneGenesisPlaza]
    )
    expect(places).toEqual([
      {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
      },
    ])
  })
  test("should return a place of type AggregatePlaceAttributes with user_count and realm details", () => {
    const places = placesWithUserCount(
      [placeGenesisPlazaWithAggregatedAttributes],
      [hotSceneGenesisPlaza],
      { withRealmsDetail: true }
    )
    expect(places).toEqual([
      {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        realms_detail: hotSceneGenesisPlaza.realms,
      },
    ])
  })
})
