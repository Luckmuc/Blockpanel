# Settings API Documentation

## Passwort ändern

**Endpoint:** `POST /api/change_password`
**Authorization:** Bearer Token erforderlich

**Body (Form Data):**
- `old_password`: Das aktuelle Passwort
- `new_password`: Das neue Passwort (mindestens 8 Zeichen, muss Buchstaben und Zahlen enthalten)

**Response:**
```json
{
  "message": "Passwort geändert"
}
```

**Fehler:**
- 400: "Password must be at least 8 characters and contain letters and numbers"
- 400: "Altes Passwort falsch"

## Benutzername ändern

**Endpoint:** `POST /api/change_username`
**Authorization:** Bearer Token erforderlich

**Body (Form Data):**
- `new_username`: Der neue Benutzername (5-20 Zeichen, nur Buchstaben, Zahlen und Unterstriche)

**Response:**
```json
{
  "message": "Username geändert"
}
```

**Fehler:**
- 400: "Username must be 5-20 characters long and contain only letters, numbers, and underscores"
- 400: "Username existiert bereits"

**Wichtig:** Nach einer erfolgreichen Benutzername-Änderung ist das aktuelle JWT-Token ungültig, da es den alten Benutzernamen enthält. Der Benutzer muss sich erneut anmelden.

## Aktuelle Benutzerinformationen abrufen

**Endpoint:** `GET /api/me`
**Authorization:** Bearer Token erforderlich

**Response:**
```json
{
  "username": "benutzername",
  "hashed_password": "...",
  "must_change": false,
  "security_question": "...",
  "security_answer": "..."
}
```
