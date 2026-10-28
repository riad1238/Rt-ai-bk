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

app.post("/api/ai-chat", async (req, res) => {
  const { message, profile } = req.body;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      answer: "AI is not configured yet. Add GROQ_API_KEY in Render."
    });
  }

  const student = {
    name: profile?.name || "Demo Student",
    grade: profile?.grade || 5,
    language: profile?.language || "en",
    weakAreas: profile?.weakAreas || ["fractions", "multiplication"],
    strengths: profile?.strengths || ["science"],
    learningStyle: profile?.learningStyle || "simple explanations"
  };

  const prompt = `
  You are a helpful school learning assistant.
  Keep answers educational, friendly, and easy to understand.

  Student profile:
  - Name: ${student.name}
  - Grade: ${student.grade}
  - Language: ${student.language}
  - Weak areas: ${student.weakAreas.join(", ")}
  - Strengths: ${student.strengths.join(", ")}
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

    const data = await response.json();
    const answer =
      data?.choices?.[0]?.message?.content ||
      "I could not generate a response right now.";

    return res.json({ answer });
  } catch (error) {
    console.error("AI request error:", error);
    return res.status(500).json({
      answer: "The AI service is not available right now. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`LearnQuest AI backend running on port ${PORT}`);
});
