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
 * Rejects a title that uses "test" as a separate word, which is how throwaway scenes name themselves.
 *
 * The separator is spelled out as "not alphanumeric" rather than using PostgreSQL's `\m` and `\M`
 * word anchors, because those count the underscore as a word character: `streaming_test` has no
 * word boundary before "test" and slipped through. Anything that is not a letter or a digit reads
 * as a separator here, so `streaming_test`, `test-scene` and `Test Plaza` are all caught while
 * `Contest`, `Latest`, `protest` and `Testing Ground` keep their letters glued to the match and stay.
 *
 * (`\b` is not an option either: in PostgreSQL it means backspace, not a boundary.)
 */
const TEST_WORD_TITLE_REGEX = "(^|[^a-z0-9])test([^a-z0-9]|$)"

/**
 * Trailing counter the editors append when a creator makes several scenes in a row: "New Scene 6",
 * "Untitled 3". Stripped before the title is compared against {@link PLACEHOLDER_TITLES} so the
 * numbered copies are caught by the same list as the originals. Only a trailing run of digits goes,
 * so a title that earns its number ("Scene 5", "Level 3") keeps it and stays out of the list.
 */
const PLACEHOLDER_TITLE_SUFFIX_REGEX = "\\s*[0-9]+\\s*$"

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
 */
export function buildContentQualityCondition(
  highlighted: SQLStatement,
  image: SQLStatement,
  title: SQLStatement
): SQLStatement {
  return SQL`
        AND (
          ${highlighted} IS TRUE
          OR (
            ${image} IS NOT NULL
            AND TRIM(${image}) <> ''
            AND NOT (${image} LIKE ANY (${PLACEHOLDER_IMAGE_PATTERNS}::text[]))
            AND TRIM(COALESCE(${title}, '')) <> ''
            AND ${title} !~* ${TEST_WORD_TITLE_REGEX}
            AND LOWER(TRIM(REGEXP_REPLACE(${title}, ${PLACEHOLDER_TITLE_SUFFIX_REGEX}, '')))
              <> ALL (${PLACEHOLDER_TITLES}::text[])
          )
        )`
}
