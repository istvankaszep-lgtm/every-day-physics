require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public')); // Itt fogja keresni a weboldal fájljait

// API Végpont, amit a weboldal hívni fog
app.get('/api/lesson', async (req, res) => {
    const lang = req.query.lang || 'hu';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Hiányzik az API kulcs a szerverről!" });
    }

    const prompt = `Adj nekem egy tudományosan pontos napi fizikai leckét a mai napra, a következő nyelven: ${lang}. 
    A válaszod SZIGORÚAN csak egy tiszta JSON objektum legyen, markdown kódjelek (pl. \`\`\`json) NÉLKÜL, ebben a formátumban:
    {
      "title": "A lecke címe",
      "text": "A részletes fizikai magyarázat középiskolás szinten",
      "funfact": "Egy lenyűgöző fizikai érdekesség ehhez kapcsolódóan",
      "projectTitle": "Biztonságos otthoni kísérlet címe",
      "projectDesc": "Szükséges eszközök és a kísérlet menete lépésről lépésre"
    }`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        let rawText = data.candidates[0].content.parts[0].text;
        
        // Esetleges markdown jelek tisztítása
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        res.json(JSON.parse(rawText));
    } catch (error) {
        console.error("Hiba a Gemini API híváskor:", error);
        res.status(500).json({ error: "Hiba történt a lecke generálásakor." });
    }
});

app.listen(PORT, () => {
    console.log(`A szerver fut a http://localhost:${PORT} címen`);
});