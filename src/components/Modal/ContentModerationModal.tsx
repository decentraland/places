import React, { useCallback } from "react"

import Paragraph from "decentraland-gatsby/dist/components/Text/Paragraph"
import Title from "decentraland-gatsby/dist/components/Text/Title"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Modal, ModalProps } from "decentraland-ui/dist/components/Modal/Modal"

import { PlaceAttributes } from "../../entities/Place/types"
import RateFlagAdult from "../../images/rating-flag-adult.svg"
import RateFlagRestricted from "../../images/rating-flag-restricted.svg"
import RateFlagTeen from "../../images/rating-flag-teen.svg"

import "./index.css"

const RateImage = {
  [SceneContentRating.TEEN]: RateFlagTeen,
  [SceneContentRating.ADULT]: RateFlagAdult,
  [SceneContentRating.RESTRICTED]: RateFlagRestricted,
}

export type ContentModerationModalProps = ModalProps & {
  place: PlaceAttributes
  selectedRate: SceneContentRating
}

export default React.memo(function ContentModerationModal(
  props: ContentModerationModalProps
) {
  const {
    onOpen,
    onClose,
    onActionClick,
    place,
    open,
    selectedRate,
    className,
  } = props
  const l = useFormatMessage()

  const handleAction = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) =>
      onActionClick && onActionClick(e, props),
    [onActionClick]
  )

  const handleClose = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) =>
      onClose && onClose(e, { ...props, open: false }),
    [onClose]
  )

  return (
    <Modal
      onClose={onClose}
      onOpen={onOpen}
      open={open}
      className={TokenList.join(["moderation-modal", className])}
      size="tiny"
    >
      <Modal.Header>
        <img
          src={RateImage[SceneContentRating.RESTRICTED]}
          alt={SceneContentRating.RESTRICTED}
        />
      </Modal.Header>
      <Modal.Content>
        <Title>
          {l(
            `components.modal.content_moderation.you_are_about_title_${selectedRate.toLowerCase()}`,
            { place_name: place.title }
          )}
        </Title>
        <Paragraph>
          {l(
            `components.modal.content_moderation.you_are_about_description_${selectedRate.toLowerCase()}`
          )}
        </Paragraph>
      </Modal.Content>
      <Modal.Actions>
        <Button primary as="a" onClick={handleAction}>
          {l("components.modal.content_moderation.proceed")}
        </Button>
        <Button secondary as="a" onClick={handleClose}>
          {l("components.modal.content_moderation.cancel")}
        </Button>
      </Modal.Actions>
    </Modal>
  )
})
