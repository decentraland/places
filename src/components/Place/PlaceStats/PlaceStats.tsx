import React, { useMemo } from "react"

import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { Stats } from "decentraland-ui/dist/components/Stats/Stats"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { FeatureFlags } from "../../../modules/ff"
import shorterNumber from "../../../utils/number/sortenNumber"

import "./PlaceStats.css"

export type PlaceStatsProps = {
  place?: AggregatePlaceAttributes
  poi?: boolean
  loading?: boolean
  hideUserCount?: boolean
}

export default React.memo(function PlaceStats(props: PlaceStatsProps) {
  const { place, loading, poi, hideUserCount } = props
  const l = useFormatMessage()
  const [ff] = useFeatureFlagContext()
  const rating = useMemo(() => {
    if (
      !place ||
      (place.content_rating !== SceneContentRating.ADULT &&
        place.content_rating !== SceneContentRating.RESTRICTED)
    ) {
      return SceneContentRating.TEEN.toLowerCase()
    }
    return place.content_rating.toLowerCase()
  }, [place])

  return (
    <div className={TokenList.join(["place-stats", loading && "loading"])}>
      {/* @ts-expect-error decentraland-ui types missing children */}
      <Stats title={l("components.place_stats.age_rating_label")}>
        <Header className="place-stats__rating">
          {l(`components.place_stats.age_rating_${rating}`)}
        </Header>
      </Stats>

      {!hideUserCount && (
        // @ts-expect-error decentraland-ui types missing children
        <Stats title={l("components.place_stats.active")}>
          <Header>{shorterNumber(place?.user_count || 0)}</Header>
        </Stats>
      )}
      {/* @ts-expect-error decentraland-ui types missing children */}
      <Stats title={l("components.place_stats.favorites")}>
        <Header>{shorterNumber(place?.favorites || 0)}</Header>
      </Stats>
      {!place?.world && (
        // @ts-expect-error decentraland-ui types missing children
        <Stats title={l("components.place_stats.visits")}>
          <Header>{shorterNumber(place?.user_visits || 0)}</Header>
        </Stats>
      )}
      {/* @ts-expect-error decentraland-ui types missing children */}
      <Stats title={l("components.place_stats.updated")}>
        {Time.from(place?.deployed_at).format("D/MM/YYYY")}
      </Stats>
      {poi && (
        // @ts-expect-error decentraland-ui types missing children
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
