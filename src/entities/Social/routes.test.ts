import { randomUUID } from "crypto"

import { Request, Response } from "express"

import { injectPlaceMetadata, injectWorldMetadata } from "./routes"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { worldPlaceParalax } from "../../__data__/world"
import PlaceModel from "../Place/model"
import { AggregatePlaceAttributes } from "../Place/types"
import WorldModel from "../World/model"
import { AggregateWorldAttributes } from "../World/types"

const BREAKOUT = `https://a"><script>alert(1)</script><meta name="x`

describe("injectPlaceMetadata", () => {
  let res: Response
  let findById: jest.SpyInstance

  beforeEach(() => {
    res = { set: jest.fn() } as unknown as Response
    findById = jest.spyOn(PlaceModel, "findByIdWithAggregates")
  })

  afterEach(() => {
    findById.mockReset()
  })

  describe("when the stored place image contains HTML-breakout characters", () => {
    let html: string

    beforeEach(async () => {
      const id = randomUUID()
      findById.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        image: BREAKOUT,
      } as AggregatePlaceAttributes)
      const req = { query: { id } } as unknown as Request
      html = (await injectPlaceMetadata(req, res)) as unknown as string
    })

    it("should not render a live script element from the stored image", () => {
      expect(html).not.toContain("<script>alert(1)</script>")
    })

    it("should not emit the crafted payload as the og:image content", () => {
      expect(html).not.toContain(BREAKOUT)
    })
  })

  describe("when the stored place image is a valid https url", () => {
    let html: string

    beforeEach(async () => {
      const id = randomUUID()
      findById.mockResolvedValueOnce({
        ...placeGenesisPlazaWithAggregatedAttributes,
        image: "https://cdn.decentraland.org/thumb.png",
      } as AggregatePlaceAttributes)
      const req = { query: { id } } as unknown as Request
      html = (await injectPlaceMetadata(req, res)) as unknown as string
    })

    it("should render it as the og:image content", () => {
      expect(html).toContain(`content="https://cdn.decentraland.org/thumb.png"`)
    })
  })
})

describe("injectWorldMetadata", () => {
  let res: Response
  let findById: jest.SpyInstance

  beforeEach(() => {
    res = { set: jest.fn() } as unknown as Response
    findById = jest.spyOn(WorldModel, "findByIdWithAggregates")
  })

  afterEach(() => {
    findById.mockReset()
  })

  describe("when the stored world image contains HTML-breakout characters", () => {
    let html: string

    beforeEach(async () => {
      findById.mockResolvedValueOnce({
        ...worldPlaceParalax,
        image: BREAKOUT,
      } as unknown as AggregateWorldAttributes)
      const req = {
        query: { name: worldPlaceParalax.world_name },
      } as unknown as Request
      html = (await injectWorldMetadata(req, res)) as unknown as string
    })

    it("should not render a live script element from the stored image", () => {
      expect(html).not.toContain("<script>alert(1)</script>")
    })

    it("should not emit the crafted payload as the og:image content", () => {
      expect(html).not.toContain(BREAKOUT)
    })
  })

  describe("when the stored world image is a valid https url", () => {
    let html: string

    beforeEach(async () => {
      findById.mockResolvedValueOnce({
        ...worldPlaceParalax,
        image: "https://cdn.decentraland.org/thumb.png",
      } as unknown as AggregateWorldAttributes)
      const req = {
        query: { name: worldPlaceParalax.world_name },
      } as unknown as Request
      html = (await injectWorldMetadata(req, res)) as unknown as string
    })

    it("should render it as the og:image content", () => {
      expect(html).toContain(`content="https://cdn.decentraland.org/thumb.png"`)
    })
  })
})
