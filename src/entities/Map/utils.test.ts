import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../__data__/sceneStatsGenesisPlaza"
import { placesWithCoordinatesAggregates } from "./utils"

describe("get of AggregatePlaceAttributes", () => {
  test("should return a place of type AggregateCoordinatePlaceAttributes", () => {
    const places = placesWithCoordinatesAggregates(
      [placeGenesisPlazaWithAggregatedAttributes],
      [hotSceneGenesisPlaza],
      sceneStatsGenesisPlaza
    )
    expect(places).toEqual({
      ["-9,-9"]: {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits:
          sceneStatsGenesisPlaza[
            placeGenesisPlazaWithAggregatedAttributes.base_position
          ].last_30d.users,
        positions: undefined,
      },
    })
  })

  test("should return a place of type AggregatePlaceAttributes with user_visits when not match the base position", () => {
    const place = {
      ...placeGenesisPlazaWithAggregatedAttributes,
      base_position: "-1,-1",
    }
    const places = placesWithCoordinatesAggregates(
      [place],
      [hotSceneGenesisPlaza],
      sceneStatsGenesisPlaza
    )
    expect(places).toEqual({
      ["-1,-1"]: {
        ...place,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits:
          sceneStatsGenesisPlaza[
            placeGenesisPlazaWithAggregatedAttributes.base_position
          ].last_30d.users,
        positions: undefined,
      },
    })
  })

  test("should return a place of type AggregatePlaceAttributes with realm details", () => {
    const places = placesWithCoordinatesAggregates(
      [placeGenesisPlazaWithAggregatedAttributes],
      [hotSceneGenesisPlaza],
      sceneStatsGenesisPlaza,
      { withRealmsDetail: true }
    )
    expect(places).toEqual({
      ["-9,-9"]: {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits:
          sceneStatsGenesisPlaza[
            placeGenesisPlazaWithAggregatedAttributes.base_position
          ].last_30d.users,
        realms_detail: hotSceneGenesisPlaza.realms,
        positions: undefined,
      },
    })
  })
})
