# DJ Arduino — Jukebox Bluetooth + IA Compositeur

Un jukebox interactif piloté par intelligence artificielle. Parle naturellement à Gemini AI depuis une appli web, et il compose et joue des mélodies sur un buzzer Arduino avec effets lumineux synchronisés.

## Démo

Tu tapes dans le chat : *"compose un air joyeux"*, *"joue la Marseillaise"*, *"mets du disco"*
→ Gemini interprète ta demande, compose les notes, et les envoie à l'Arduino qui les joue en temps réel sur le buzzer avec les LEDs qui suivent la mélodie.

## Fonctionnalités

- **Chatbot IA** : Gemini AI interprète tes demandes en langage naturel
- **Compositeur** : l'IA crée ses propres mélodies note par note (fréquence + durée)
- **Mélodies pré-enregistrées** : Stayin' Alive, Hymne de la Russie, Gamme Do majeur, Mode Disco
- **Contrôle LEDs** : 4 LEDs synchronisées sur la hauteur des notes
- **Communication USB Série** : via Web Serial API (Chrome)
- **Fallback local** : détection par mots-clés si Gemini est indisponible
- **Serial Monitor** : visualisation en temps réel des échanges Arduino ↔ Web
- **Partition visuelle** : affichage graphique des notes composées dans le chat

## Matériel nécessaire

| Composant | Quantité | Broche Arduino |
|-----------|----------|----------------|
| Arduino Uno | 1 | — |
| LED (couleurs au choix) | 4 | D10, D11, D12, D13 |
| Résistance 220Ω | 4 | En série avec chaque LED |
| Buzzer piézo | 1 | D9 |
| Breadboard | 1 | — |
| Fils de connexion | ~15 | — |
| Câble USB | 1 | Arduino → PC |

### Option Bluetooth (HC-05)

Pour un contrôle sans fil depuis le téléphone (via Serial Bluetooth Terminal) :

| Composant | Broche Arduino |
|-----------|----------------|
| HC-05 VCC | 5V |
| HC-05 GND | GND |
| HC-05 TXD | D2 |
| HC-05 RXD | D3 (via diviseur de tension 1kΩ + 2kΩ) |

## Schéma de câblage

```
Arduino Uno
┌──────────────────────┐
│                      │
│  D13 ──→ 220Ω ──→ LED 4 ──→ GND
│  D12 ──→ 220Ω ──→ LED 3 ──→ GND
│  D11 ──→ 220Ω ──→ LED 2 ──→ GND
│  D10 ──→ 220Ω ──→ LED 1 ──→ GND
│  D9  ──→ BUZZER (+)  (−) ──→ GND
│                      │
│  D2  ←── TXD (HC-05, optionnel)
│  D3  ──→ RXD (HC-05, optionnel)
│                      │
│  5V  ──→ VCC (HC-05) │
│  GND ──→ GND (HC-05) │
│                      │
└──────────────────────┘
```

## Installation

### 1. Arduino

Ouvre l'IDE Arduino, colle le code de `sketch_dj_arduino.ino` et téléverse-le sur ta carte.

### 2. Appli Web (React)

```bash
# Créer le projet
npx create-react-app dj-arduino
cd dj-arduino

# Remplacer src/App.js par le fichier App.js du projet

# Lancer
npm start
```

### 3. Configuration API Gemini

1. Obtiens une clé API sur [Google AI Studio](https://aistudio.google.com/apikey)
2. Ouvre `src/App.js`
3. Remplace `TA_CLE_API_ICI` par ta clé à la ligne 6

### 4. Connexion

1. Ouvre **Chrome** (obligatoire pour Web Serial)
2. Branche l'Arduino en USB
3. Ferme le Moniteur Série de l'IDE Arduino
4. Clique **CONNECTER USB SÉRIE** dans l'appli
5. Sélectionne le port de l'Arduino

## Commandes

### Via le chat (langage naturel)

| Ce que tu dis | Ce qui se passe |
|---------------|-----------------|
| "allume les lumières" | LEDs on |
| "éteins tout" | LEDs off |
| "joue Stayin' Alive" | Mélodie pré-enregistrée |
| "mets l'hymne russe" | Mélodie pré-enregistrée |
| "mode disco" | Chenillard + sons |
| "compose un air joyeux" | Gemini compose une mélodie originale |
| "joue Frère Jacques" | Gemini compose une approximation |
| "fais un jingle de victoire" | Gemini compose une mélodie originale |
| "stop" | Tout arrêter |

### Boutons rapides

L'appli propose des boutons directs : ALLUMER, ÉTEINDRE, STAYIN' ALIVE, HYMNE RUSSIE, GAMME DO, DISCO, STOP.

### Commandes série brutes

| Caractère | Action |
|-----------|--------|
| `A` | Allumer toutes les LEDs |
| `E` | Éteindre toutes les LEDs |
| `1` | Jouer Stayin' Alive |
| `2` | Jouer Hymne de la Russie |
| `3` | Jouer Gamme Do majeur |
| `D` | Mode Disco |
| `0` | Stop |
| `N262,500;` | Jouer Do4 pendant 500ms |

## Architecture

```
┌─────────────┐     langage      ┌──────────┐     JSON      ┌──────────┐
│  Utilisateur │ ──────────────→  │  App Web  │ ───────────→  │  Gemini  │
│  (Chrome)    │                  │  (React)  │ ←───────────  │  AI API  │
└─────────────┘                  └──────────┘               └──────────┘
                                      │
                                      │ Web Serial (USB)
                                      │ N392,500;
                                      ▼
                                 ┌──────────┐
                                 │  Arduino  │
                                 │  Uno      │
                                 └──────────┘
                                   │      │
                              Buzzer    4 LEDs
                              (D9)    (D10-D13)
```

## Protocole de composition

Quand Gemini compose, il renvoie un JSON contenant un tableau de notes :

```json
{
  "command": "COMPOSE",
  "message": "Frère Jacques!",
  "notes": [
    {"freq": 262, "duration": 500},
    {"freq": 294, "duration": 500},
    {"freq": 330, "duration": 500},
    {"freq": 262, "duration": 500}
  ]
}
```

L'appli web envoie ensuite chaque note à l'Arduino au format `N<freq>,<durée>;` en attendant que chaque note soit jouée avant d'envoyer la suivante.

### Table des fréquences

| Note | Hz | Note | Hz |
|------|----|------|----|
| DO4 | 262 | DO5 | 523 |
| RE4 | 294 | RE5 | 587 |
| MI4 | 330 | MI5 | 659 |
| FA4 | 349 | FA5 | 698 |
| SOL4 | 392 | SOL5 | 784 |
| LA4 | 440 | — | — |
| SI4 | 494 | — | — |

## Dépannage

**L'appli ne se connecte pas au port série**
→ Ferme le Moniteur Série de l'IDE Arduino. Un seul programme peut accéder au port à la fois. Utilise Chrome (Firefox ne supporte pas Web Serial).

**Erreur 429 (Too Many Requests)**
→ Quota Gemini dépassé. Attends 1 minute ou change de modèle dans App.js (`gemini-1.5-flash`).

**Erreur 503 (Service Unavailable)**
→ Gemini est surchargé. Réessaie dans quelques minutes ou utilise `gemini-1.5-flash`.

**Le JSON de Gemini est tronqué**
→ L'appli gère ce cas automatiquement en récupérant les notes complètes même si le JSON est coupé.

**L'Arduino joue des mélodies pré-enregistrées au lieu des notes composées**
→ Vérifie que tu as bien téléversé la version "Compositeur" du code Arduino (avec le flag `modeCompose`).

**Le HC-05 clignote vite sans se connecter**
→ Code d'appairage par défaut : `1234`. Utilise l'appli Serial Bluetooth Terminal sur Android.

## Structure du projet

```
dj-arduino/
├── src/
│   ├── App.js              # Appli React (chatbot + Web Serial)
│   └── index.js             # Point d'entrée React
├── sketch_dj_arduino.ino    # Code Arduino (à téléverser)
├── schema_cablage.svg       # Schéma de câblage
└── README.md                # Ce fichier
```

## Technologies utilisées

- **Arduino Uno** — Microcontrôleur
- **React** — Interface web
- **Google Gemini API** — Intelligence artificielle
- **Web Serial API** — Communication USB navigateur ↔ Arduino
- **Web Bluetooth API** — Communication BLE (optionnel)

## Licence

Projet éducatif libre — fais-en ce que tu veux !