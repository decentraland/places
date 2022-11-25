import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { Stats } from "decentraland-ui/dist/components/Stats/Stats"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import shorterNumber from "../../../utils/number/sortenNumber"

import "./PlaceStats.css"

export type PlaceStatsProps = {
  place?: AggregatePlaceAttributes
  users?: number
  poi?: boolean
  loading?: boolean
}

export default React.memo(function PlaceStats(props: PlaceStatsProps) {
  const { users, place, loading, poi } = props
  const l = useFormatMessage()

  return (
    <div className={TokenList.join(["place-stats", loading && "loading"])}>
      <Stats title={l("components.place_stats.active")}>
        <Header>{users}</Header>
      </Stats>
      <Stats title={l("components.place_stats.favorites")}>
        <Header>{shorterNumber(place?.favorites || 0)}</Header>
      </Stats>
      <Stats title={l("components.place_stats.visits")}>
        <Header>{shorterNumber(place?.user_visits || 0)}</Header>
      </Stats>
      <Stats title={l("components.place_stats.added")}>
        {Time.from(place?.created_at).format("D/MM/YYYY")}
      </Stats>
      <Stats title={l("components.place_stats.updated")}>
        {Time.from(place?.last_deployed_at).format("D/MM/YYYY")}
      </Stats>
      {poi && (
        <Stats
          title={l("components.place_stats.point_of_interest")}
          className="place-stats__point-of-interest"
        >
          <Label>
            <Icon name="star" />
          </Label>
        </Stats>
      )}
    </div>
  )
})
