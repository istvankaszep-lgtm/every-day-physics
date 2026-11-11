require('.env').config();
/* ============================================
   NAPI FIZIKA - APPLICATION LOGIC
   ============================================ */


const apiKey = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const API_TIMEOUT_MS = 12000; // 12 másodperc timeout

let currentLang = 'hu';
let originalTexts = new Map();
let lessonData = null;
let isTranslating = false;

// ============================================
// DATE HELPERS
// ============================================
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getFormattedDate() {
    return new Date().toLocaleDateString('hu-HU', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
}
function getDayOfYear() {
    const now = new Date();
    return Math.floor((now - new Date(now.getFullYear(),0,0)) / 86400000);
}

// ============================================
// GEMINI API (with timeout)
// ============================================
async function callGemini(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
        const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.8, maxOutputTokens: 4096, responseMimeType: "application/json" }
            })
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Üres válasz');
        return JSON.parse(text);
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function fetchDailyLesson() {
    const today = getTodayString();
    const cached = localStorage.getItem('fizika_lesson');
    if (cached) {
        try {
            const p = JSON.parse(cached);
            if (p.date === today && p.data) return p.data;
        } catch(e) {}
    }

    const topics = [
        "Newton első törvénye (tehetetlenség)", "Newton második törvénye (F=ma)", "Newton harmadik törvénye (hatás-ellenhatás)",
        "Gravitáció", "Súrlódás", "Sebesség és gyorsulás", "Szabadesés", "Lendület megmaradás",
        "Kinetikus energia", "Potenciális energia", "Energia megmaradás törvénye", "Munka és teljesítmény",
        "Nyomás", "Archimédész törvénye", "Bernoulli-elv",
        "Hőmérséklet és hő", "Hővezetés és hősugárzás", "Halmazállapot-változások",
        "Hullámok", "Hang és hanghullámok", "Rezonancia",
        "Fény és árnyék", "Visszaverődés és tükrök", "Fénytörés és lencsék",
        "Statikus elektromosság", "Elektromos áram és áramkörök", "Mágnesesség", "Elektromágneses indukció",
        "Az atom szerkezete", "Relativitáselmélet alapjai", "Színek fizikája",
        "Sűrűség", "Centripetális erő", "Doppler-effektus", "Folyadékok mechanikája",
        "Termodinamika törvényei", "Gázok viselkedése"
    ];
    const topic = topics[getDayOfYear() % topics.length];

    const prompt = `Írj egy részletes fizika leckét magyarul: "${topic}".
JSON formátum:
{"icon":"emoji","category":"fizika ága","title":"cím","lessonNumber":${getDayOfYear()},"body":"HTML <p> tagekkel, <strong> fontos szavak, <span class='formula'>képlet</span> inline, <div class='formula-block'>képlet</div> kiemelt. Min 3 bekezdés.","funFact":"2-3 meglepő mondat","project":{"icon":"emoji","title":"projekt név","difficulty":"Könnyű","materials":["anyag1","anyag2"],"steps":["lépés1","lépés2","lépés3","lépés4"],"explanation":"Miért működik? 2-3 mondat."}}
Csak JSON, semmi más.`;

    const data = await callGemini(prompt);
    localStorage.setItem('fizika_lesson', JSON.stringify({ date: today, data }));
    return data;
}

async function translateWithGemini(texts, targetLang) {
    const names = { en:'angol', de:'német', fr:'francia', es:'spanyol', it:'olasz', ro:'román', pl:'lengyel', ja:'japán', zh:'kínai', ko:'koreai', pt:'portugál' };
    const results = [];
    for (let i = 0; i < texts.length; i += 12) {
        const batch = texts.slice(i, i + 12);
        const prompt = `Fordítsd le ${names[targetLang]||targetLang} nyelvre. HTML tageket hagyd meg. Válasz: JSON tömb ${batch.length} stringgel.\n${batch.map((t,j)=>`[${j}]: ${JSON.stringify(t)}`).join('\n')}`;
        try {
            const tr = await callGemini(prompt);
            results.push(...(Array.isArray(tr) ? tr : batch));
        } catch(e) { results.push(...batch); }
    }
    return results;
}
