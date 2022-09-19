import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import "./ButtonBox.css"

export type FavoriteBoxProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  active?: boolean
}

export default React.memo(function FavoriteBox(props: FavoriteBoxProps) {
  const { onClick, loading, active } = props
  const l = useFormatMessage()
  return (
    <Button
      secondary
      onClick={onClick}
      className="button-box icon"
      target="_blank"
      loading={loading}
      disabled={loading}
    >
      <Icon
        name="heart outline"
        className={TokenList.join([
          "button-box__icon",
          !!active && "button-box__icon--active",
        ])}
      />

      <Icon
        name="heart"
        className={TokenList.join([
          "button-box__icon",
          !!active && "button-box__icon--active",
        ])}
      />
      <Label>{l("components.button.favorite")}</Label>
    </Button>
  )
})
