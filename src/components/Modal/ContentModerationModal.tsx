import React from "react"

import Paragraph from "decentraland-gatsby/dist/components/Text/Paragraph"
import Title from "decentraland-gatsby/dist/components/Text/Title"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Modal } from "decentraland-ui/dist/components/Modal/Modal"

import { PlaceAttributes } from "../../entities/Place/types"
import RateFlagAdult from "../../images/rating-flag-adult.svg"
import RateFlagRestricted from "../../images/rating-flag-restricted.svg"
import RateFlagTeen from "../../images/rating-flag-teen.svg"

import "./index.css"

export type ContentModerationModalProps = {
  onClickOpen: (e: React.MouseEvent<HTMLElement>, action: boolean) => void
  onChangeRating: (e: React.MouseEvent<HTMLElement>) => void
  place: PlaceAttributes
  open: boolean
  selectedRate: SceneContentRating
  className?: string
}

export default React.memo(function ContentModerationModal(
  props: ContentModerationModalProps
) {
  const { onClickOpen, onChangeRating, place, open, selectedRate, className } =
    props
  const l = useFormatMessage()

  return (
    <Modal
      onClose={(e) => onClickOpen(e, false)}
      onOpen={(e) => onClickOpen(e, true)}
      open={open}
      className={TokenList.join(["moderation-modal", className])}
      size="tiny"
    >
      <Modal.Header>
        {selectedRate === SceneContentRating.RESTRICTED && (
          <img src={RateFlagRestricted} alt="restricted" />
        )}
        {selectedRate === SceneContentRating.ADULT && (
          <img src={RateFlagAdult} alt="rate" />
        )}
        {selectedRate !== SceneContentRating.ADULT &&
          selectedRate !== SceneContentRating.RESTRICTED && (
            <img src={RateFlagTeen} alt="rate" />
          )}
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
        <Button primary as="a" target="_blank" onClick={onChangeRating}>
          {l("components.modal.content_moderation.proceed")}
        </Button>
        <Button
          secondary
          as="a"
          target="_blank"
          onClick={(e) => onClickOpen(e, false)}
        >
          {l("components.modal.content_moderation.cancel")}
        </Button>
      </Modal.Actions>
    </Modal>
  )
})
