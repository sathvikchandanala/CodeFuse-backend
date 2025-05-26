const fetch = require('node-fetch');

async function getCodeforcesContests() {
  const url = 'https://codeforces.com/api/contest.list';

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch contests: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error('Codeforces API returned error: ' + data.comment);
  }

  const contests = data.result;

  const now = Math.floor(Date.now() / 1000);

  const pastContests = [];
  const presentContests = [];
  const futureContests = [];

  for (const contest of contests) {
    // contest properties:
    // id, name, type, phase, frozen, durationSeconds, startTimeSeconds, relativeTimeSeconds

    if (contest.phase === 'FINISHED') {
      pastContests.push(contest);
    } else if (contest.phase === 'CODING') {
      presentContests.push(contest);
    } else if (contest.phase === 'BEFORE') {
      futureContests.push(contest);
    }
    // There are other phases like SYSTEM_TEST, PENDING_SYSTEM_TEST but usually above covers main states
  }

  // Map to simplified objects with relevant info and contest URL
  const mapContest = (c) => ({
    id: c.id,
    name: c.name,
    startTime: new Date(c.startTimeSeconds * 1000).toISOString(),
    durationSeconds: c.durationSeconds,
    phase: c.phase,
    url: `https://codeforces.com/contests/${c.id}`,
  });

  return {
    pastContests: pastContests.map(mapContest),
    presentContests: presentContests.map(mapContest),
    futureContests: futureContests.map(mapContest),
  };
}

(async () => {
  try {
    const contests = await getCodeforcesContests();

    console.log('Past Contests:', contests.pastContests);
    console.log('Present Contests:', contests.presentContests);
    console.log('Future Contests:', contests.futureContests);
  } catch (err) {
    console.error('Error fetching contests:', err);
  }
})();
