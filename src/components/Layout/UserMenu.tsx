import React from "react"

import Menu from "decentraland-gatsby/dist/components/User/UserMenu"
import UserInformation from "decentraland-gatsby/dist/components/User/UserInformation"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import MenuItem from "semantic-ui-react/dist/commonjs/collections/Menu/MenuItem"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon/Icon"

import locations from "../../modules/locations"
import { FeatureFlags } from "../../modules/ff"

const handleClickDocs = () => navigate(locations.docs())

export default React.memo(function UserMenu() {
  const l = useFormatMessage()

  const [ff] = useFeatureFlagContext()

  return ff.flags[FeatureFlags.NewNavbar] ? (
    <UserInformation />
  ) : (
    <Menu
      menuItems={
        <>
          <MenuItem onClick={handleClickDocs}>
            <Icon name="code" />
            {l("user_menu.api")}
          </MenuItem>
        </>
      }
    />
  )
})
