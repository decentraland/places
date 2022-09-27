import React from "react"

import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import { Table } from "decentraland-ui/dist/components/Table/Table"

import { PlaceAttributes } from "../../../entities/Place/types"
import { placeTargetUrl } from "../../../entities/Place/utils"
import { SegmentPlace } from "../../../modules/segment"
import JoinButton from "../../Button/JoinButton"

import "./PlaceRealmActivity.css"

export type ReamlActivity = { name: string; activity: number }

export type PlaceRealmActivityProps = {
  place: PlaceAttributes
  activities: ReamlActivity[]
  loading?: boolean
}

export default React.memo(function PlaceRealmActivity(
  props: PlaceRealmActivityProps
) {
  const { place, activities, loading } = props
  const l = useFormatMessage()
  const isMobile = useMobileMediaQuery()

  const handleJumpInTrack = useTrackLinkContext()

  return (
    <div
      className={TokenList.join([
        "place-realm-activity",
        loading && "loading",
        isMobile && "hide",
      ])}
    >
      <Header sub>{l("components.place_realm_activity.title")}</Header>
      <Table basic="very">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>
              {l("components.place_realm_activity.realm")}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {l("components.place_realm_activity.players")}
            </Table.HeaderCell>
            <Table.HeaderCell></Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {activities
            .sort((activity1, activity2) =>
              activity1.activity < activity2.activity
                ? 1
                : activity1.activity > activity2.activity
                ? -1
                : 0
            )
            .map(({ name, activity }, index) => {
              return (
                <Table.Row key={index}>
                  <Table.Cell>{name.toLocaleUpperCase()}</Table.Cell>
                  <Table.Cell>{activity}</Table.Cell>
                  <Table.Cell textAlign="right">
                    <JoinButton
                      href={placeTargetUrl(place, name)}
                      loading={loading}
                      onClick={handleJumpInTrack}
                      data-event={SegmentPlace}
                      data-realm={name}
                    />
                  </Table.Cell>
                </Table.Row>
              )
            })}
        </Table.Body>
      </Table>
    </div>
  )
})
