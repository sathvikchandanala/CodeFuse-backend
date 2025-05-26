const fetch = require('node-fetch');

async function getCodeforcesSubmissions(handle, count = 10) {
  const url = `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=${count}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error('Failed to fetch submissions');
  }

  const submissions = data.result.map(sub => ({
    contestId: sub.contestId,
    problemName: sub.problem.name,
    programmingLanguage: sub.programmingLanguage,
    verdict: sub.verdict,
    time: new Date(sub.creationTimeSeconds * 1000).toLocaleString()
  }));

  return submissions;
}

// Example usage
(async () => {
  try {
    const submissions = await getCodeforcesSubmissions('sathvikch', 5);
    console.log('Recent Submissions:', submissions);
  } catch (err) {
    console.error(err);
  }
})();
