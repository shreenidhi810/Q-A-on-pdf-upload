import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const upload = multer({ dest: "uploads/", limits: { fileSize: 25 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static(path.resolve("../frontend/dist")));

const documents = new Map();

function splitText(text, maxWords = 120, overlap = 24) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (!words.length) return [];
  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + maxWords);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, value, idx) => sum + value * b[idx], 0);
  const magA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

function createPrompt(question, contextChunks) {
  const context = contextChunks
    .map((chunk) => `[Page ${chunk.page}] ${chunk.text}`)
    .join("\n\n");
  return `You are an assistant that answers questions using only the provided document excerpts. If the answer is not contained in the context, reply with exactly: Not available in document. Do not invent information. Provide the answer and include source page references in square brackets when applicable.\n\nContext:\n${context}\n\nQuestion:\n${question}\n\nAnswer:`;
}

app.post("/upload", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded." });
  }
  if (!req.file.originalname.toLowerCase().endsWith(".pdf")) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Only PDF files are supported." });
  }

  try {
    const data = fs.readFileSync(req.file.path);
    const pdf = await pdfParse(data);
    const pages = pdf.text.split(/\f/g).map((pageText, idx) => ({
      page: idx + 1,
      text: pageText.trim(),
    })).filter((page) => page.text.length > 0);

    const chunks = [];
    pages.forEach((page) => {
      const textChunks = splitText(page.text);
      textChunks.forEach((text, index) => {
        chunks.push({ page: page.page, text, chunkIndex: index + 1 });
      });
    });

    if (!chunks.length) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Unable to extract text from PDF." });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks.map((chunk) => chunk.text),
    });

    const embeddedChunks = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddingResponse.data[index].embedding,
    }));

    const docId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    documents.set(docId, { filename: req.file.originalname, chunks: embeddedChunks });

    fs.unlinkSync(req.file.path);
    return res.json({ docId, filename: req.file.originalname });
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: "Failed to process PDF." });
  }
});

app.post("/query", async (req, res) => {
  const { question, docId } = req.body || {};
  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }
  if (!docId || !documents.has(docId)) {
    return res.status(400).json({ error: "Document not found. Upload a PDF first." });
  }

  const document = documents.get(docId);
  const queryEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });

  const queryVector = queryEmbedding.data[0].embedding;

  const scored = document.chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVector, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!scored.length || scored[0].score < 0.14) {
    return res.json({ answer: "Not available in document", source: "" });
  }

  const prompt = createPrompt(question, scored.map((item) => item.chunk));
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Answer using only the provided context." },
      { role: "user", content: prompt },
    ],
    max_tokens: 250,
    temperature: 0.0,
  });

  const answer = completion.choices[0].message.content.trim();
  if (answer.toLowerCase() === "not available in document") {
    return res.json({ answer: "Not available in document", source: "" });
  }

  const sourcePages = [...new Set(scored.map((item) => item.chunk.page))].sort((a, b) => a - b);
  res.json({ answer, source: sourcePages.join(", ") });
});

app.get("*", (req, res) => {
  res.sendFile(path.resolve("../frontend/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
