import { l2Contracts } from "@dcl/catalyst-contracts/dist"
import { listAbi } from "@dcl/catalyst-contracts/dist/abis"
import {
  PoiContract,
  getPoisFromContract,
} from "@dcl/catalyst-contracts/dist/utils"
import RequestManager, { ContractFactory, HTTPProvider } from "eth-connect"
import { memo } from "radash/dist/curry"

async function createContract(
  address: string,
  provider: HTTPProvider
): Promise<PoiContract> {
  const requestManager = new RequestManager(provider)
  const factory = new ContractFactory(requestManager, listAbi)
  return (await factory.at(address)) as any
}

export const getPois = memo(
  async () => {
    const opts = { fetch: fetch as any }

    const polygon = new HTTPProvider(
      "https://rpc.decentraland.org/polygon?project=catalyst-contracts-ci",
      opts
    )
    const contract = await createContract(l2Contracts.polygon.poi, polygon)
    const pois = await getPoisFromContract(contract)
    return pois
  },
  { ttl: Infinity }
)
