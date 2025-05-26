const fetch = require('node-fetch');

async function getUserDetails(handle) {
  const url = `https://codeforces.com/api/user.info?handles=${handle}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch user info: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.status !== "OK") {
    throw new Error(`API error: ${data.comment}`);
  }

  const user = data.result[0];

  const rating = user.rating || 0;
  let division = "Unrated";
  if (rating >= 1900) division = "Div 1";
  else if (rating >= 1600) division = "Div 2";
  else if (rating >= 1400) division = "Div 3";
  else if (rating > 0) division = "Div 4";

  return {
    handle: user.handle,
    rank: user.rank || "unrated",
    maxRank: user.maxRank || "unrated",
    rating,
    maxRating: user.maxRating || 0,
    division,
  };
}

async function getUserSolvedProblemsCount(handle) {
  const url = `https://codeforces.com/api/user.status?handle=${handle}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch user submissions: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.status !== "OK") {
    throw new Error(`API error: ${data.comment}`);
  }

  const submissions = data.result;
  const solvedProblemsSet = new Set();

  submissions.forEach(sub => {
    if (sub.verdict === "OK") {
      const problemId = `${sub.problem.contestId}-${sub.problem.index}`;
      solvedProblemsSet.add(problemId);
    }
  });

  return solvedProblemsSet.size;
}

async function getUserContestsCount(handle) {
  const url = `https://codeforces.com/api/user.rating?handle=${handle}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch user contests: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.status !== "OK") {
    throw new Error(`API error: ${data.comment}`);
  }

  const contests = data.result; // array of contests participated
  return contests.length;
}

(async () => {
  try {
    const username = "sathvikch";  // Replace with any Codeforces username

    const userDetails = await getUserDetails(username);
    const solvedCount = await getUserSolvedProblemsCount(username);
    const contestsCount = await getUserContestsCount(username);

    console.log(`User: ${userDetails.handle}`);
    console.log(`Rank: ${userDetails.rank} (Max: ${userDetails.maxRank})`);
    console.log(`Rating: ${userDetails.rating} (Max: ${userDetails.maxRating})`);
    console.log(`Division: ${userDetails.division}`);
    console.log(`Number of problems solved: ${solvedCount}`);
    console.log(`Number of contests participated: ${contestsCount}`);
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
