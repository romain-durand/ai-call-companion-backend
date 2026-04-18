

## Plan : réduire la latence du premier mot de Gemini sur appels sortants

### Objectif
Faire en sorte que Gemini commence à parler **dans les ~800 ms** suivant le décrochage de l'appelé, au lieu de 2-5 s actuellement.

### Approche retenue : Option 5 (greeting proactif + primer)

### Changements à faire

**1. `bridge-server/src/outbound/outboundStreamHandler.js`**
- Lors de la réception du message Twilio `start` :
  - Démarrer un timer de 400 ms.
  - Au déclenchement : envoyer à Gemini un `realtimeInput.text` du type :
    *"L'appelé vient de décrocher. Salue-le brièvement (1 phrase courte), présente-toi, puis enchaîne sur l'objectif."*
  - Passer `awaitingOutboundFirstTurn = false` et `outboundFirstTurnTriggered = true`.
- Si une transcription de l'appelé arrive AVANT le déclenchement du timer (ex : il a dit "Allô" très vite) : annuler le timer, laisser le flux normal "input puis réponse" prendre le relais (logique actuelle).

**2. `bridge-server/src/outbound/outboundGeminiConfig.js`**
- Ajouter dans `OUTBOUND_SYSTEM_INSTRUCTION` une consigne :
  *"Si l'appelé parle en même temps que ta première phrase d'introduction, interromps-toi poliment et laisse-le finir avant de reprendre."*
- Préciser le format du greeting initial (ex : "Bonjour, je suis l'assistant de [USER_NAME], j'appelle pour [OBJECTIVE court]. Vous avez un instant ?").

**3. `bridge-server/src/outbound/outboundGeminiConnection.js`**
- Juste après réception de `setupComplete`, envoyer un primer texte silencieux pour préchauffer le pipeline audio de Gemini :
  - Un message système-like court, sans demander de réponse audio (ex : un `realtimeInput.text` du contexte mission lui-même, ce qui est déjà fait → ajouter en plus une note "tiens-toi prêt à parler dès que l'appelé décroche").
- Logger précisément le timestamp `setupComplete` vs. premier audio sortant pour mesurer le gain.

**4. Observabilité**
- Ajouter des logs avec timestamps dans `outboundStreamHandler.js` :
  - `outbound_twilio_start_received`
  - `outbound_first_turn_triggered`
  - `outbound_first_audio_emitted` (premier paquet audio renvoyé à Twilio)
- Permet de mesurer avant/après et d'itérer sur la valeur du délai (400 ms).

### Tests
- Lancer 3-5 missions vers un numéro de test, mesurer le délai perçu entre décrochage et première parole de Gemini.
- Vérifier qu'il n'y a pas de chevauchement gênant avec le "Allô" de l'appelé.
- Comparer les logs `outbound_first_audio_emitted - outbound_twilio_start_received`.

### Hors scope (à explorer si insuffisant)
- Option 4 (statusCallback `answered`) : peut être ajouté en deuxième passe si les 400 ms restants posent problème.
- Option 2 (filler audio) : à éviter sauf si le résultat de l'option 5 reste insatisfaisant.

### Risques
- Si l'appelé a un répondeur qui décroche silencieusement, Gemini pourrait parler dans le vide → mais ce comportement existe déjà aujourd'hui dès qu'il commence à parler. Pas un régression.
- Le délai de 400 ms est paramétrable, à ajuster selon retours.

