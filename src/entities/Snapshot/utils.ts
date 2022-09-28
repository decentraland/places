import logger from "decentraland-gatsby/dist/entities/Development/logger"
import fetch from "node-fetch"
import isEthereumAddress from "validator/lib/isEthereumAddress"

const strategies = [
  {
    name: "multichain",
    network: "1",
    params: {
      name: "multichain",
      graphs: {
        137: "https://api.thegraph.com/subgraphs/name/decentraland/blocks-matic-mainnet",
      },
      symbol: "MANA",
      strategies: [
        {
          name: "erc20-balance-of",
          params: {
            address: "0x0f5d2fb29fb7d3cfee444a200298f468908cc942",
            decimals: 18,
          },
          network: "1",
        },
        {
          name: "erc20-balance-of",
          params: {
            address: "0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4",
            decimals: 18,
          },
          network: "137",
        },
      ],
    },
  },
  {
    name: "erc20-balance-of",
    network: "1",
    params: {
      symbol: "WMANA",
      address: "0xfd09cf7cfffa9932e33668311c4777cb9db3c9be",
      decimals: 18,
    },
  },
  {
    name: "erc721-with-multiplier",
    network: "1",
    params: {
      symbol: "LAND",
      address: "0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d",
      multiplier: 2000,
    },
  },
  {
    name: "decentraland-estate-size",
    network: "1",
    params: {
      symbol: "ESTATE",
      address: "0x959e104e1a4db6317fa58f8295f586e1a978c297",
      multiplier: 2000,
    },
  },
  {
    name: "erc721-with-multiplier",
    network: "1",
    params: {
      symbol: "NAMES",
      address: "0x2a187453064356c898cae034eaed119e1663acb8",
      multiplier: 100,
    },
  },
]

export async function fetchScore(address: string) {
  if (!isEthereumAddress(address)) {
    return 0
  }

  const data: ScoreRequest = {
    jsonrpc: "2.0",
    method: "get_vp",
    params: {
      network: "1",
      address: address.toLowerCase(),
      strategies,
      space: "snapshot.dcl.eth",
      delegation: false,
    },
  }

  try {
    const res = await fetch(`https://score.snapshot.org/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
    })

    const body: ScoreResponse = await res.json()
    return (body?.result?.vp || 0) | 0
  } catch (err) {
    logger.error(`Error loading user score: ${(err as Error).message}`, data)
    return 0
  }
}

export type ScoreRequest = {
  jsonrpc: "2.0"
  method: "get_vp"
  params: {
    address: string
    network: "1"
    strategies: any[]
    snapshot?: number
    space: string
    delegation: boolean
  }
}

type ScoreResponse = {
  jsonrpc: "2.0"
  result: {
    vp: number
    vp_by_strategy: number
    vp_state: string
  }
}
