import React from "react"

import Paragraph from "decentraland-gatsby/dist/components/Text/Paragraph"
import Title from "decentraland-gatsby/dist/components/Text/Title"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Modal } from "decentraland-ui/dist/components/Modal/Modal"

import CheckIcon from "../../images/check-icon.svg"

import "./index.css"

export type ConfirmRatingModalProps = {
  onConfirmRating: (e: React.MouseEvent<HTMLElement>) => void
  open: boolean
  selectedRate: SceneContentRating
  sceneName: string
  className?: string
}

export default React.memo(function ConfirmRatingModal(
  props: ConfirmRatingModalProps
) {
  const { onConfirmRating, open, selectedRate, sceneName, className } = props
  const l = useFormatMessage()

  return (
    <Modal
      onClose={onConfirmRating}
      open={open}
      className={TokenList.join(["moderation-modal", className])}
      size="tiny"
    >
      <Modal.Header>
        <img src={CheckIcon} alt="restricted" />
      </Modal.Header>
      <Modal.Content>
        <Title>
          {l(`components.modal.confirmed_rating.title`, {
            scene_name: sceneName,
            rating: selectedRate,
          })}
        </Title>
        <Paragraph>
          {l(
            `components.modal.confirmed_rating.description_${selectedRate.toLocaleLowerCase()}`,
            {
              scene_name: sceneName,
            }
          )}
        </Paragraph>
      </Modal.Content>
      <Modal.Actions>
        <Button primary as="a" target="_blank" onClick={onConfirmRating}>
          {l(`components.modal.confirmed_rating.button_label`)}
        </Button>
      </Modal.Actions>
    </Modal>
  )
})
