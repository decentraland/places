import {
  allPlacesWithAggregates,
  placesWithCoordinatesAggregates,
} from "./utils"
import { allPlacesWithAggregatedAttributes } from "../../__data__/allPlacesWithAggregatedAttributes"
import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { sceneStatsGenesisPlaza } from "../../__data__/sceneStatsGenesisPlaza"
import { worldsLiveData } from "../../__data__/worldsLiveData"

describe("get of AggregatePlaceAttributes", () => {
  test("should return a place of type AggregateCoordinatePlaceAttributes", () => {
    const places = placesWithCoordinatesAggregates(
      [placeGenesisPlazaWithAggregatedAttributes],
      [hotSceneGenesisPlaza],
      sceneStatsGenesisPlaza
    )
    expect(places).toEqual({
      ["0,0"]: {
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
      ["0,0"]: {
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

describe("get of AllPlacesWithAggregates", () => {
  test("should return a place of type AggregateCoordinatePlaceAttributes", () => {
    const places = allPlacesWithAggregates(
      allPlacesWithAggregatedAttributes,
      [hotSceneGenesisPlaza],
      sceneStatsGenesisPlaza,
      worldsLiveData
    )
    expect(places).toEqual([
      {
        ...allPlacesWithAggregatedAttributes[0],
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits:
          sceneStatsGenesisPlaza[
            allPlacesWithAggregatedAttributes[0].base_position
          ].last_30d.users,
      },
      {
        ...allPlacesWithAggregatedAttributes[1],
        user_count: worldsLiveData.perWorld[0].users,
        // TODO: Get user visits from world stats
        user_visits: 0,
      },
    ])
  })

  test("should return a place of type AggregatePlaceAttributes with user_visits when not match the base position", () => {
    const place = {
      ...allPlacesWithAggregatedAttributes[0],
      base_position: "-1,-1",
    }
    const places = allPlacesWithAggregates(
      [place],
      [hotSceneGenesisPlaza],
      sceneStatsGenesisPlaza,
      worldsLiveData
    )
    expect(places).toEqual([
      {
        ...place,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits:
          sceneStatsGenesisPlaza[
            allPlacesWithAggregatedAttributes[0].base_position
          ].last_30d.users,
      },
    ])
  })

  test("should return a place of type AggregatePlaceAttributes with realm details", () => {
    const places = allPlacesWithAggregates(
      allPlacesWithAggregatedAttributes,
      [hotSceneGenesisPlaza],
      sceneStatsGenesisPlaza,
      worldsLiveData,
      { withRealmsDetail: true }
    )
    expect(places).toEqual([
      {
        ...allPlacesWithAggregatedAttributes[0],
        user_count: hotSceneGenesisPlaza.usersTotalCount,
        user_visits:
          sceneStatsGenesisPlaza[
            allPlacesWithAggregatedAttributes[0].base_position
          ].last_30d.users,
        realms_detail: hotSceneGenesisPlaza.realms,
      },
      {
        ...allPlacesWithAggregatedAttributes[1],
        user_count: worldsLiveData.perWorld[0].users,
        // TODO: Get user visits from world stats
        user_visits: 0,
      },
    ])
  })
})
