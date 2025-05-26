const { LeetCode } = require('leetcode-query');

const lc = new LeetCode();

async function getUserDetails(username) {
  try {
    const profile = await lc.user(username);
    console.log("Raw user profile:", profile);

    // Extract relevant user details
    const userDetails = {
      realName: profile.real_name || null,
      username: profile.username || null,
      ranking: profile.user_ranking || null,
      country: profile.country_name || null,
      coins: profile.coins || null,
      problemsSolved: profile.submit_stats?.ac_total || null,
      easySolved: profile.submit_stats?.ac_easy || null,
      mediumSolved: profile.submit_stats?.ac_medium || null,
      hardSolved: profile.submit_stats?.ac_hard || null,
    };

    return userDetails;
  } catch (error) {
    console.error("Failed to fetch user details:", error);
  }
}

async function getProblemOfTheDay() {
  try {
    const daily = await lc.daily();
    // daily object contains 'question' key
    const problem = daily.question || null;
    return problem;
  } catch (error) {
    console.error("Failed to fetch problem of the day:", error);
  }
}

async function main() {
  const username = "sathvik_chandanala";

  const user = await getUserDetails(username);
  console.log("User Profile:", user);

  const problemOfTheDay = await getProblemOfTheDay();
  console.log("Problem of the Day:", problemOfTheDay);
}

main();
