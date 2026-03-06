/*
 * Jukebox Arduino — Version Compositeur CORRIGÉ
 * Commandes classiques + mode notes libres
 * 
 * COMMANDES :
 *   A → Allumer LEDs
 *   E → Éteindre LEDs
 *   1 → Stayin' Alive
 *   2 → Hymne Russie
 *   3 → Gamme Do
 *   D → Disco
 *   0 → Stop
 * 
 * MODE NOTES (format: N<freq>,<duree>;)
 *   Exemple: N262,500; → joue Do4 pendant 500ms
 */

// ===== BROCHES =====
const int BUZZER = 9;
const int LED_1  = 10;
const int LED_2  = 11;
const int LED_3  = 12;
const int LED_4  = 13;

// ===== NOTES =====
#define DO4  262
#define RE4  294
#define MI4  330
#define FA4  349
#define SOL4 392
#define LA4  440
#define SI4  494
#define DO5  523
#define RE5  587
#define MI5  659
#define FA5  698
#define SILENCE 0

// ===== TEMPO =====
int bpm = 104;
bool stopRequested = false;

int noire()   { return 60000 / bpm; }
int croche()  { return noire() / 2; }
int pointee() { return noire() * 1.5; }
int blanche() { return noire() * 2; }

// ===== BUFFER SÉRIE =====
String inputBuffer = "";
bool modeCompose = false;  // FLAG: on est en mode composition

// ===== SETUP =====
void setup() {
  Serial.begin(9600);
  pinMode(BUZZER, OUTPUT);
  pinMode(LED_1, OUTPUT);
  pinMode(LED_2, OUTPUT);
  pinMode(LED_3, OUTPUT);
  pinMode(LED_4, OUTPUT);

  Serial.println("{\"status\":\"ready\",\"message\":\"Jukebox Compositeur pret!\"}");
}

// ===== FONCTIONS =====
void toutEteindre() {
  digitalWrite(LED_1, LOW);
  digitalWrite(LED_2, LOW);
  digitalWrite(LED_3, LOW);
  digitalWrite(LED_4, LOW);
}

void toutAllumer() {
  digitalWrite(LED_1, HIGH);
  digitalWrite(LED_2, HIGH);
  digitalWrite(LED_3, HIGH);
  digitalWrite(LED_4, HIGH);
}

void allumerLed(int note) {
  toutEteindre();
  if (note == SILENCE) return;
  if (note <= RE4)       digitalWrite(LED_1, HIGH);
  else if (note <= SOL4) digitalWrite(LED_2, HIGH);
  else if (note <= DO5)  digitalWrite(LED_3, HIGH);
  else                   digitalWrite(LED_4, HIGH);
}

void checkStop() {
  if (Serial.available()) {
    char c = Serial.peek();
    if (c == '0') {
      Serial.read();
      stopRequested = true;
      modeCompose = false;
    }
  }
}

void jouerNote(int frequence, int duree) {
  checkStop();
  if (stopRequested) return;

  allumerLed(frequence);
  if (frequence != SILENCE) {
    tone(BUZZER, frequence, duree * 0.85);
  }
  delay(duree);
  noTone(BUZZER);
}

// ===== JOUER UNE NOTE DEPUIS COMMANDE N =====
void jouerNoteCommande(String data) {
  int virgule = data.indexOf(',');
  if (virgule == -1) return;

  int freq = data.substring(0, virgule).toInt();
  int duree = data.substring(virgule + 1).toInt();

  if (freq >= 0 && freq <= 2000 && duree > 0 && duree <= 5000) {
    Serial.print("{\"status\":\"note\",\"freq\":");
    Serial.print(freq);
    Serial.print(",\"dur\":");
    Serial.print(duree);
    Serial.println("}");
    jouerNote(freq, duree);
  }
}

// ===== MÉLODIES PRÉDÉFINIES =====
void stayinAlive() {
  bpm = 104;
  Serial.println("{\"status\":\"playing\",\"track\":\"Stayin Alive\"}");
  jouerNote(LA4, croche()); jouerNote(SOL4, croche());
  jouerNote(FA4, croche()); jouerNote(MI4, croche());
  jouerNote(FA4, croche()); jouerNote(MI4, croche());
  jouerNote(RE4, noire());
  jouerNote(FA4, croche()); jouerNote(MI4, croche());
  jouerNote(RE4, noire());
  jouerNote(SILENCE, croche());
  jouerNote(LA4, croche()); jouerNote(SOL4, croche());
  jouerNote(FA4, croche()); jouerNote(MI4, croche());
  jouerNote(FA4, noire()); jouerNote(MI4, croche());
  jouerNote(RE4, noire());
}

void hymneRussie() {
  bpm = 80;
  Serial.println("{\"status\":\"playing\",\"track\":\"Hymne Russie\"}");
  jouerNote(SOL4, pointee()); jouerNote(DO5, croche());
  jouerNote(DO5, noire()); jouerNote(SI4, noire());
  jouerNote(DO5, noire()); jouerNote(RE5, noire());
  jouerNote(MI5, pointee()); jouerNote(MI5, croche());
  jouerNote(RE5, noire()); jouerNote(DO5, noire());
  jouerNote(SI4, noire()); jouerNote(DO5, noire());
  jouerNote(LA4, pointee()); jouerNote(LA4, croche());
  jouerNote(LA4, noire()); jouerNote(SI4, noire());
  jouerNote(SOL4, noire()); jouerNote(LA4, noire());
  jouerNote(SI4, pointee()); jouerNote(SI4, croche());
  jouerNote(DO5, noire()); jouerNote(LA4, noire());
  jouerNote(SOL4, blanche());
}

void gammeDo() {
  bpm = 120;
  Serial.println("{\"status\":\"playing\",\"track\":\"Gamme Do\"}");
  jouerNote(DO4, noire()); jouerNote(RE4, noire());
  jouerNote(MI4, noire()); jouerNote(FA4, noire());
  jouerNote(SOL4, noire()); jouerNote(LA4, noire());
  jouerNote(SI4, noire()); jouerNote(DO5, blanche());
}

void modeDisco() {
  bpm = 120;
  Serial.println("{\"status\":\"playing\",\"track\":\"Disco\"}");
  for (int i = 0; i < 8; i++) {
    checkStop(); if (stopRequested) return;
    toutEteindre(); digitalWrite(LED_1, HIGH);
    tone(BUZZER, DO4, 100); delay(croche());
    toutEteindre(); digitalWrite(LED_2, HIGH);
    tone(BUZZER, MI4, 100); delay(croche());
    toutEteindre(); digitalWrite(LED_3, HIGH);
    tone(BUZZER, SOL4, 100); delay(croche());
    toutEteindre(); digitalWrite(LED_4, HIGH);
    tone(BUZZER, DO5, 100); delay(croche());
  }
}

// ===== LOOP =====
void loop() {
  while (Serial.available()) {
    char c = Serial.read();

    // Ignorer retours à la ligne
    if (c == '\n' || c == '\r') continue;

    // Début d'une note : activer le mode compose
    if (c == 'N') {
      modeCompose = true;
      inputBuffer = "";
      continue;
    }

    // Si on est en mode compose, accumuler dans le buffer
    if (modeCompose) {
      if (c == ';') {
        // Fin de la note, on la joue
        jouerNoteCommande(inputBuffer);
        inputBuffer = "";
        modeCompose = false;  // Prêt pour la prochaine commande ou note
      } else {
        inputBuffer += c;
      }
      continue;
    }

    // Commande simple (1 caractère) — seulement si PAS en mode compose
    stopRequested = false;
    toutEteindre();
    noTone(BUZZER);

    switch (c) {
      case 'A': toutAllumer(); Serial.println("{\"status\":\"ok\",\"action\":\"leds_on\"}"); break;
      case 'E': toutEteindre(); Serial.println("{\"status\":\"ok\",\"action\":\"leds_off\"}"); break;
      case '1': stayinAlive(); break;
      case '2': hymneRussie(); break;
      case '3': gammeDo(); break;
      case 'D': modeDisco(); break;
      case '0': Serial.println("{\"status\":\"ok\",\"action\":\"stop\"}"); break;
    }

    toutEteindre();
    noTone(BUZZER);
    Serial.println("{\"status\":\"ready\"}");
  }
}