const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const { LeetCode } = require('leetcode-query');
const axios=require("axios")
const fetch = require("node-fetch");

const lc = new LeetCode();

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: "codefuse-e2e75",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain:process.env.FIREBASE_UNIVERSE_DOMAIN
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const allowedOrigins = [
  "http://localhost:5173",
  "https://code-fuse-henna.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;

const normalizeCodeChef = (data) => {
  const now = Date.now();
  const contests = [
    ...data.future_contests,
    ...data.present_contests,
    ...data.past_contests
  ];

  return contests
    .filter(c => c.contest_start_date_iso && c.contest_end_date_iso)
    .map(c => {
      const start = new Date(c.contest_start_date_iso);
      const end = new Date(c.contest_end_date_iso);

      if (isNaN(start) || isNaN(end)) return null;

      let status = "Past";
      if (now < start.getTime()) status = "Upcoming";
      else if (now >= start.getTime() && now <= end.getTime()) status = "Ongoing";

      return {
        id: `CodeChef-${c.contest_code}`,
        name: c.contest_name,
        platform: "CodeChef",
        type: "Unknown",
        url: `https://www.codechef.com/${c.contest_code}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration: `${c.contest_duration} minutes`,
        status,
      };
    })
    .filter(Boolean);
};

const normalizeCF = (data) =>
  data.result
    .filter(c => c.phase !== "CANCELED")
    .map((c) => {
      let status = "Past";
      if (c.phase === "BEFORE") status = "Upcoming";
      else if (c.phase === "CODING") status = "Ongoing";

      return {
        id: `Codeforces-${c.id}`,
        name: c.name,
        platform: "Codeforces",
        type: c.type,
        url: `https://codeforces.com/contest/${c.id}`,
        startTime: new Date(c.startTimeSeconds * 1000).toISOString(),
        endTime: new Date((c.startTimeSeconds + c.durationSeconds) * 1000).toISOString(),
        duration: `${Math.floor(c.durationSeconds / 60)} minutes`,
        status,
      };
    });

async function getLeetCodeContests() {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const contests = json?.data?.allContests || [];

  const now = Math.floor(Date.now() / 1000);

  return contests.map((c, i) => {
    const start = c.startTime;
    const end = c.startTime + c.duration;
    let status = "Past";
    if (now < start) status = "Upcoming";
    else if (now >= start && now <= end) status = "Ongoing";

    const typeMatch = c.title.match(/(Weekly|Biweekly|Monthly)/i);

    return {
      id: `LeetCode-${i}`,
      name: c.title,
      type: typeMatch ? typeMatch[1] : "Unknown",
      platform: "LeetCode",
      url: `https://leetcode.com/contest/${c.titleSlug}`,
      startTime: new Date(start * 1000).toISOString(),
      endTime: new Date(end * 1000).toISOString(),
      duration: `${Math.floor(c.duration / 60)} minutes`,
      status,
    };
  });
}

const normalizeDevpost = (data) => {
  return data.hackathons
    .filter(h => h.open_state === "open")
    .map(h => {
      const isOnline = h.displayed_location?.location?.toLowerCase().includes('online');
      const prizeMatch = h.prize_amount?.match(/\d[\d,]*/);
      const prize = prizeMatch ? parseInt(prizeMatch[0].replace(/,/g, '')) : 0;

      return {
        id: `Devpost-${h.id}`,
        title: h.title,
        mode: isOnline ? "online" : "offline",
        prize: prize,
        postedDate: new Date().toISOString(), // No actual field available
        url: h.url,
        thumbnail_url: h.thumbnail_url?.startsWith("http") ? h.thumbnail_url : `https:${h.thumbnail_url}`,
        time_left_to_submission: h.time_left_to_submission,
        submission_period_dates: h.submission_period_dates,
        themes: h.themes || [],
        registrations_count: h.registrations_count || 0
      };
    });
};




app.get("/leetcode/:username", async (req, res) => {
  const username = req.params.username;

  const query = `
    query userProfile($username: String!) {
      allQuestionsCount {
        difficulty
        count
      }
      matchedUser(username: $username) {
        username
        profile{
        starRating}
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
        userCalendar {
          submissionCalendar
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://leetcode.com/graphql",
      {
        query,
        variables: { username }
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const data = response.data.data;
    const user = data.matchedUser;
    const totalQuestions = data.allQuestionsCount;

    if (!user) return res.status(404).json({ error: "User not found" });

    const acStats = user.submitStatsGlobal.acSubmissionNum;
    const calendarRaw = user.userCalendar?.submissionCalendar || "{}";
    const parsedCalendar = Object.entries(JSON.parse(calendarRaw)).map(([ts, count]) => ({
      date: new Date(Number(ts) * 1000).toISOString().split("T")[0],
      count: Number(count),
    }));

    // Sort calendar by date
    parsedCalendar.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Create a Set of dates with submissions
const submissionDates = new Set(parsedCalendar.map((entry) => entry.date));

// Track max and current streaks
let maxStreak = 0;
let currentStreak = 0;
let today = new Date();
today.setUTCHours(0, 0, 0, 0);

for (let i = 0; i < 365; i++) {
  const dateStr = today.toISOString().split("T")[0];
  if (submissionDates.has(dateStr)) {
    currentStreak++;
    maxStreak = Math.max(maxStreak, currentStreak);
  } else {
    if (i === 0) {
      currentStreak = 0; // today has no submission, so streak is zero
    } else {
      break; // stop streak when a day is missed
    }
  }
  // Move to previous day
  today.setDate(today.getDate() - 1);
}


    // Total problems from LeetCode
    const getTotal = (difficulty) =>
      totalQuestions.find((q) => q.difficulty === difficulty)?.count || 0;

    res.json({
      username: user.username,
      solved: {
        total: acStats.find((x) => x.difficulty === "All")?.count || 0,
        easy: acStats.find((x) => x.difficulty === "Easy")?.count || 0,
        medium: acStats.find((x) => x.difficulty === "Medium")?.count || 0,
        hard: acStats.find((x) => x.difficulty === "Hard")?.count || 0,
      },
      totals: {
        total: getTotal("All"),
        easy: getTotal("Easy"),
        medium: getTotal("Medium"),
        hard: getTotal("Hard"),
      },
      calendar: parsedCalendar,
      streak: currentStreak,
      maxStreak,
      rating: user.profile.starRating // Placeholder, LeetCode does not expose rating via public API
    });
  } catch (error) {
    console.error("Error fetching LeetCode data:", error.message);
    res.status(500).json({ error: "Failed to fetch LeetCode data" });
  }
});

app.get("/codeforces/:username", async (req, res) => {
  const username = req.params.username;
  try {
    const [ratingRes, statusRes] = await Promise.all([
      axios.get(`https://codeforces.com/api/user.rating?handle=${username}`),
      axios.get(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=10000`)
    ]);

    // Ratings
    const ratings = ratingRes.data.result;
    const currentRating = ratings.length ? ratings[ratings.length - 1].newRating : null;
    const maxRating = ratings.length ? Math.max(...ratings.map(r => r.newRating)) : null;

    // Extract solved counts & heatmap
    const solvedMap = new Map(); // problem.name -> rating
    const submissions = statusRes.data.result;
    const calendarMap = {}; // date → submissions that day

    submissions.forEach(s => {
      if (s.verdict === "OK") {
        const prob = s.problem;
        const probId = `${prob.contestId}-${prob.index}`;
        if (!solvedMap.has(probId)) {
          solvedMap.set(probId, prob.rating || null); // store only first AC
        }

        const d = new Date(s.creationTimeSeconds * 1000).toISOString().split("T")[0];
        calendarMap[d] = (calendarMap[d] || 0) + 1;
      }
    });

    // Difficulty counts
    let easy = 0, medium = 0, hard = 0, unknown = 0;
    for (const rating of solvedMap.values()) {
      if (!rating) unknown++;
      else if (rating <= 1200) easy++;
      else if (rating <= 1800) medium++;
      else hard++;
    }

    // Format calendar
    const calendar = Object.entries(calendarMap).map(([date, count]) => ({ date, count }));

    // Response
    res.json({
      username,
      rating: currentRating,
      maxRating,
      solvedCount: solvedMap.size,
      easyCount: easy,
      mediumCount: medium,
      hardCount: hard,
      unknownCount: unknown,
      calendar
    });
  } catch (err) {
    console.error("CF fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch Codeforces data" });
  }
});



 
app.get('/hackathons', async (req, res) => {
  try {
    const { data } = await axios.get('https://devpost.com/api/hackathons?challenge_type=all&sort_by=recent');
    const hackathons = normalizeDevpost(data);
    res.json(hackathons);
  } catch (error) {
    console.error("Error fetching hackathons:", error.message);
    res.status(500).json({ message: "Failed to fetch hackathons" });
  }
});



app.get("/contests", async (req, res) => {
  try {
    const cfRes = await axios.get("https://codeforces.com/api/contest.list");
    const codeforcesContests = normalizeCF(cfRes.data);

    const leetcodeContests = await getLeetCodeContests();

    const ccRes = await axios.get("https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all");
    const codechefContests = normalizeCodeChef(ccRes.data);

    const allContests = [...codeforcesContests, ...leetcodeContests, ...codechefContests];
    res.json(allContests);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Failed to fetch contests." });
  }
});



// LeetCode Ranking
async function getLeetCodeRank(username) {
  try {
    const profile = await lc.user(username);
    return profile?.matchedUser.profile.ranking || null;
  } catch (err) {
    console.error("LeetCode error:", err.message);
    return null;
  }
}

// Codeforces Rating
async function getCodeforcesRank(username) {
  try {
    const res = await axios.get(`https://codeforces.com/api/user.info?handles=${username}`);
    return res.data?.result[0]?.rating || null;
  } catch (err) {
    console.error("Codeforces error:", err.message);
    return null;
  }
}

const cheerio = require("cheerio");

async function getCodeChefRank(username) {
  try {
    const res = await axios.get(`https://www.codechef.com/users/${username}`);
    const $ = cheerio.load(res.data);
    const ratingRaw = $(".rating-number").first().text();
    const rating = ratingRaw.split('?')[0].trim();
    return rating || null;
  } catch (err) {
    console.error("CodeChef error:", err.message);
    return null;
  }
}

app.post("/login", async (req, res) => {
  const { idToken } = req.body;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);

    const userRecord = await admin.auth().getUser(decoded.uid);
    if (!userRecord.emailVerified) {
      return res.status(401).json({ error: "Email not verified" });
    }

    const customToken = jwt.sign(
      { uid: decoded.uid, email: decoded.email },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", customToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 3600000,
    });

    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    res.status(401).json({ error: "Invalid token", message: err.message });
  }
});


app.get('/problem-of-day', async (req, res) => {
  try {
    const daily = await lc.daily();
    const problem = daily.question || null;

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Extract needed fields plus tags and difficulty
    const response = {
      title: problem.title,
      titleSlug: problem.titleSlug,
      difficulty: problem.difficulty, // e.g. "Easy", "Medium", "Hard"
      tags: (problem.topicTags || []).map(tag => tag.name), // Array of tag names
      // you can include other fields if needed
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching problem of the day:', error);
    res.status(500).json({ error: 'Failed to fetch problem of the day' });
  }
});


app.get("/codeforces-problem-of-the-day", async (req, res) => {
  try {
    const response = await fetch("https://codeforces.com/api/problemset.problems");
    const data = await response.json();

    if (data.status !== "OK") {
      return res.status(500).json({ error: "Failed to fetch problems" });
    }

    const problems = data.result.problems;
    const used = new Set();
    let selectedProblem = null;

    function getDifficultyLabel(rating) {
      if (!rating) return "Unknown"; // rating might be missing sometimes
      if (rating <= 999) return "Easy";
      if (rating <= 1399) return "Medium";
      if (rating <= 30000) return "Hard";
    }

    while (!selectedProblem && used.size < problems.length) {
      const randIndex = Math.floor(Math.random() * problems.length);
      const problem = problems[randIndex];
      const key = `${problem.contestId}-${problem.index}`;

      if (!used.has(key)) {
        used.add(key);

        selectedProblem = {
          title: problem.name,
          link: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
          difficulty: getDifficultyLabel(problem.rating),  // Add difficulty label here
          rating: problem.rating || null,  // optionally include rating number
          tags: problem.tags || [], // also include tags if you want
        };
      }
    }

    if (selectedProblem) {
      res.json(selectedProblem);
    } else {
      res.status(404).json({ error: "No problem found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});


app.get("/codechef-problem-of-the-day", async (req, res) => {
  try {
    const response = await fetch("https://www.codechef.com/api/list/problems/all");
    const data = await response.json();

    if (data.status !== "success" || !data.data || data.data.length === 0) {
      return res.status(500).json({ error: "Failed to fetch problems from CodeChef" });
    }

    const problem = data.data[0]; // picking first problem as before

    const selectedProblem = {
      title: problem.name,
      link: `https://www.codechef.com/problems/${problem.code}`,
      difficulty: problem.difficulty || "Unknown",  // if available
      tags: problem.tags || [],                      // if available
    };

    res.json(selectedProblem);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getUserDetails(username) {
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

    return userDetails;
  } catch (error) {
    console.error("Failed to fetch user details:", error);
    throw error;
  }
}

app.post("/platform-scores", async (req, res) => {
  const { CodeChef, Codeforces, LeetCode } = req.body;

  if (!CodeChef && !Codeforces && !LeetCode) {
    return res.status(400).json({ error: "At least one platform username is required" });
  }

  try {
    const [codechefRank, codeforcesRank, leetcodeRank] = await Promise.all([
      CodeChef ? getCodeChefRank(CodeChef) : null,
      Codeforces ? getCodeforcesRank(Codeforces) : null,
      LeetCode ? getLeetCodeRank(LeetCode) : null,
    ]);

    res.json({
      CodeChef: codechefRank,
      Codeforces: codeforcesRank,
      LeetCode: leetcodeRank,
    });
  } catch (err) {
    console.error("Internal Error:", err.message);
    res.status(500).json({ error: "Failed to fetch platform scores" });
  }
});

async function fetchLeetCodeRecent(username) {
   try {
    const profile = await lc.user(username);
    return profile?.recentSubmissionList || null;
  } catch (err) {
    console.error("LeetCode error:", err.message);
    return null;
  }
}

const puppeteer = require("puppeteer");

async function fetchCodeChefRecent(username) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto(`https://www.codechef.com/users/${username}`, { waitUntil: "domcontentloaded" });

  const submissions = await page.evaluate(() => {
    const logs = [];
    const rows = document.querySelectorAll("section.recent-activity-section tbody tr");

    rows.forEach((row) => {
      const columns = row.querySelectorAll("td");
      if (columns.length >= 4) {
        const problemName = columns[1]?.innerText.trim();
        const verdict = columns[2]?.innerText.trim();
        const lang = columns[3]?.innerText.trim();
        const time = columns[0]?.innerText.trim();
        logs.push({ title: problemName, statusDisplay: verdict, lang, timestamp: time });
      }
    });

    return logs;
  });

  await browser.close();
  return submissions;
}

async function fetchCodeforcesRecent(username) {
  try {
    const res = await axios.get(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=10`);
    if (res.data.status !== "OK") {
      console.log("Codeforces response not OK:", res.data);
      return [];
    }
    const submissions = res.data.result;
    return submissions.map(sub => {
      return {
        title: sub.problem.name,
        statusDisplay: sub.verdict || "Unknown",
        timestamp: sub.creationTimeSeconds,
        lang: sub.programmingLanguage || "Unknown",
      };
    });
  } catch (err) {
    console.error("Codeforces error:", err.message);
    return [];
  }
}


app.post("/recent-activities", async (req, res) => {
  const { leetcode, codechef, codeforces } = req.body;

  if (!leetcode && !codechef && !codeforces) {
    return res.status(400).json({ error: "At least one platform username is required" });
  }

  try {
    const [leetCode,codeChef, codeForces] = await Promise.all([
      leetcode ? fetchLeetCodeRecent(leetcode) : [],
      Promise.resolve([]), // dummy placeholder for codechef
      codeforces ? fetchCodeforcesRecent(codeforces) : [],
    ]);

    res.json({
      LeetCode: leetCode,
      CodeChef: [] ,
      Codeforces: codeForces,
    });
  } catch (err) {
    console.error("Error fetching activities:", err.message);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});


app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
