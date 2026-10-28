// ─────────────────────────────────────────────────────────────
// GraphQL helper
// ─────────────────────────────────────────────────────────────

const GRAPHQL_ENDPOINT = 'https://www.fflogs.com/api/v2/client';

export async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`FFLogs GraphQL request failed (${response.status}): ${body}`);
    }

    const json = await response.json() as { data?: T; errors?: { message: string }[] };

    if (json.errors?.length) {
        throw new Error(`FFLogs GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
    }

    if (!json.data) {
        throw new Error('FFLogs GraphQL returned no data.');
    }

    return json.data;
}
