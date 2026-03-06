import { useState, useRef, useEffect } from "react";

const GEMINI_API_URL = "xxx";

// ⚠️ REMPLACE PAR TA CLÉ API GEMINI
const GEMINI_API_KEY = "xxx";

const NOTE_MAP = {
  "DO3": 131, "RE3": 147, "MI3": 165, "FA3": 175, "SOL3": 196, "LA3": 220, "SI3": 247,
  "DO4": 262, "RE4": 294, "MI4": 330, "FA4": 349, "SOL4": 392, "LA4": 440, "SI4": 494,
  "DO5": 523, "RE5": 587, "MI5": 659, "FA5": 698, "SOL5": 784, "LA5": 880, "SI5": 988,
  "DO6": 1047, "SIL": 0, "SILENCE": 0,
};


const SYSTEM_PROMPT = `DJ Arduino. Commandes: A=LEDs on, E=LEDs off, 1=Stayin Alive, 2=Hymne Russie, 3=Gamme Do, D=Disco, 0=Stop.

Tu peux aussi COMPOSER des mélodies avec des notes.

Réponds UNIQUEMENT en JSON, SANS backticks.

Commande simple: {"command":"A","message":"court"}

Composition: {"command":"COMPOSE","message":"court","notes":[{"freq":262,"duration":300},{"freq":294,"duration":300}]}

Notes dispo (Hz): DO4=262 RE4=294 MI4=330 FA4=349 SOL4=392 LA4=440 SI4=494 DO5=523 RE5=587 MI5=659 FA5=698 SOL5=784. Silence=0.
Durées: 150=double-croche, 250=croche, 500=noire, 1000=blanche.

RÈGLES CRITIQUES:
- Message: 10 mots MAX
- Notes: 16 notes MAX par mélodie
- Mets "notes" EN DERNIER dans le JSON
- Pas de backticks, pas de markdown
- Français uniquement`;

const COMMAND_LABELS = {
  A: "ALLUMER", E: "ÉTEINDRE", "1": "STAYIN' ALIVE",
  "2": "HYMNE RUSSIE", "3": "GAMME DO", D: "DISCO",
  "0": "STOP", COMPOSE: "COMPOSER",
};

const COMMAND_COLORS = {
  A: "#f59e0b", E: "#6b7280", "1": "#ec4899",
  "2": "#3b82f6", "3": "#10b981", D: "#8b5cf6",
  "0": "#ef4444", COMPOSE: "#f97316",
};

function localMatch(text) {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lower.includes("allume") || lower.includes("lumiere")) return { command: "A" };
  if (lower.includes("eteint") || lower.includes("eteind")) return { command: "E" };
  if (lower.includes("stayin") || lower.includes("alive")) return { command: "1" };
  if (lower.includes("russie") || lower.includes("hymne")) return { command: "2" };
  if (lower.includes("gamme")) return { command: "3" };
  if (lower.includes("disco") || lower.includes("danse")) return { command: "D" };
  if (lower.includes("stop") || lower.includes("arret")) return { command: "0" };
  return { command: null };
}

export default function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Salut! Je suis ton DJ Compositeur Arduino. Je peux jouer des morceaux pré-enregistrés OU composer mes propres mélodies! Dis-moi ce que tu veux entendre.", command: null, notes: null },
  ]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Déconnecté");
  const [serialLog, setSerialLog] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const chatEndRef = useRef(null);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // === CONNEXION USB ===
  async function connectSerial() {
    try {
      setConnectionStatus("Sélection...");
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      writerRef.current = port.writable.getWriter();
      const reader = port.readable.getReader();
      readerRef.current = reader;
      setIsConnected(true);
      setConnectionStatus("Connecté (USB)");

      const decoder = new TextDecoder();
      (async () => {
        let buffer = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                setSerialLog(prev => [...prev.slice(-20), { time: new Date(), text: trimmed }]);
                // Détecter quand l'Arduino a fini
                try {
                  const json = JSON.parse(trimmed);
                  if (json.status === "ready") setIsPlaying(false);
                  if (json.status === "playing" || json.status === "composing") setIsPlaying(true);
                } catch(e) {}
              }
            }
          }
        } catch (e) { console.log("Lecture terminée", e); }
      })();
    } catch (err) {
      console.error(err);
      setConnectionStatus("Erreur — Utilise Chrome!");
    }
  }

  async function disconnectSerial() {
    try {
      if (readerRef.current) { await readerRef.current.cancel(); readerRef.current = null; }
      if (writerRef.current) { writerRef.current.releaseLock(); writerRef.current = null; }
      if (portRef.current) { await portRef.current.close(); portRef.current = null; }
    } catch (e) {}
    setIsConnected(false);
    setConnectionStatus("Déconnecté");
  }

  async function sendRaw(data) {
    if (!writerRef.current) return;
    try {
      await writerRef.current.write(new TextEncoder().encode(data));
    } catch (err) { console.error("Erreur envoi:", err); }
  }

  async function sendCommand(cmd) {
    await sendRaw(cmd);
    setSerialLog(prev => [...prev.slice(-20), { time: new Date(), text: ">>> " + cmd + " (" + (COMMAND_LABELS[cmd] || cmd) + ")" }]);
  }

  async function sendNotes(notes) {
    setIsPlaying(true);
    setSerialLog(prev => [...prev.slice(-20), { time: new Date(), text: ">>> COMPOSE: " + notes.length + " notes" }]);

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const data = "N" + note.freq + "," + note.duration + ";";
      console.log("Note " + (i+1) + "/" + notes.length + ": " + data);
      setSerialLog(prev => [...prev.slice(-20), { time: new Date(), text: "♪ Note " + (i+1) + ": " + note.freq + "Hz " + note.duration + "ms" }]);
      await sendRaw(data);
      // Attendre que l'Arduino joue la note
      await new Promise(r => setTimeout(r, note.duration + 100));
    }
    setIsPlaying(false);
  }

  // === GEMINI ===
  async function askGemini(userText) {
    const res = await fetch(GEMINI_API_URL + "?key=" + GEMINI_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini HTTP " + res.status + ":", errText);
      throw new Error("Gemini HTTP " + res.status);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Gemini raw:", raw);

    // Nettoyage du texte
    let cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .replace(/[\r\n]/g, " ")
      .trim();

    // Tenter le parse direct
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.log("Parse direct échoué, tentative de réparation...", e.message);
    }

    // Extraire le JSON avec regex (cherche { ... })
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.log("Parse regex échoué, extraction manuelle...", e.message);
      }
    }

    // Extraction manuelle des champs
    const cmdMatch = cleaned.match(/"command"\s*:\s*"([^"]*)"/);
    const msgMatch = cleaned.match(/"message"\s*:\s*"([^"]*)"/);

    // Récupérer les notes même si le tableau est coupé
    let notes = null;
    const notesStart = cleaned.indexOf('"notes"');
    if (notesStart !== -1) {
      // Extraire toutes les notes complètes {freq:X,duration:Y}
      const notesSection = cleaned.substring(notesStart);
      const noteRegex = /\{\s*"freq"\s*:\s*(\d+)\s*,\s*"duration"\s*:\s*(\d+)\s*\}/g;
      const foundNotes = [];
      let match;
      while ((match = noteRegex.exec(notesSection)) !== null) {
        foundNotes.push({ freq: parseInt(match[1]), duration: parseInt(match[2]) });
      }
      if (foundNotes.length > 0) {
        notes = foundNotes;
        console.log("Notes récupérées:", foundNotes.length);
      }
    }

    return {
      command: cmdMatch ? cmdMatch[1] : null,
      message: msgMatch ? msgMatch[1] : "J'ai composé quelque chose!",
      notes: notes,
    };
  }

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg, command: null }]);
    setIsLoading(true);

    let command = null, message = "", notes = null;

    try {
      const result = await askGemini(userMsg);
      command = result.command || null;
      message = result.message || "C'est parti!";
      notes = result.notes || null;
      console.log("Résultat final:", { command, message, notesCount: notes ? notes.length : 0 });
    } catch (err) {
      console.log("Gemini fallback", err);
      const local = localMatch(userMsg);
      command = local.command;
      const fb = { A: "LEDs allumées!", E: "Tout éteint.", "1": "Stayin' Alive!", "2": "Hymne russe!", "3": "Gamme!", D: "DISCO!", "0": "Stop!" };
      message = command ? fb[command] : "Pas compris. Essaie: 'compose un air joyeux', 'joue disco'...";
    }

    // PRIORITÉ : si on a des notes, on les joue (même si command n'est pas COMPOSE)
    if (notes && notes.length > 0) {
      command = "COMPOSE";
      console.log("Envoi de", notes.length, "notes à l'Arduino");
      await sendNotes(notes);
    } else if (command && command !== "COMPOSE") {
      console.log("Envoi commande simple:", command);
      await sendCommand(command);
    }

    setMessages(prev => [...prev, { role: "assistant", content: message, command, notes }]);
    setIsLoading(false);
  }

  // === RENDU ===
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg,#0a0a0f 0%,#1a0a2e 40%,#0f1a2e 100%)", fontFamily: "'JetBrains Mono','Fira Code',monospace", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;800&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(139,92,246,0.2)", background: "rgba(10,10,15,0.8)", backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "20px", fontWeight: 900, background: "linear-gradient(135deg,#8b5cf6,#ec4899,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, letterSpacing: "2px" }}>
              DJ ARDUINO
            </h1>
            <p style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 0", letterSpacing: "3px", textTransform: "uppercase" }}>
              Compositeur IA + USB Série
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isPlaying && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", marginRight: "8px" }}>
                {[12, 18, 8, 15, 10].map((h, i) => (
                  <div key={i} style={{ width: "3px", background: "#ec4899", borderRadius: "1px", animation: `eq 0.8s infinite ${i * 0.15}s alternate`, height: h + "px" }} />
                ))}
              </div>
            )}
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isConnected ? "#10b981" : "#ef4444", boxShadow: isConnected ? "0 0 12px #10b981" : "0 0 12px #ef4444", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "10px", color: isConnected ? "#10b981" : "#94a3b8" }}>{connectionStatus}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          {!isConnected ? (
            <button onClick={connectSerial} style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }}>
              CONNECTER USB SÉRIE
            </button>
          ) : (
            <button onClick={disconnectSerial} style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg,#ef4444,#dc2626)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }}>
              DÉCONNECTER
            </button>
          )}
        </div>
      </div>

      {/* BOUTONS RAPIDES */}
      <div style={{ padding: "10px 20px", display: "flex", gap: "6px", flexWrap: "wrap", borderBottom: "1px solid rgba(139,92,246,0.1)", background: "rgba(15,15,25,0.5)" }}>
        {Object.entries(COMMAND_LABELS).filter(([cmd]) => cmd !== "COMPOSE").map(([cmd, label]) => (
          <button key={cmd} onClick={async () => { await sendCommand(cmd); setMessages(p => [...p, { role: "user", content: "[" + label + "]", command: cmd }, { role: "assistant", content: label + " envoyé!", command: cmd }]); }} disabled={!isConnected}
            style={{ padding: "5px 10px", background: isConnected ? COMMAND_COLORS[cmd] + "22" : "rgba(100,100,100,0.1)", border: "1px solid " + (isConnected ? COMMAND_COLORS[cmd] + "66" : "#333"), borderRadius: "20px", color: isConnected ? COMMAND_COLORS[cmd] : "#555", fontSize: "9px", fontWeight: 600, cursor: isConnected ? "pointer" : "not-allowed", fontFamily: "inherit", letterSpacing: "1px", transition: "all 0.2s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* CHAT */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.3s ease" }}>
            <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "rgba(30,30,50,0.8)", border: msg.role === "assistant" ? "1px solid rgba(139,92,246,0.15)" : "none", boxShadow: msg.role === "user" ? "0 2px 10px rgba(124,58,237,0.3)" : "none" }}>
              <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5 }}>{msg.content}</p>

              {/* Badge commande */}
              {msg.command && (
                <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "10px", background: (COMMAND_COLORS[msg.command] || "#f97316") + "22", border: "1px solid " + (COMMAND_COLORS[msg.command] || "#f97316") + "44" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: COMMAND_COLORS[msg.command] || "#f97316", boxShadow: "0 0 6px " + (COMMAND_COLORS[msg.command] || "#f97316") }} />
                  <span style={{ fontSize: "9px", color: COMMAND_COLORS[msg.command] || "#f97316", fontWeight: 600, letterSpacing: "1px" }}>
                    {COMMAND_LABELS[msg.command] || msg.command}
                  </span>
                </div>
              )}

              {/* Visualisation des notes composées */}
              {msg.notes && msg.notes.length > 0 && (
                <div style={{ marginTop: "8px", padding: "8px", borderRadius: "8px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "9px", color: "#f97316", letterSpacing: "2px", textTransform: "uppercase" }}>
                    Partition ({msg.notes.length} notes)
                  </p>
                  <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", alignItems: "flex-end" }}>
                    {msg.notes.map((note, j) => {
                      const maxFreq = 880;
                      const height = note.freq === 0 ? 2 : Math.max(4, (note.freq / maxFreq) * 32);
                      const width = Math.max(4, Math.min(16, note.duration / 50));
                      return (
                        <div key={j} title={note.freq + "Hz " + note.duration + "ms"}
                          style={{ width: width + "px", height: height + "px", borderRadius: "1px", background: note.freq === 0 ? "#333" : `hsl(${(note.freq / maxFreq) * 280}, 80%, 60%)`, transition: "all 0.2s" }} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "rgba(30,30,50,0.8)", border: "1px solid rgba(139,92,246,0.15)" }}>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#8b5cf6", animation: "bounce 1.2s infinite " + i * 0.2 + "s" }} />)}
                <span style={{ fontSize: "9px", color: "#64748b", marginLeft: "8px" }}>Gemini compose...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* SERIAL LOG */}
      {serialLog.length > 0 && (
        <div style={{ padding: "8px 20px", borderTop: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)", maxHeight: "60px", overflowY: "auto" }}>
          <p style={{ margin: "0 0 4px", fontSize: "8px", color: "#10b981", letterSpacing: "2px", textTransform: "uppercase" }}>Serial</p>
          {serialLog.slice(-3).map((log, i) => <p key={i} style={{ margin: "1px 0", fontSize: "9px", color: "#10b98199", fontFamily: "inherit" }}>{log.text}</p>)}
        </div>
      )}

      {/* INPUT */}
      <div style={{ padding: "12px 20px 24px", borderTop: "1px solid rgba(139,92,246,0.15)", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder={isConnected ? "Ex: compose un air joyeux, joue quelque chose de triste..." : "Connecte l'Arduino d'abord..."}
            disabled={!isConnected || isPlaying}
            style={{ flex: 1, padding: "12px 16px", background: "rgba(30,30,50,0.8)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "12px", color: "#e2e8f0", fontSize: "13px", fontFamily: "inherit", outline: "none" }} />
          <button onClick={handleSend} disabled={!isConnected || !input.trim() || isLoading || isPlaying}
            style={{ padding: "12px 20px", background: isConnected && input.trim() && !isPlaying ? "linear-gradient(135deg,#8b5cf6,#ec4899)" : "rgba(100,100,100,0.2)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "16px", cursor: isConnected && input.trim() && !isPlaying ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
            {isPlaying ? "♪" : "▶"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes eq{from{height:4px}to{height:18px}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:2px}
      `}</style>
    </div>
  );
}