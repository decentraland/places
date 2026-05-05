#!/usr/bin/env bash

# Smoke-test the public Places API surface against zone and prod, comparing
# shape and status. Bash + curl + jq, no install needed beyond jq.
#
# Usage:
#   ./scripts/compare-environments.sh
#   ./scripts/compare-environments.sh zone=https://places.decentraland.today

set -uo pipefail

ZONE="https://places.decentraland.zone"
PROD="https://places.decentraland.org"

for arg in "$@"; do
  case "$arg" in
    zone=*) ZONE="${arg#zone=}" ;;
    prod=*) PROD="${arg#prod=}" ;;
  esac
done

readonly RESET=$'\033[0m'
readonly RED=$'\033[31m'
readonly GREEN=$'\033[32m'
readonly YELLOW=$'\033[33m'
readonly DIM=$'\033[90m'
readonly BOLD=$'\033[1m'

ok()      { printf "  ${GREEN}OK${RESET}    %-50s %s\n" "$1" "${2:-}"; }
diff_msg(){ printf "  ${YELLOW}DIFF${RESET}  %-50s %s\n" "$1" "${2:-}"; }
fail()    { printf "  ${RED}FAIL${RESET}  %-50s %s\n" "$1" "${2:-}"; FAILED=$((FAILED+1)); }
skipped() { printf "  ${DIM}skip${RESET}  %s\n" "$1"; }
section() { printf "\n${BOLD}%s${RESET}\n" "$1"; }

FAILED=0

# fetch_status_body URL [METHOD] [BODY] -> writes "STATUS\nBODY" to stdout
fetch_status_body() {
  local url="$1"
  local method="${2:-GET}"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -o /tmp/places-cmp-body -w "%{http_code}" \
      -H "content-type: application/json" -H "accept: application/json" \
      -X "$method" -d "$body" --max-time 30 "$url" 2>/dev/null
  else
    curl -sS -o /tmp/places-cmp-body -w "%{http_code}" \
      -H "accept: application/json" \
      -X "$method" --max-time 30 "$url" 2>/dev/null
  fi
  printf "\n"
  cat /tmp/places-cmp-body
}

# top_keys < json -> sorted comma-separated top-level keys (or "" for arrays / non-object)
top_keys() {
  jq -r 'if type == "object" then keys | join(",") else "" end' 2>/dev/null
}

# data_len < json -> length of .data array, or empty
data_len() {
  jq -r 'if (.data | type) == "array" then (.data | length) else "" end' 2>/dev/null
}

# compare_get LABEL PATH [QUERY]
compare_get() {
  local label="$1" path="$2" query="${3:-}"
  local zone_out prod_out zone_status prod_status zone_body prod_body
  zone_out=$(fetch_status_body "${ZONE}${path}${query}")
  prod_out=$(fetch_status_body "${PROD}${path}${query}")
  zone_status=$(printf "%s" "$zone_out" | head -n1)
  prod_status=$(printf "%s" "$prod_out" | head -n1)
  zone_body=$(printf "%s" "$zone_out" | tail -n +2)
  prod_body=$(printf "%s" "$prod_out" | tail -n +2)

  local detail="GET ${path}${query}"

  if [[ "$zone_status" != "$prod_status" ]]; then
    fail "$label" "$detail [zone=$zone_status prod=$prod_status]"
    return
  fi
  if [[ "$zone_status" != 2* ]]; then
    fail "$label" "$detail [both=$zone_status]"
    return
  fi

  local zone_keys prod_keys zone_n prod_n
  zone_keys=$(printf "%s" "$zone_body" | top_keys)
  prod_keys=$(printf "%s" "$prod_body" | top_keys)
  if [[ "$zone_keys" != "$prod_keys" ]]; then
    fail "$label" "$detail shape mismatch [zone=$zone_keys prod=$prod_keys]"
    return
  fi
  zone_n=$(printf "%s" "$zone_body" | data_len)
  prod_n=$(printf "%s" "$prod_body" | data_len)
  if [[ -n "$zone_n" || -n "$prod_n" ]]; then
    ok "$label" "$detail [zone=$zone_status n=$zone_n  prod=$prod_status n=$prod_n]"
  else
    ok "$label" "$detail [zone=$zone_status prod=$prod_status]"
  fi
}

# compare_post LABEL PATH BODY
compare_post() {
  local label="$1" path="$2" body="$3"
  local zone_out prod_out zone_status prod_status zone_body prod_body
  zone_out=$(fetch_status_body "${ZONE}${path}" POST "$body")
  prod_out=$(fetch_status_body "${PROD}${path}" POST "$body")
  zone_status=$(printf "%s" "$zone_out" | head -n1)
  prod_status=$(printf "%s" "$prod_out" | head -n1)
  zone_body=$(printf "%s" "$zone_out" | tail -n +2)
  prod_body=$(printf "%s" "$prod_out" | tail -n +2)

  local detail="POST ${path}"
  if [[ "$zone_status" != "$prod_status" ]]; then
    fail "$label" "$detail [zone=$zone_status prod=$prod_status]"
    return
  fi
  if [[ "$zone_status" != 2* ]]; then
    fail "$label" "$detail [both=$zone_status]"
    return
  fi
  local zone_keys prod_keys
  zone_keys=$(printf "%s" "$zone_body" | top_keys)
  prod_keys=$(printf "%s" "$prod_body" | top_keys)
  if [[ "$zone_keys" != "$prod_keys" ]]; then
    fail "$label" "$detail shape mismatch [zone=$zone_keys prod=$prod_keys]"
    return
  fi
  ok "$label" "$detail [zone=$zone_status prod=$prod_status]"
}

# compare_status LABEL METHOD PATH EXPECTED_STATUS [BODY]
compare_status() {
  local label="$1" method="$2" path="$3" expected="$4" body="${5:-}"
  local zone_status prod_status
  zone_status=$(curl -sS -o /dev/null -w "%{http_code}" \
    ${body:+-H "content-type: application/json"} \
    -H "accept: application/json" \
    -X "$method" ${body:+-d "$body"} --max-time 30 "${ZONE}${path}")
  prod_status=$(curl -sS -o /dev/null -w "%{http_code}" \
    ${body:+-H "content-type: application/json"} \
    -H "accept: application/json" \
    -X "$method" ${body:+-d "$body"} --max-time 30 "${PROD}${path}")
  local detail="$method ${path}"
  if [[ "$zone_status" != "$prod_status" ]]; then
    fail "$label" "$detail [zone=$zone_status prod=$prod_status]"
  elif [[ "$zone_status" != "$expected" ]]; then
    fail "$label" "$detail [both=$zone_status — expected $expected]"
  else
    ok "$label" "$detail [both=$zone_status]"
  fi
}

# compare_auth_required LABEL METHOD PATH [BODY]
compare_auth_required() {
  local label="$1" method="$2" path="$3" body="${4:-}"
  local zone_status prod_status
  zone_status=$(curl -sS -o /dev/null -w "%{http_code}" \
    ${body:+-H "content-type: application/json"} \
    -H "accept: application/json" \
    -X "$method" ${body:+-d "$body"} --max-time 30 "${ZONE}${path}")
  prod_status=$(curl -sS -o /dev/null -w "%{http_code}" \
    ${body:+-H "content-type: application/json"} \
    -H "accept: application/json" \
    -X "$method" ${body:+-d "$body"} --max-time 30 "${PROD}${path}")

  local detail="$method ${path}"
  if [[ "$zone_status" != "$prod_status" ]]; then
    fail "$label" "$detail [zone=$zone_status prod=$prod_status]"
    return
  fi
  if [[ "$zone_status" == "401" || "$zone_status" == "400" || "$zone_status" == "403" ]]; then
    ok "$label" "$detail [both=$zone_status]"
  else
    fail "$label" "$detail unexpected status [both=$zone_status — expected 400/401/403]"
  fi
}

# fetch_first_id BASE PATH .field
fetch_first_id() {
  local base="$1" path="$2" jq_filter="$3"
  curl -sS --max-time 30 "${base}${path}" 2>/dev/null \
    | jq -r ".data | (.[0] // {}) | $jq_filter // empty"
}

printf "${BOLD}Comparing${RESET}\n"
printf "  zone: %s/api\n" "$ZONE"
printf "  prod: %s/api\n" "$PROD"

# ──────────────────────────────────────────────────────────────────────────
section "Public read endpoints:"
compare_get "list places"                "/api/places"        "?limit=3"
compare_get "list places (paginated)"    "/api/places"        "?limit=3&offset=10&order_by=created_at&order=desc"
compare_get "list places (search)"       "/api/places"        "?limit=3&search=plaza"
compare_get "list places (most_active)"  "/api/places"        "?limit=3&order_by=most_active"
compare_get "list worlds"                "/api/worlds"        "?limit=3"
compare_get "list worlds (most_active)"  "/api/worlds"        "?limit=3&order_by=most_active"
compare_get "world names"                "/api/world_names"   ""
compare_get "categories"                 "/api/categories"    ""
compare_get "categories (places)"        "/api/categories"    "?target=places"
compare_get "categories (worlds)"        "/api/categories"    "?target=worlds"
compare_get "map"                        "/api/map"           "?limit=10"
compare_get "map / places"               "/api/map/places"    "?limit=10"
compare_get "destinations"               "/api/destinations"  "?limit=3"
compare_get "destinations (only_worlds)" "/api/destinations"  "?only_worlds=true&limit=3"
compare_get "status"                     "/api/status"        ""

# ──────────────────────────────────────────────────────────────────────────
section "POST listing endpoints:"
ZONE_PLACE_ID=$(fetch_first_id "$ZONE" "/api/places?limit=10&order_by=like_score_best" '.id')
PROD_PLACE_ID=$(fetch_first_id "$PROD" "/api/places?limit=10&order_by=like_score_best" '.id')
ZONE_WORLD_ID=$(fetch_first_id "$ZONE" "/api/worlds?limit=10&order_by=like_score_best" '.id')
PROD_WORLD_ID=$(fetch_first_id "$PROD" "/api/worlds?limit=10&order_by=like_score_best" '.id')

compare_post "places by ids"        "/api/places"         "[\"${ZONE_PLACE_ID:-00000000-0000-0000-0000-000000000000}\"]"
compare_post "places status"        "/api/places/status"  "[\"${ZONE_PLACE_ID:-00000000-0000-0000-0000-000000000000}\"]"
compare_post "destinations by ids"  "/api/destinations"   "[\"${ZONE_PLACE_ID:-00000000-0000-0000-0000-000000000000}\",\"${ZONE_WORLD_ID:-myworld.dcl.eth}\"]"

# ──────────────────────────────────────────────────────────────────────────
section "By-id endpoints (using each env's first item):"
printf "  ${DIM}zone place_id: %s${RESET}\n" "${ZONE_PLACE_ID:-(none)}"
printf "  ${DIM}prod place_id: %s${RESET}\n" "${PROD_PLACE_ID:-(none)}"

if [[ -n "$ZONE_PLACE_ID" && -n "$PROD_PLACE_ID" ]]; then
  for endpoint in "/api/places/{ID}" "/api/places/{ID}/categories"; do
    z_url="${endpoint//\{ID\}/$ZONE_PLACE_ID}"
    p_url="${endpoint//\{ID\}/$PROD_PLACE_ID}"
    z_status=$(curl -sS -o /tmp/places-z -w "%{http_code}" --max-time 30 "${ZONE}${z_url}")
    p_status=$(curl -sS -o /tmp/places-p -w "%{http_code}" --max-time 30 "${PROD}${p_url}")
    z_keys=$(top_keys < /tmp/places-z)
    p_keys=$(top_keys < /tmp/places-p)
    label="GET $endpoint shape"
    if [[ "$z_status" == "$p_status" && "$z_keys" == "$p_keys" && "$z_status" == 2* ]]; then
      ok "$label" "[zone=$z_status prod=$p_status]"
    else
      fail "$label" "[zone=$z_status keys=$z_keys  prod=$p_status keys=$p_keys]"
    fi
  done
else
  skipped "place by-id (no places in one or both envs)"
fi

printf "  ${DIM}zone world_id: %s${RESET}\n" "${ZONE_WORLD_ID:-(none)}"
printf "  ${DIM}prod world_id: %s${RESET}\n" "${PROD_WORLD_ID:-(none)}"
if [[ -n "$ZONE_WORLD_ID" && -n "$PROD_WORLD_ID" ]]; then
  z_status=$(curl -sS -o /tmp/places-z -w "%{http_code}" --max-time 30 "${ZONE}/api/worlds/${ZONE_WORLD_ID}")
  p_status=$(curl -sS -o /tmp/places-p -w "%{http_code}" --max-time 30 "${PROD}/api/worlds/${PROD_WORLD_ID}")
  z_keys=$(top_keys < /tmp/places-z)
  p_keys=$(top_keys < /tmp/places-p)
  label="GET /api/worlds/{ID} shape"
  if [[ "$z_status" == "$p_status" && "$z_keys" == "$p_keys" && "$z_status" == 2* ]]; then
    ok "$label" "[zone=$z_status prod=$p_status]"
  else
    fail "$label" "[zone=$z_status keys=$z_keys  prod=$p_status keys=$p_keys]"
  fi
else
  skipped "world by-id (no worlds in one or both envs)"
fi

# ──────────────────────────────────────────────────────────────────────────
section "Not-found endpoints (404 must match):"
compare_status "GET /api/places/{fake}"  GET  "/api/places/00000000-0000-0000-0000-000000000000"  404
compare_status "GET /api/worlds/{fake}"  GET  "/api/worlds/00doesnotexist00.dcl.eth"             404

# ──────────────────────────────────────────────────────────────────────────
section "Auth-required endpoints (401/400 must match between envs):"
SAMPLE_PID="${ZONE_PLACE_ID:-00000000-0000-0000-0000-000000000000}"
SAMPLE_WID="${ZONE_WORLD_ID:-myworld.dcl.eth}"
compare_auth_required "PATCH /places/{id}/favorites"     PATCH  "/api/places/${SAMPLE_PID}/favorites" '{"favorites":true}'
compare_auth_required "PATCH /places/{id}/likes"         PATCH  "/api/places/${SAMPLE_PID}/likes"     '{"like":true}'
compare_auth_required "PATCH /worlds/{id}/favorites"     PATCH  "/api/worlds/${SAMPLE_WID}/favorites" '{"favorites":true}'
compare_auth_required "PATCH /worlds/{id}/likes"         PATCH  "/api/worlds/${SAMPLE_WID}/likes"     '{"like":true}'
compare_auth_required "PUT   /places/{id}/rating"        PUT    "/api/places/${SAMPLE_PID}/rating"    '{"content_rating":"E"}'
compare_auth_required "PUT   /places/{id}/highlight"     PUT    "/api/places/${SAMPLE_PID}/highlight" '{"highlighted":true}'
compare_auth_required "PUT   /places/{id}/featured"      PUT    "/api/places/${SAMPLE_PID}/featured"
compare_auth_required "DEL   /places/{id}/featured"      DELETE "/api/places/${SAMPLE_PID}/featured"
compare_auth_required "PUT   /places/{id}/ranking"       PUT    "/api/places/${SAMPLE_PID}/ranking"   '{"ranking":1}'
compare_auth_required "PUT   /worlds/{id}/featured"      PUT    "/api/worlds/${SAMPLE_WID}/featured"
compare_auth_required "DEL   /worlds/{id}/featured"      DELETE "/api/worlds/${SAMPLE_WID}/featured"
compare_auth_required "PUT   /worlds/{id}/rating"        PUT    "/api/worlds/${SAMPLE_WID}/rating"    '{"content_rating":"E"}'
compare_auth_required "PUT   /worlds/{id}/highlight"     PUT    "/api/worlds/${SAMPLE_WID}/highlight" '{"highlighted":true}'
compare_auth_required "PUT   /worlds/{id}/ranking"       PUT    "/api/worlds/${SAMPLE_WID}/ranking"   '{"ranking":1}'
compare_auth_required "POST  /report"                    POST   "/api/report"

# ──────────────────────────────────────────────────────────────────────────
section "Social link-preview HTML:"
for pair in "place?id=${SAMPLE_PID}" "place?position=-23,-96" "world?name=${SAMPLE_WID}"; do
  kind="${pair%%\?*}"; query="${pair#*\?}"
  z_status=$(curl -sS -o /tmp/places-z -w "%{http_code}" -H "accept: text/html" --max-time 30 "${ZONE}/places/${kind}/?${query}")
  p_status=$(curl -sS -o /tmp/places-p -w "%{http_code}" -H "accept: text/html" --max-time 30 "${PROD}/places/${kind}/?${query}")
  z_has_head=$(grep -c '<head' /tmp/places-z 2>/dev/null || echo 0)
  p_has_head=$(grep -c '<head' /tmp/places-p 2>/dev/null || echo 0)
  label="GET /places/${kind}/?${query}"
  if [[ "$z_status" == "$p_status" && "$z_status" == "200" && "$z_has_head" -ge 1 && "$p_has_head" -ge 1 ]]; then
    ok "$label" "[zone=$z_status prod=$p_status, both have <head>]"
  else
    fail "$label" "[zone=$z_status head=$z_has_head  prod=$p_status head=$p_has_head]"
  fi
done

# ──────────────────────────────────────────────────────────────────────────
section "Summary:"
if [[ "$FAILED" -eq 0 ]]; then
  printf "  ${GREEN}All checks passed.${RESET}\n"
  exit 0
else
  printf "  ${RED}${FAILED} check(s) failed.${RESET}\n"
  exit 1
fi
