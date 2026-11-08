const express = require("express");
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("LearnQuest AI backend is running.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "LearnQuest AI backend",
    aiConfigured: Boolean(process.env.GROQ_API_KEY)
  });
});

app.post("/api/ai-chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const profile = req.body?.profile || {};

  if (!message) {
    return res.status(400).json({ code: "EMPTY_MESSAGE", answer: "Please enter a question first." });
  }
  if (message.length > 4000) {
    return res.status(400).json({ code: "MESSAGE_TOO_LONG", answer: "Please keep your question under 4,000 characters." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("AI configuration error: GROQ_API_KEY is missing.");
    return res.status(503).json({
      code: "AI_NOT_CONFIGURED",
      answer: "The AI service is not configured. Add GROQ_API_KEY to the Render service environment variables, then redeploy."
    });
  }

  const student = {
    name: typeof profile.name === "string" ? profile.name.slice(0, 80) : "Student",
    grade: Number.isFinite(Number(profile.grade)) ? Number(profile.grade) : 5,
    language: profile.language === "ar" ? "ar" : "en",
    weakAreas: Array.isArray(profile.weakAreas) ? profile.weakAreas.slice(0, 10) : [],
    strengths: Array.isArray(profile.strengths) ? profile.strengths.slice(0, 10) : [],
    learningStyle: typeof profile.learningStyle === "string" ? profile.learningStyle.slice(0, 120) : "simple explanations"
  };

  const prompt = `
You are a helpful school learning assistant.
Keep answers educational, friendly, and easy to understand.

Student profile:
- Name: ${student.name}
- Grade: ${student.grade}
- Language: ${student.language}
- Weak areas: ${student.weakAreas.join(", ") || "not specified"}
- Strengths: ${student.strengths.join(", ") || "not specified"}
- Learning style: ${student.learningStyle}

Rules:
- Answer in ${student.language === "ar" ? "Arabic" : "English"}
- Use simple explanations for school students
- If the student is struggling, give one hint, one example, and one final answer
- Keep it short and understandable
- Do not reveal private data

Student asks:
${message}
`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a friendly school tutor." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = data?.error?.message || "The AI provider rejected the request.";
      console.error("Groq API error:", response.status, providerMessage);
      return res.status(502).json({
        code: "AI_PROVIDER_ERROR",
        answer: `The AI provider returned an error (HTTP ${response.status}). Check the Groq API key, model availability, and account limits in Render logs.`
      });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      console.error("Groq API returned no answer:", JSON.stringify(data).slice(0, 1000));
      return res.status(502).json({
        code: "EMPTY_AI_RESPONSE",
        answer: "The AI provider responded, but did not return an answer. Please try again."
      });
    }

    return res.json({ answer: answer.trim() });
  } catch (error) {
    console.error("AI request error:", error);
    return res.status(502).json({
      code: "AI_CONNECTION_ERROR",
      answer: "The server could not connect to the AI provider. Check the Render service logs and try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`LearnQuest AI backend running on port ${PORT}`);
});
