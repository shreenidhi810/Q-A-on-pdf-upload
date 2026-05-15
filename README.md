# Q-A-on-pdf-upload

# PDF Document Q&A

A simple frontend/backend document question-answering app. Users upload a PDF, the backend extracts text, creates embeddings, and answers questions using only the document content.

## Project structure

- `backend/`: Express server handling PDF upload, text extraction, embedding retrieval, and chat completion.
- `frontend/`: React + Vite app for uploading PDFs and chatting with the document.

## Setup

1. Install dependencies for backend and frontend.

```bash

npm install
cd ..\frontend
npm install
``

2. Build the frontend and start the backend.

```bash
cd c:\Users\SHREE\Desktop\navadithi\frontend
npm run build
cd ..\backend
npm start
```

3. Open `http://localhost:4000` in the browser.

## How it works

- The frontend sends a PDF to the backend via `/upload`.
- The backend extracts text from each PDF page using `pdf-parse`.
- Text is chunked and embeddings are created with `text-embedding-3-small`.
- User questions are converted to embeddings and matched against document chunks with cosine similarity.
- The top chunks are sent to `gpt-4o-mini` with a strict prompt requiring answers only from the document.
- If the information is missing, the API returns `Not available in document`.

## AI approach

- Embeddings model: `text-embedding-3-small`
- Chat model: `gpt-4o-mini`
- Prompt design instructs the assistant to answer only from the supplied excerpts and to reply `Not available in document` when the answer cannot be found.

## Prompt design

The prompt includes:

- an explicit instruction to use only document content
- a requirement to avoid invention
- context snippets with page references
- the question and a definitive answer slot

## Hallucination handling

- The model receives only retrieved document snippets, not the full PDF text.
- Low similarity or an explicit out-of-context response results in `Not available in document`.
- Source pages are shown when an answer is returned.

## Limitations

- Documents are stored in memory and reset on server restart.
- Source highlighting is limited to page numbers only.
- The app does not support multiple concurrent document sessions beyond the current in-memory document index.

## Possible improvements

- Add persistent document storage or database support
- Add a dedicated document selector for multiple uploads
- Display exact source snippets in the chat response
- Improve chunking with token-based splitting instead of word-based splitting
- Add frontend file upload progress and better error handling
