const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const { LeetCode } = require('leetcode-query');
const axios=require("axios")

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

    // Here you can add Firestore user data check/create if needed server-side

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
