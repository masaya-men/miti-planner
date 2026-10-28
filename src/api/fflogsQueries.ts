/** FFLogs GraphQL クエリ文字列(src/api/fflogs.ts から分離)。 */

// ─────────────────────────────────────────────────────────────
// Fight metadata query
// ─────────────────────────────────────────────────────────────
export const FIGHTS_QUERY = /* graphql */`
  query GetFights($reportCode: String!) {
    reportData {
      report(code: $reportCode) {
        fights(killType: Encounters) {
          id
          startTime
          endTime
          name
          difficulty
          kill
          encounterID
          phaseTransitions {
            id
            startTime
          }
        }
        phases {
          encounterID
          phases {
            id
            name
          }
        }
      }
    }
  }
`;


/**
 * Build a GraphQL query for enemy damage done TO players.
 *
 * - dataType: DamageDone + hostilityType: Enemies = damage dealt by enemies
 * - useAbilityIDs: false → get full ability objects
 * - translate: when true, returns ability names in the report's native language;
 *   when false (default), returns English names.
 */
export function buildDamageEventsQuery(translate: boolean): string {
    return /* graphql */`
      query GetEnemyDamageDone(
        $reportCode: String!
        $fightIds: [Int]!
        $startTime: Float!
        $endTime: Float!
      ) {
        reportData {
          report(code: $reportCode) {
            events(
              dataType: DamageDone
              fightIDs: $fightIds
              hostilityType: Enemies
              startTime: $startTime
              endTime: $endTime
              limit: 10000
              useAbilityIDs: false
              includeResources: false
              translate: ${translate}
            ) {
              data
              nextPageTimestamp
            }
          }
        }
      }
    `;
}

export function buildCastEventsQuery(translate: boolean): string {
    return /* graphql */`
      query GetEnemyCasts(
        $reportCode: String!
        $fightIds: [Int]!
        $startTime: Float!
        $endTime: Float!
      ) {
        reportData {
          report(code: $reportCode) {
            events(
              dataType: Casts
              fightIDs: $fightIds
              hostilityType: Enemies
              startTime: $startTime
              endTime: $endTime
              limit: 10000
              useAbilityIDs: false
              includeResources: false
              translate: ${translate}
            ) {
              data
              nextPageTimestamp
            }
          }
        }
      }
    `;
}

export function buildDeathEventsQuery(): string {
    return /* graphql */`
      query GetDeathEvents(
        $reportCode: String!
        $fightIds: [Int]!
        $startTime: Float!
        $endTime: Float!
      ) {
        reportData {
          report(code: $reportCode) {
            events(
              dataType: Deaths
              fightIDs: $fightIds
              startTime: $startTime
              endTime: $endTime
              limit: 10000
            ) {
              data
              nextPageTimestamp
            }
          }
        }
      }
    `;
}

export const PLAYER_DETAILS_QUERY = /* graphql */`
  query GetPlayerDetails($reportCode: String!, $fightIDs: [Int]!) {
    reportData {
      report(code: $reportCode) {
        playerDetails(fightIDs: $fightIDs)
      }
    }
  }
`;
