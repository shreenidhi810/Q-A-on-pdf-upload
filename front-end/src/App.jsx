import { useState } from "react";

function App() {
  const [fileName, setFileName] = useState("");
  const [docId, setDocId] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("");

  const addMessage = (role, text, source = "") => {
    setMessages((prev) => [...prev, { role, text, source }]);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    const fileInput = document.querySelector("#pdf-input");
    if (!fileInput.files.length) {
      setStatus("Choose a PDF file first.");
      return;
    }
    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Only PDF files are supported.");
      return;
    }

    setStatus("Uploading PDF...");
    const formData = new FormData();
    formData.append("pdf", file);

    const response = await fetch("/upload", { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Upload failed.");
      return;
    }

    setDocId(data.docId);
    setFileName(data.filename);
    setStatus(`Uploaded ${data.filename}. Ask a question now.`);
    addMessage("system", `Uploaded ${data.filename}`);
  };

  const handleAsk = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;
    if (!docId) {
      setStatus("Upload a PDF before asking questions.");
      return;
    }

    addMessage("user", question);
    setQuestion("");
    setStatus("Getting answer...");

    const response = await fetch("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, docId }),
    });

    const data = await response.json();
    if (!response.ok) {
      addMessage("assistant", data.error || "Unable to answer question.");
      setStatus("Error answering question.");
      return;
    }

    addMessage("assistant", data.answer, data.source);
    setStatus("");
  };

  return (
    <div className="page-shell">
      <header>
        <h1>Document Q&A</h1>
        <p>Upload a PDF and ask questions grounded only in that document.</p>
      </header>

      <section className="card">
        <form onSubmit={handleUpload} className="upload-form">
          <label htmlFor="pdf-input">Upload PDF</label>
          <input id="pdf-input" type="file" accept="application/pdf" />
          <button type="submit">Upload</button>
        </form>
        {status && <p className="status">{status}</p>}
      </section>

      <section className="card chat-card">
        <div className="chat-window" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="bubble">{message.text}</div>
              {message.source && <div className="source">Source pages: {message.source}</div>}
            </div>
          ))}
        </div>

        <form onSubmit={handleAsk} className="chat-form">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about the uploaded document"
            disabled={!docId}
          />
          <button type="submit" disabled={!docId}>Ask</button>
        </form>
      </section>
    </div>
  );
}

export default App;
