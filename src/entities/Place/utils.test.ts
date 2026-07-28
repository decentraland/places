import {
  explorerUrl,
  getThumbnailFromContentDeployment,
  getThumbnailFromDeployment,
  placeUrl,
  placesWithUserCount,
  placesWithUserVisits,
  sanitizeImageUrl,
  sanitizePlaceDescription,
  siteUrl,
  whatsOnPlaceUrl,
  whatsOnWorldUrl,
} from "./utils"
import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { genesisPlazaThumbnailMap } from "../../__data__/entities"
import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../__data__/sceneStatsGenesisPlaza"
import { sqsMessageWorld } from "../../__data__/sqs"
import {
  worldContentEntitySceneParalax,
  worldPlaceParalax,
} from "../../__data__/world"

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

  test("should return a whats-on URL for a place", () => {
    const url = whatsOnPlaceUrl(placeGenesisPlaza)
    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe(
      "https://decentraland.org/whats-on?position=0.0"
    )
  })

  test("should return a whats-on URL for a world", () => {
    const url = whatsOnWorldUrl(worldPlaceParalax)
    expect(url).toBeInstanceOf(URL)
    expect(url.toString()).toBe(
      "https://decentraland.org/whats-on?world=paralax.dcl.eth"
    )
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

describe("sanitizeImageUrl", () => {
  describe("when the value is a valid https url", () => {
    let value: string

    beforeEach(() => {
      value = "https://cdn.decentraland.org/thumb.png"
    })

    it("should return the normalized url", () => {
      expect(sanitizeImageUrl(value)).toBe(
        "https://cdn.decentraland.org/thumb.png"
      )
    })
  })

  describe("when the value contains HTML-breakout characters", () => {
    let value: string

    beforeEach(() => {
      value = `https://a"><meta http-equiv="refresh" content="0;url=https://example.com"><meta name="x`
    })

    it("should return null so the payload is never stored", () => {
      expect(sanitizeImageUrl(value)).toBeNull()
    })
  })

  describe("when the value uses a non-http(s) protocol", () => {
    let value: string

    beforeEach(() => {
      value = "javascript:alert(document.domain)"
    })

    it("should return null", () => {
      expect(sanitizeImageUrl(value)).toBeNull()
    })
  })

  describe("when the value is undefined", () => {
    let value: string | undefined

    beforeEach(() => {
      value = undefined
    })

    it("should return null", () => {
      expect(sanitizeImageUrl(value)).toBeNull()
    })
  })
})

describe("getThumbnailFromContentDeployment breakout handling", () => {
  describe("when navmapThumbnail is a verbatim https url with breakout characters", () => {
    let deployment: typeof contentEntitySceneGenesisPlaza

    beforeEach(() => {
      deployment = {
        ...contentEntitySceneGenesisPlaza,
        metadata: {
          ...contentEntitySceneGenesisPlaza.metadata,
          display: {
            navmapThumbnail: `https://a"><script>alert(1)</script><meta name="x`,
          },
        },
      }
    })

    it("should drop the payload and fall back to the map thumbnail", () => {
      expect(getThumbnailFromContentDeployment(deployment)).toBe(
        genesisPlazaThumbnailMap
      )
    })
  })

  describe("when navmapThumbnail is a valid external https url", () => {
    let deployment: typeof contentEntitySceneGenesisPlaza

    beforeEach(() => {
      deployment = {
        ...contentEntitySceneGenesisPlaza,
        metadata: {
          ...contentEntitySceneGenesisPlaza.metadata,
          display: {
            navmapThumbnail: "https://cdn.decentraland.org/thumb.png",
          },
        },
      }
    })

    it("should preserve the external thumbnail url", () => {
      expect(getThumbnailFromContentDeployment(deployment)).toBe(
        "https://cdn.decentraland.org/thumb.png"
      )
    })
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

describe("sanitizePlaceDescription", () => {
  describe("when the description embeds a TMP <link> tag to a custom protocol", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        'Join <link="decentraland://?position=0,0">click here</link>'
      )
    })

    it("should strip both sides of the unsafe link and keep the inner text", () => {
      expect(result).toBe("Join click here")
    })
  })

  describe("when the description embeds a <link> tag to a file/smb target", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        'a <link="file:///etc/passwd">x</link> b <link="smb://h/s">y</link> c'
      )
    })

    it("should strip every unsafe link without leaving orphan tags", () => {
      expect(result).toBe("a x b y c")
    })
  })

  describe("when the description embeds a safe https <link> tag", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        'Visit <link="https://decentraland.org">our site</link>'
      )
    })

    it("should preserve the link tag untouched", () => {
      expect(result).toBe(
        'Visit <link="https://decentraland.org">our site</link>'
      )
    })
  })

  describe("when the description embeds a safe http <link> tag", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription('<link="http://example.com">x</link>')
    })

    it("should preserve the link tag untouched", () => {
      expect(result).toBe('<link="http://example.com">x</link>')
    })
  })

  describe("when the description mixes a safe and an unsafe link", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        '<link="https://a.com">A</link><link="javascript:alert(1)">B</link>'
      )
    })

    it("should keep the safe link and strip the unsafe one", () => {
      expect(result).toBe('<link="https://a.com">A</link>B')
    })
  })

  describe("when a link tag carries extra content after the target", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        "<link=https://a.com onclick=x>t</link>"
      )
    })

    it("should strip the ambiguous tag (fail-safe)", () => {
      expect(result).toBe("t")
    })
  })

  describe("when a malformed opener embeds a nested tag before its closing bracket", () => {
    let result: string | null

    beforeEach(() => {
      // Without failing closed, the outer `<link…` fragment would survive and
      // the leftover pieces could re-assemble into a live
      // `<link="javascript:alert(1)">` opener.
      result = sanitizePlaceDescription(
        '<link="javascript:alert(1)"<b>>click</link>'
      )
    })

    it("should not leave a live unsafe link in the output", () => {
      expect(result).not.toMatch(/<link/i)
    })
  })

  describe("when a stripped tag reassembles the surrounding text into a new opener", () => {
    let result: string | null

    beforeEach(() => {
      // A single pass removes `<b>` and the orphan `</link>`, leaving `<` fused to
      // `link="javascript:alert(1)">` — a live opener that only a fixed point catches.
      result = sanitizePlaceDescription(
        '<<b>link="javascript:alert(1)">click</link>'
      )
    })

    it("should not leave a live unsafe link in the output", () => {
      expect(result).not.toMatch(/<link/i)
    })
  })

  describe("when a link points at the cloud-metadata IP", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        '<link="http://169.254.169.254/latest/meta-data/">x</link>'
      )
    })

    it("should strip it", () => {
      expect(result).toBe("x")
    })
  })

  describe("when a link points at an obfuscated loopback IP", () => {
    let result: string | null

    beforeEach(() => {
      // 2130706433 === 127.0.0.1; the URL parser normalizes it before the check.
      result = sanitizePlaceDescription('<link="http://2130706433/">x</link>')
    })

    it("should strip it", () => {
      expect(result).toBe("x")
    })
  })

  describe("when a link points at a private or localhost host", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        'a <link="http://192.168.1.1/">x</link> b <link="http://localhost:8080/">y</link> c'
      )
    })

    it("should strip both internal links", () => {
      expect(result).toBe("a x b y c")
    })
  })

  describe("when a link points at a public host", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription('<link="https://8.8.8.8/">x</link>')
    })

    it("should keep it", () => {
      expect(result).toBe('<link="https://8.8.8.8/">x</link>')
    })
  })

  describe("when a link points at a single-label or reserved-suffix host", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(
        'a <link="http://router/">x</link> b <link="http://printer.lan/">y</link> c <link="http://nas.local/">z</link> d'
      )
    })

    it("should strip these local-looking hosts", () => {
      expect(result).toBe("a x b y c z d")
    })
  })

  describe("when the description contains prose with comparison operators", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription("Open 5 < 10 hours & counting")
    })

    it("should leave non-tag angle brackets and ampersands untouched", () => {
      expect(result).toBe("Open 5 < 10 hours & counting")
    })
  })

  describe("when the description is null", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription(null)
    })

    it("should return null", () => {
      expect(result).toBeNull()
    })
  })

  describe("when the description is an empty string", () => {
    let result: string | null

    beforeEach(() => {
      result = sanitizePlaceDescription("")
    })

    it("should normalize it to null", () => {
      expect(result).toBeNull()
    })
  })
})
