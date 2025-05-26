const fetch = require('node-fetch');

async function getLeetCodeContests() {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          allContests {
            title
            titleSlug
            startTime
            duration
          }
        }
      `,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch LeetCode contests: ${res.status}`);
  }

  const json = await res.json();

  if (!json.data || !Array.isArray(json.data.allContests)) {
    throw new Error('Invalid response format');
  }

  const contests = json.data.allContests;
  const now = Math.floor(Date.now() / 1000);

  const pastContests = [];
  const presentContests = [];
  const futureContests = [];

  contests.forEach(contest => {
    const start = contest.startTime;
    const end = contest.startTime + contest.duration;

    const contestInfo = {
      title: contest.title,
      url: `https://leetcode.com/contest/${contest.titleSlug}`,
      startTime: new Date(start * 1000).toISOString(),
      duration: `${Math.floor(contest.duration / 60)} minutes`
    };

    if (end < now) {
      pastContests.push(contestInfo);
    } else if (start <= now && now <= end) {
      presentContests.push(contestInfo);
    } else {
      futureContests.push(contestInfo);
    }
  });

  return {
    pastContests,
    presentContests,
    futureContests,
  };
}

(async () => {
  try {
    const { pastContests, presentContests, futureContests } = await getLeetCodeContests();
    console.log('\n🔴 Past Contests:', pastContests);
    console.log('\n🟡 Present Contests:', presentContests);
    console.log('\n🟢 Future Contests:', futureContests);
  } catch (err) {
    console.error('❌ Error fetching contests:', err);
  }
})();
