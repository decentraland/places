import React, { useMemo } from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import env from "decentraland-gatsby/dist/utils/env"

import { JumpIn, JumpInProps } from "decentraland-ui2"

import { PlaceAttributes } from "../../entities/Place/types"
import { placeClientOptions } from "../../modules/utils"

export default React.memo(function JumpInPositionButton({
  loading,
  place,
  onTrack,
}: Pick<JumpInProps, "loading" | "onTrack"> & {
  place: Pick<PlaceAttributes, "base_position" | "world" | "world_name">
}) {
  const l = useFormatMessage()

  const desktopAppOptions = useMemo(
    () => place && placeClientOptions(place),
    [place]
  )

  return (
    <JumpIn
      variant="button"
      loading={loading}
      buttonText={l("components.button.jump_in")}
      desktopAppOptions={desktopAppOptions}
      downloadUrl={env(
        "DECENTRALAND_DOWNLOAD_URL",
        "https://decentraland.org/download"
      )}
      onTrack={onTrack}
      modalProps={{
        title: l("components.modal.download.title"),
        description: l("components.modal.download.description"),
        buttonLabel: l("components.modal.download.button_label"),
      }}
    />
  )
})
