const fetch = require('node-fetch');

async function getCodeChefContests() {
  const url = 'https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all';

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch contests: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Extract contests or fallback to empty arrays
  const pastContestsRaw = data.past_contests || [];
  const presentContestsRaw = data.present_contests || [];
  const futureContestsRaw = data.future_contests || [];

  // Helper to map raw contests to clean objects
  const mapContest = (contest) => ({
    code: contest.contest_code,
    name: contest.contest_name,
    startDate: contest.contest_start_date_iso,
    endDate: contest.contest_end_date_iso,
    duration: contest.contest_duration,
    url: `https://www.codechef.com/${contest.contest_code}`,
  });

  return {
    pastContests: pastContestsRaw.map(mapContest),
    presentContests: presentContestsRaw.map(mapContest),
    futureContests: futureContestsRaw.map(mapContest),
  };
}

(async () => {
  try {
    const contests = await getCodeChefContests();

    console.log('Past Contests:', contests.pastContests);
    console.log('Present Contests:', contests.presentContests);
    console.log('Future Contests:', contests.futureContests);
  } catch (err) {
    console.error('Error fetching contests:', err);
  }
})();
