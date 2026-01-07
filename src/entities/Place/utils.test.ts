import {
  explorerUrl,
  getThumbnailFromContentDeployment,
  getThumbnailFromDeployment,
  placeUrl,
  placesWithUserCount,
  placesWithUserVisits,
  siteUrl,
} from "./utils"
import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { genesisPlazaThumbnailMap } from "../../__data__/entities"
import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../__data__/sceneStatsGenesisPlaza"
import { sqsMessageWorld } from "../../__data__/sqs"
import { worldContentEntitySceneParalax } from "../../__data__/world"

describe("Instance of URL", () => {
  test("should return an URL instance of a place in places", () => {
    const url = placeUrl(placeGenesisPlaza)
    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe(
      "https://decentraland.org/places/place/?position=0.0"
    )
  })

  test("should return an URL instance of places", () => {
    const url = siteUrl()
    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe("https://decentraland.org/places/")
  })
})

describe("explorerUrl", () => {
  test("should return a string with an URL of a places with the realm", () => {
    const url = explorerUrl({ base_position: "0,0", world_name: null }, "dg")
    expect(url).toBe("https://play.decentraland.org/?position=0%2C0&realm=dg")
  })
  test("should return a string with an URL of a places without the realm", () => {
    const url = explorerUrl({ base_position: "0,0", world_name: null })
    expect(url).toBe("https://play.decentraland.org/?position=0%2C0")
  })
  test("should return a string with an URL of a world", () => {
    const url = explorerUrl({
      world_name: "paralax.dcl.eth",
      base_position: "0,0",
    })
    expect(url).toBe("https://play.decentraland.org/?realm=paralax.dcl.eth")
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
      "https://peer.decentraland.org/content/contents/bafkreidj26s7aenyxfthfdibnqonzqm5ptc4iamml744gmcyuokewkr76y"
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
