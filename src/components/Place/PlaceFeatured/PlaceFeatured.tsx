import React, { useCallback, useMemo, useState } from "react"

import { withPrefix } from "gatsby"

import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl/utils"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import env from "decentraland-gatsby/dist/utils/env"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Hero } from "decentraland-ui/dist/components/Hero/Hero"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { launchDesktopApp } from "../../../modules/desktop"
import locations from "../../../modules/locations"
import { SegmentPlace } from "../../../modules/segment"
import { placeClientOptions } from "../../../modules/utils"
import { getImageUrl } from "../../../utils/image"
import UserCount from "../../Label/UserCount/UserCount"
import DownloadModal from "../../Modal/DownloadModal"

import "./PlaceFeatured.css"

export type PlaceFeaturedProps = {
  item: AggregatePlaceAttributes
  loading?: boolean
}

export default React.memo(function PlaceFeatured(props: PlaceFeaturedProps) {
  const { item, loading } = props

  const l = useFormatMessage()

  const placeDetailUrl = useMemo(() => {
    if (item.world) return locations.world(item.world_name!)
    return locations.place(item.base_position)
  }, [item])

  const track = useTrackContext()
  const [showModal, setShowModal] = useState(false)

  let hasDecentralandLauncher: null | boolean = null

  const handleClick = useCallback(
    async function (e: React.MouseEvent<HTMLButtonElement>) {
      e.stopPropagation()
      e.preventDefault()
      if (event) {
        hasDecentralandLauncher = await launchDesktopApp(
          placeClientOptions(item)
        )

        !hasDecentralandLauncher && setShowModal(true)
      }

      track(SegmentPlace.JumpIn, {
        placeId: item?.id,
        place: SegmentPlace.highlighted,
        has_laucher: !!hasDecentralandLauncher,
      })
    },
    [item, track]
  )

  const handleModalClick = useCallback(
    async function (e: React.MouseEvent<HTMLButtonElement>) {
      e.stopPropagation()
      e.preventDefault()

      window.open(
        env("DECENTRALAND_DOWNLOAD_URL", "https://decentraland.org/download"),
        "_blank"
      )
    },
    [track, hasDecentralandLauncher]
  )

  return (
    <div
      className={TokenList.join(["place-featured", loading && "loading"])}
      style={{
        backgroundImage: `url("${getImageUrl(
          item.highlighted_image || item.image
        )}")`,
      }}
    >
      <div className="place-featured__overlay" />
      <Hero>
        <Hero.Header>
          <div className="place-featured__label-container">
            <UserCount loading={loading} value={item?.user_count || 0} />
          </div>
          {item.title}
        </Hero.Header>
        <Hero.Description>{item.description}</Hero.Description>
        <Hero.Actions>
          <Button primary onClick={handleClick}>
            {l("components.place_featured.jump_in")}
          </Button>

          <Button
            secondary
            as="a"
            href={withPrefix(placeDetailUrl)}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault()
              placeDetailUrl && navigate(placeDetailUrl)
            }}
          >
            {l("components.place_featured.find_out_more")}
          </Button>
        </Hero.Actions>
      </Hero>
      <DownloadModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onModalClick={handleModalClick}
      />
    </div>
  )
})
