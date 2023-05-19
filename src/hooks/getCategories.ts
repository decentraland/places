import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"

export function useGetCategories() {
  const mockedCategory = {
    _id: "64663d9e101fd76c89bebf09",
    updatedAt: "2023-05-18T15:11:57.976Z",
    createdAt: "2023-05-18T15:00:46.699Z",
    name: "gaming.",
    places: [
      "19f2ea87-6895-4433-ad3e-fc2f655bbf4e",
      "49e58473-34f2-4ebc-9377-579a27ff5cff",
      "316a0714-c295-47fc-82f5-4ba7d6b22d13",
      "bf1bc943-55fd-48e1-b5e0-cbd343ce6658",
      "d9bdead1-b422-48ea-9266-f465c7362569",
      "72d20335-60a8-40d2-87e9-b50fb72786d1",
      "52b01ec7-1889-4c00-8c5d-6fe72a313526",
      "411c67a0-9f21-42cf-99fc-a3579d4a4d79",
      "9866dfb8-2f9b-408b-aec9-a891602ca73c",
      "d3708d04-150a-4450-a96e-7b539383a2a5",
      "d9bdead1-b422-48ea-9266-f465c7362569",
    ],
    __v: 0,
  }

  return useAsyncMemo(
    async () => {
      return Places.get().getCategories()
      return [
        mockedCategory,
        mockedCategory,
        mockedCategory,
        mockedCategory,
        mockedCategory,
        mockedCategory,
      ]
    },
    [],
    {
      callWithTruthyDeps: true,
      initialValue: [],
    }
  )
}
