import {
  SQL,
  SQLStatement,
} from "decentraland-gatsby/dist/entities/Database/utils"

import {
  MAP_FALLBACK_IMAGE_PATH,
  PLACEHOLDER_TITLES,
  WORLD_DEFAULT_THUMBNAIL_HASH,
  unwantedThumbnailHash,
} from "../Place/types"

/**
 * LIKE patterns for every image value produced by a fallback rather than by the scene: the Genesis
 * City map render (matched by its path, since its host is environment-dependent) and the placeholder
 * thumbnails, whose content hash can appear behind any content-server host.
 */
const PLACEHOLDER_IMAGE_PATTERNS = [
  `%${MAP_FALLBACK_IMAGE_PATH}%`,
  ...[WORLD_DEFAULT_THUMBNAIL_HASH, ...unwantedThumbnailHash].map(
    (hash) => `%${hash}%`
  ),
]

/**
 * Rejects a title that uses "test" as a word of its own, which is how throwaway scenes name
 * themselves. Two ways a title can do that, and the pattern needs both.
 *
 * Punctuation, spaces and the string's edges are separators, matched case-insensitively:
 * `Test Plaza`, `streaming_test`, `test-scene`, `TEST`. Underscores have to be spelled out this way
 * because PostgreSQL's `\m` and `\M` word anchors count the underscore as a word character, so
 * `streaming_test` has no boundary before "test" and slipped through. (`\b` is not an option either:
 * in PostgreSQL that means backspace.)
 *
 * Capitalisation is the other separator: in `conTest` the capital T starts a new word, so it is a
 * test scene, while `contest` is an ordinary English word and stays. This half is deliberately
 * case-sensitive, which is why the whole pattern is applied with `!~` rather than `!~*`. It also
 * covers `TheTestScene` and `TestScene`, where "Test" is bounded by capitals rather than by
 * punctuation.
 *
 * Kept by both halves: `contest`, `Contest`, `Latest`, `protest`, `testament`, `Testing Grounds`.
 */
const TEST_WORD_TITLE_REGEX =
  "(^|[^A-Za-z0-9])[Tt][Ee][Ss][Tt]([^A-Za-z0-9]|$)|(^|[a-z0-9])Test([A-Z]|[^A-Za-z0-9]|$)"

/**
 * Trailing counter the editors append when a creator makes several scenes in a row: "New Scene 6",
 * "Untitled 3". Stripped before the title is compared against {@link PLACEHOLDER_TITLES} so the
 * numbered copies are caught by the same list as the originals. Only a trailing run of digits goes,
 * and the number carries no meaning of its own either way: "Scene 5" is stripped to a placeholder
 * and hidden, while "The Land 5" and "Level 3" strip to real names and stay.
 */
const PLACEHOLDER_TITLE_SUFFIX_REGEX = "\\s*[0-9]+\\s*$"

/**
 * Contact name the sdk-commands template ships when the creator never fills one in. It identifies
 * the tooling rather than a person, so it counts as no contact at all.
 */
const TEMPLATE_CONTACT_NAME = "sdk"

/**
 * Require a destination to carry information of its own: an image and a title that the deployment
 * pipeline did not fill in for it.
 *
 * Curation wins over the check. A highlighted destination was chosen by a human, so whatever its
 * columns look like it stays in the feed.
 *
 * Emitted as a leading `AND` so it can be appended to an open WHERE clause, and every value is
 * bound as a parameter.
 *
 * @param highlighted - the curation flag, qualified with the table alias
 * @param image - the image *as the query returns it*; for worlds that is the COALESCE over the
 *   world column and the latest place's, never the world column alone. Null, empty and blank are
 *   all rejected: none of them gives the feed anything to render.
 * @param title - the title column, qualified with the table alias. A null, empty or blank title is
 *   rejected too: the deployment pipeline substitutes "Untitled" when a scene ships none, so a
 *   stored blank means the row predates that or came in through another path, and either way it
 *   names nothing.
 * @param owner - the owner address column
 * @param contactName - the contact name column. Together with `owner` these answer "is there anyone
 *   behind this scene": a destination nobody claims has no creator to send a visitor to, and the web
 *   has been hiding those in the browser for a while. Doing it here is what makes the two surfaces
 *   agree.
 */
export function buildContentQualityCondition(
  highlighted: SQLStatement,
  image: SQLStatement,
  title: SQLStatement,
  owner: SQLStatement,
  contactName: SQLStatement,
  basePosition?: SQLStatement
): SQLStatement {
  // Roads only exist in Genesis City, so only the places branch passes a base position. A road
  // clears every other check here: it has an image, a title and the Foundation as contact. The map
  // is the sole authority on what is a road, and `road_positions` is its list.
  const notARoad = basePosition
    ? SQL`
            AND NOT EXISTS (
              SELECT 1 FROM road_positions rp WHERE rp.position = ${basePosition}
            )`
    : SQL``
  return SQL`
        AND (
          ${highlighted} IS TRUE
          OR (
            ${image} IS NOT NULL
            AND TRIM(${image}) <> ''
            AND NOT (${image} LIKE ANY (${PLACEHOLDER_IMAGE_PATTERNS}::text[]))
            AND TRIM(COALESCE(${title}, '')) <> ''
            AND ${title} !~ ${TEST_WORD_TITLE_REGEX}
            AND LOWER(TRIM(REGEXP_REPLACE(${title}, ${PLACEHOLDER_TITLE_SUFFIX_REGEX}, '')))
              <> ALL (${PLACEHOLDER_TITLES}::text[])
            AND (
              TRIM(COALESCE(${owner}, '')) <> ''
              OR (
                TRIM(COALESCE(${contactName}, '')) <> ''
                AND LOWER(TRIM(${contactName})) <> ${TEMPLATE_CONTACT_NAME}
              )
            )${notARoad}
          )
        )`
}
