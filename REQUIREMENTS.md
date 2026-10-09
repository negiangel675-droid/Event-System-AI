# Doosre laptop par project chalana

## Required software

- Windows, macOS, ya Linux laptop.
- Node.js 20+; is project ke setup ke liye Node.js 22 use kar sakte ho. Node.js installer ke saath npm bhi install hota hai.
- Chrome, Edge, Firefox, ya koi modern browser.
- Pehli baar npm packages download karne ke liye internet.

Python requirements.txt ki zaroorat nahi hai: yeh Node.js project hai. Exact dependency versions `package-lock.json` mein hain; `npm ci` unhe install karta hai.

| Package | package.json version | Kaam |
| --- | --- | --- |
| express | ^4.19.2 | Web server aur API |
| better-sqlite3 | ^11.3.0 | Local SQLite database |
| dotenv | ^16.4.5 | .env configuration |
| googleapis | ^144.0.0 | Google Calendar integration |

MySQL, PostgreSQL, separate SQLite software, React build, ya VS Code install karna required nahi hai.

## Kya copy karna hai

Project folder copy/ZIP karo, lekin `node_modules` exclude karo. Doosre laptop par dependencies fresh install hongi, kyunki SQLite addon OS-specific hai.

`package.json`, `package-lock.json`, `setup.cjs`, `.env.example`, saari root JavaScript files aur `public/` folder zaroor copy karo. Poora folder copy karna easiest hai.

- Fresh demo ke liye `events.db`, `events.db-wal`, `events.db-shm` exclude kar sakte ho. App naya database aur sample data khud banayega.
- Existing events/registrations bhi chahiye toh pehle purane laptop par server Ctrl+C se band karo, phir `events.db` aur agar present hon toh uske `-wal` aur `-shm` files saath copy karo.
- Apni configured keys chahiye toh `.env` ko privately transfer karo. Otherwise setup `.env.example` se demo `.env` banayega. Public ZIP/repository mein secrets mat daalo.

## Ek command se install aur run

1. Doosre laptop par Node.js install karo.
2. Project ZIP extract karo aur project folder mein terminal/PowerShell kholo.
3. Run karo:

```sh
node setup.cjs
```

Yeh command dependencies install karega, missing `.env` banayega, aur server start karega. Existing `.env` overwrite nahi hoti. Browser mein **http://localhost:3000** kholo. `.env` mein PORT badla hai toh wahi port use karo. Terminal khula rakho; band karne ke liye Ctrl+C.

Agli baar dependencies dobara install karne ki zaroorat nahi:

```sh
npm start
```

Demo student IDs: **S001, S002, S003, S004**. Default admin password: **admin123**, jab tak `.env` mein ADMIN_PASSWORD change nahi kiya.

## Optional integrations

Basic project aur demo assistant API keys ke bina chalenge.

- Actual Gemini AI ke liye `.env` mein `GEMINI_API_KEY` set karo.
- Google Calendar ke liye `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, aur `GOOGLE_REDIRECT_URI` set karo; default callback `http://localhost:3000/auth/google/callback` hai. Admin → Integrations se Google account connect karo. Detailed configuration README.md mein hai.
- `.env` change karne ke baad server restart karo. External integrations ko internet aur valid credentials chahiye.

## Agar setup fail ho

- `node`/`npm` command not found: Node.js install karke terminal dobara kholo; `node -v` aur `npm -v` check karo.
- SQLite/native build error: Node.js 22 use karke `node setup.cjs` dobara run karo. Agar log `node-gyp`/compiler maange, Windows par Python aur Visual Studio Build Tools ka C++ workload; macOS par `xcode-select --install`; Linux par Python 3, make aur C++ compiler install karo. Yeh tools sirf source compilation ki zaroorat padne par chahiye.
- Port busy (`EADDRINUSE`): `.env` mein `PORT=3001` karo, restart karo aur http://localhost:3001 kholo. Calendar use kar rahe ho toh OAuth redirect URI bhi matching port par update karo.

## Tests chalana ho (optional)

App run karne ke liye Playwright required nahi hai. Development/test dependencies ke liye:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
```

Current UI test config `/tmp/gather-ui-test.db` use karta hai; Windows par UI tests ke liye us path ko writable local path mein badalna padega. Normal app default `events.db` use karta hai.
