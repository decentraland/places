import React, { useCallback } from "react"

import Paragraph from "decentraland-gatsby/dist/components/Text/Paragraph"
import Title from "decentraland-gatsby/dist/components/Text/Title"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Modal, ModalProps } from "decentraland-ui/dist/components/Modal/Modal"

import CheckIcon from "../../images/check-icon.svg"

import "./index.css"

export type ConfirmRatingModalProps = ModalProps & {
  selectedRate: SceneContentRating
  sceneName: string
  className?: string
  loading?: boolean
}

export default React.memo(function ConfirmRatingModal(
  props: ConfirmRatingModalProps
) {
  const { onClose, open, loading, selectedRate, sceneName, className } = props
  const l = useFormatMessage()

  const handleClose = useCallback(
    (e) => onClose && onClose(e, { ...props, open: false }),
    [onClose]
  )

  return (
    <Modal
      onClose={onClose}
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
            `components.modal.confirmed_rating.description_${selectedRate.toLowerCase()}`,
            {
              scene_name: sceneName,
            }
          )}
        </Paragraph>
      </Modal.Content>
      <Modal.Actions>
        <Button
          primary
          as="a"
          target="_blank"
          onClick={handleClose}
          loading={loading}
          disabled={loading}
        >
          {l(`components.modal.confirmed_rating.button_label`)}
        </Button>
      </Modal.Actions>
    </Modal>
  )
})
