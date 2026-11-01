# Cricket Buddy

A translucent second-screen assistant for live cricket. You watch the match on a streaming site. A small floating panel sits on top of the video. When you do not understand a term or something which happened, u get access to LLM who is feeding on the live data to better assist your questions!!!!

## Demo link
A quick demo if u do not have a live match going on to test.......
https://youtu.be/zHBFid4v91c

## The fan problem
Casual [like me :)] and newer fans follow a match but get lost in jargon (powerplay, DLS, yorker) and in why things happen (LBW, caught behind, run out). Pausing to search loses the moment. Cricket Buddy answers in place, using what is actually happening in the match.

## How it works

```
 Cricbuzz tab                      Your streaming tab (JioHotstar / SonyLIV / FanCode)
 ------------                      ------------------------------------------
 cricbuzz.js                       content.js  (the floating panel)
  reads visible commentary          shows chat, buttons, match context
        |                                   |
        |  chrome.storage.local             |  chrome.runtime message
        +--------------> panel <------------+
                                            |
                                      background.js
                                            |
                                  Gemini (free) API
```

1. `cricbuzz.js` reads the live commentary and score from a Cricbuzz match page and saves the newest balls.
2. The panel on your stream reads that feed, holds back anything newer than your stream shows (spoiler delay), and keeps the 12 newest balls ready.
3. When you ask a question, the panel sends it, plus those balls and the current score, to `background.js`, which calls the AI and returns a 2 to 4 sentence answer.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Tells Chrome what the extension is, which sites it runs on, and what it may access. |
| `background.js` | Makes the AI calls (Gemini), holds the system prompt, applies a 25 second timeout. Your key never reaches the streaming page. |
| `content.js` | The floating panel: UI, dragging, fullscreen handling, chat, quick buttons, Match context box, and the live feed with spoiler delay. |
| `cricbuzz.js` | The Cricbuzz reader. Finds ball-by-ball lines on the page, cleans them, extracts the current over/score box, and saves them every few seconds. |
| `options.html`, `options.js` | The settings page: provider, API keys, model, stream delay, panel opacity, and a Test key & list models button. |
| `config.example.js` | Template for keeping an API key in a local file. Copy to `config.local.js`. |
| `.gitignore` | Keeps `config.local.js` out of Git so your key is never pushed. |
| `icons/` | Toolbar icons. |

## Install (Chrome, Edge, Brave)
1. Unzip the folder.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the `cricket-buddy` folder.
4. Pin the extension from the puzzle-piece menu.

## Set up the AI
Gemini has a free tier, so it is the default.
1. Create a free key at aistudio.google.com (Get API key).
2. Right-click the extension icon, open **Options**, keep the provider on Gemini, paste the key.
3. Press **Test key & list models**, then click a fast model. Lite or Flash-Lite models answer quickest; newer "thinking" models can be too slow for live use.
4. Press **Save**.

Claude is available as an alternative provider in the same page.

### Keeping your key out of GitHub
- Option A: paste it in Options. It is stored in the browser only, not in any file.
- Option B: copy `config.example.js` to `config.local.js`, add your key, reload the extension. `config.local.js` is gitignored.
- Check `git status` before your first push. A key committed once stays in Git history.

## Using it
1. Open a Cricbuzz match page, on the **Live** tab, in its own visible window next to your stream.
2. Open your stream on JioHotstar, SonyLIV or FanCode. The panel appears automatically. On any other site, click the toolbar icon.
3. In Options, set **Stream delay** to how many seconds your stream runs behind live (often 20 to 60). The panel then hides anything newer than your stream shows.
4. Use the panel:
   - **Why out?** explains the latest dismissal and the rule behind it.
   - **Last over** summarises what just happened.
   - **Where are we?** gives the situation and what to watch.
   - **Explain a term**, or type any question.
   - **Match context** shows a box where you can paste commentary yourself. **Add selected text** copies highlighted page text into it. **Show feed** prints exactly what the AI is receiving. The status line shows the latest ball and when the feed was last checked.
5. Drag the panel by its header. Use the dash to collapse and X to hide (toolbar icon brings it back). Opacity is in Options.

## Known limitations
- **Cricbuzz tab must stay visible.** Chrome slows hidden tabs, so the feed can stall. The panel warns when the feed has not been checked for 90 seconds.
- **Reader is a prototype.** It reads visible page text and may need adjusting if Cricbuzz changes its layout. Scraping may also conflict with Cricbuzz's terms, so a production version would use a licensed data feed.
- **Fullscreen.** The panel re-attaches inside the fullscreen element. If a site blocks this, the panel can disappear in fullscreen.
- **Player shortcuts.** Typing in the panel is shielded from the player, but some sites capture keys earlier.
- **Free-tier limits.** Rapid questions can hit Gemini rate limits.
- **Answers are only as good as the feed.** If the commentary lacks a detail, the assistant says so rather than inventing it.

## Troubleshooting
- **"Thinking..." then a timeout:** pick a faster model in Options.
- **"Feed: not connected":** open a Cricbuzz match page and refresh it after reloading the extension.
- **"no commentary found":** you are probably on a tab with no ball-by-ball text. Use the Live tab.
- **Nothing changed after editing files:** reload the extension at `chrome://extensions`, then refresh the tabs.
- **AI errors:** open `chrome://extensions`, click **service worker** under Cricket Buddy, and read the Console.

## Privacy
The extension has no server of its own. Your question and the recent commentary lines go directly to the AI provider you chose. Settings and keys stay in your browser.

