

async function test() {
  const clientId = process.env.VITE_FFLOGS_CLIENT_ID;
  const clientSecret = process.env.VITE_FFLOGS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('No credentials found in process.env');
    return;
  }

  const response = await fetch('https://www.fflogs.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const json = await response.json();
  const token = json.access_token;
  console.log('Got token:', token ? 'yes' : 'no');

  // Query a known public report
  // Just an example report from recent savage
  // Let's first fetch fights to get a valid fightID,
  // Or we just try another report:
  const query = `
      query {
        reportData {
          report(code: "8bHdfqJcR216FwYv") {
            events(
              dataType: DamageDone
              hostilityType: Enemies
              limit: 50
              useAbilityIDs: false
            ) {
              data
            }
          }
        }
      }
    `;

  const res2 = await fetch('https://www.fflogs.com/api/v2/client', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const data = await res2.json();
  const events = data?.data?.reportData?.report?.events?.data || [];

  console.log(JSON.stringify(events.slice(0, 5), null, 2));

  const types = new Set();
  for (const e of events) {
    if (e.ability) {
      types.add(e.ability.type);
    }
  }
  console.log('Unique types:', [...types]);
}

test().catch(console.error);
