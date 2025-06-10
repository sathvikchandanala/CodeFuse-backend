const express = require('express');
const { LeetCode } = require('leetcode-query');

const router = express.Router();
const lc = new LeetCode();

// GET /api/leetcode/profile/:username
router.get('/profile/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const profile = await lc.user(username);

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

    res.status(200).json(userDetails);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// GET /api/leetcode/problem-of-day
router.get('/problem-of-day', async (req, res) => {
  try {
    const daily = await lc.daily();
    const problem = daily.question || null;

    res.status(200).json(problem);
  } catch (error) {
    console.error('Error fetching problem of the day:', error);
    res.status(500).json({ error: 'Failed to fetch problem of the day' });
  }
});

module.exports = router;
