import API from "decentraland-gatsby/dist/utils/api/API"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import { memo } from "radash/dist/curry"

export const getServers = memo(async () => {
  try {
    const servers = await Catalyst.get().getServers()
    return Promise.all(
      servers.map(async (server) => ({
        ...server,
        status: await API.catch(Catalyst.from(server.baseUrl).getCommsStatus()),
        stats: await API.catch(Catalyst.from(server.baseUrl).getStatsParcels()),
      }))
    )
  } catch (error) {
    return []
  }
})
