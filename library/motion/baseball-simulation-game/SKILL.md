---
slug: muapi-baseball-simulation-game
name: muapi-baseball-simulation-game
version: "1.0.0"
description: Simulate a cinematic baseball game highlight reel — design team uniforms and a stadium, generate key play moments as a storyboard, and animate the action into a broadcast-quality video highlight package.
acceptLicenseTerms: true
---


# Baseball Simulation Game

**Simulate a cinematic baseball game highlight reel — design team uniforms and a stadium, generate key play moments as a storyboard, and animate the action into a broadcast-quality video highlight package.**

The core idea: **every great game is told through 4–6 decisive moments.** This skill builds those moments from the ground up — a stadium atmosphere image anchors the world, team reference sheets lock visual identity across plays, and a multi-panel storyboard drives an image-to-video model to produce broadcast-style game footage.

## Inputs

| Name | Type | Required | Default | Description |
|:---|:---|:---|:---|:---|
| `home_team_name` | text | yes | — | Name of the home team (e.g. "Riverside Rockets"). |
| `away_team_name` | text | yes | — | Name of the away team (e.g. "Ironclad Bears"). |
| `home_team_colors` | text | yes | — | Uniform colors for the home team (e.g. "navy blue and gold pinstripes, white helmet"). |
| `away_team_colors` | text | yes | — | Uniform colors for the away team (e.g. "forest green and silver, grey road jersey"). |
| `stadium_description` | text | no | A classic open-air MLB-style stadium, green grass diamond, evening game under bright stadium lights, crowd of 40,000 | Stadium setting and atmosphere. |
| `game_scenario` | text | yes | — | The narrative arc of the game — describe the key plays to simulate (e.g. "bottom of the 9th, home team down by 1, runners on first and second, clean-up batter steps up, hits a walk-off grand slam"). |
| `broadcast_style` | text | no | ESPN broadcast style, 4K ultra HD, slow-motion replays, dynamic camera angles | The visual and broadcast aesthetic applied across all generated content. |
| `aspect_ratio` | text | no | 16:9 | Output aspect ratio — `16:9` widescreen broadcast, `9:16` vertical social. |
| `duration` | int | no | 15 | Final highlight video duration in seconds. |

---

## Steps

### Phase A — Home Team Uniform Reference Sheet

Generate a clean team reference sheet for the **home team** using `muapi image generate` (model=`gpt-image-2-text-to-image`):

- Prompt:
  ```
  Official baseball team uniform reference sheet for "{{home_team_name}}".
  Colors and design: {{home_team_colors}}.
  Show three views of a single player — front, side, and back — displaying the full uniform: jersey with team name on chest, matching pants, belt, cleats, batting helmet, and baseball cap.
  Include a close-up inset of the cap logo and jersey number font style.
  Clean white studio backdrop, neutral lighting, full body, no action pose — straight reference stance.
  High detail, crisp fabric textures, official sports-photography style.
  No text overlays. No background graphics.
  ```
- Aspect ratio: `3:2`

Present the home team reference sheet to the user. Confirm the colors, uniform design, and logo direction look correct before proceeding. **This image becomes the home team reference used in all downstream phases.**

---

### Phase B — Away Team Uniform Reference Sheet

Generate a reference sheet for the **away team** using `muapi image generate` (model=`gpt-image-2-text-to-image`):

- Prompt:
  ```
  Official baseball team uniform reference sheet for "{{away_team_name}}".
  Colors and design: {{away_team_colors}}.
  Show three views of a single player — front, side, and back — displaying the full uniform: jersey with team name on chest, matching pants, belt, cleats, batting helmet, and baseball cap.
  Include a close-up inset of the cap logo and jersey number font style.
  Clean white studio backdrop, neutral lighting, full body, no action pose — straight reference stance.
  High detail, crisp fabric textures, official sports-photography style.
  No text overlays. No background graphics.
  ```
- Aspect ratio: `3:2`

Present the away team reference sheet. Confirm design before proceeding. **This becomes the away team reference for all downstream phases.**

---

### Phase C — Stadium Atmosphere Plate

Generate the game environment using `muapi image generate` (model=`nano-banana-2`):

- Prompt:
  ```
  {{stadium_description}}.
  No players on field — environment only.
  Wide establishing broadcast shot from the camera deck above home plate, looking out toward center field.
  Vivid green grass diamond with freshly-chalked foul lines and basepaths. Pitcher's mound centered.
  Packed crowd in the stands — team colors visible in the bleachers, vendors, scoreboard lit up.
  Stadium lights blazing — light halos, slight lens flare on the field.
  {{broadcast_style}}.
  Photorealistic, cinematic, no text or graphics overlays, no HUD elements.
  ```
- Aspect ratio: `{{aspect_ratio}}`

Nano-Banana-2 is chosen here for its spatial reasoning — it produces stadiums with believable scale, perspective, and depth of field that make the downstream video feel grounded in a real venue. Present for approval. **This becomes the stadium environment plate.**

---

### Phase D — Game Storyboard

Compose the game scenario onto a single storyboard image using `muapi image edit` (model=`gpt-image-2-image-to-image`):

- Reference Images: the **home team reference** from Phase A **and** the **stadium plate** from Phase C.
- Prompt:
  ```
  Compose a 3×2 storyboard grid (6 numbered panels) depicting the following baseball game scenario:

  GAME SCENARIO: {{game_scenario}}

  HOME TEAM: "{{home_team_name}}" — use reference image 1 uniform identity throughout all panels where home team players appear.
  VENUE: Use reference image 2 stadium environment for all background/venue panels.

  Panel layout — adapt these beats to fit {{game_scenario}} exactly:
  PANEL 1 (WIDE) — Establishing shot: wide broadcast angle of the full stadium, home and away dugouts visible, scoreboard showing the game situation.
  PANEL 2 (MS) — The pitcher on the mound: mid-shot, glove raised, locked in on the catcher's sign. Pre-pitch tension.
  PANEL 3 (ECU) — Contact moment: extreme close-up of the bat making contact with the ball (or the decisive play as described in the scenario). Motion blur on the ball, impact frame.
  PANEL 4 (WIDE) — The ball in flight: wide angle tracking the ball trajectory — over the infield, outfielders tracking it. Crowd rising.
  PANEL 5 (MEDIUM-WIDE) — The key outcome: the decisive result of the scenario (home run landing, diving catch, tag play, etc.) — players reacting, crowd visible.
  PANEL 6 (MEDIUM) — The celebration: players mobbing at home plate or the decisive player pumping their fist — pure emotion. Stadium in full eruption.

  SHOT LABELS: Each panel must include: PANEL # · SHOT SIZE (WIDE / MS / CU / ECU) · 1-word MOOD (TENSION / IMPACT / FLIGHT / GLORY / CELEBRATION).

  Style: Clean photo-realistic storyboard thumbnails. Consistent uniform colors across panels. Numbered panels, clear gutters.
  {{broadcast_style}}.
  ```
- Aspect ratio: `1:1`

Present the storyboard. Confirm:
- The 6 panels read clearly as a game narrative
- Uniform colors are consistent with the reference sheet
- The scenario's decisive moment lands on the highest-impact panel

If a panel reads poorly, regenerate the storyboard with that panel's note bolded.

---

### Phase E — Storyboard → Highlight Video (Seedance 2.0)

Animate the storyboard into the final highlight video using `muapi video from-image` (model=`seedance-v2.0-i2v`):

- Reference Image: the **6-panel storyboard** from Phase D.
- Prompt:
  ```
  Generate a {{duration}}-second broadcast-quality baseball highlight video that follows the 6-panel storyboard reference image strictly, panel-by-panel, left-to-right, top-to-bottom.

  GAME CONTEXT: {{game_scenario}} — {{home_team_name}} vs {{away_team_name}}.

  SHOT ADHERENCE:
  - Panel 1 (WIDE establishing): Hold 2–3 seconds. Slow crane down from the upper deck toward the field. Stadium crowd buzzing, scoreboard visible.
  - Panel 2 (PITCHER MS): 2 seconds. Locked-off medium shot. Pitcher winds up — full delivery into release. Rosin bag puff. Crowd hush.
  - Panel 3 (CONTACT ECU): 1–2 seconds. Extreme slow-motion. Bat barrel meets ball — wood grain, ball seams blurring, impact shockwave visible. Crack of the bat audio peak.
  - Panel 4 (BALL FLIGHT WIDE): 2–3 seconds. Broadcast wide — camera follows ball arc. Outfielders turn and track. Crowd rising to their feet.
  - Panel 5 (OUTCOME): 2–3 seconds. Dynamic camera captures the decisive result. Players reacting, umpire call, crowd visible at stadium scale.
  - Panel 6 (CELEBRATION): 2–3 seconds. Handheld emotional close coverage. Team pours onto field or player raises fist — pure unscripted celebration energy.

  CAMERA LANGUAGE: Broadcast sports cinematography — mix of locked-off wide broadcast angles, tight handheld coverage on key moments, super-slow-motion replay on the contact frame, smooth rack focus shifts.
  NATIVE AUDIO: Stadium crowd noise throughout — hush before pitch, crack of the bat, erupting roar on contact, chanting, PA system echo, walk-off music swell.
  BROADCAST STYLE: {{broadcast_style}}.
  ASPECT RATIO: {{aspect_ratio}}.
  ```
- Duration: `{{duration}}`
- Aspect ratio: `{{aspect_ratio}}`
- Generate audio: `true`

After generation, present the final highlight video. If cut density feels low or panels don't map to the storyboard, regenerate Phase E first with "strict panel-by-panel adherence" bolded in the prompt before rebuilding the storyboard.

---

## Trigger Keywords

`baseball game`, `baseball simulation`, `baseball highlight video`, `sports simulation video`, `baseball storyboard`, `walk-off home run video`, `baseball broadcast video`, `MLB-style video`, `baseball animation`, `stadium game video`

---

## Pipeline at a Glance

```
home_team_colors ──────► [GPT-Image-2 t2i] ─► home team uniform sheet ──┐
away_team_colors ──────► [GPT-Image-2 t2i] ─► away team uniform sheet   │
                                                                          │
stadium_description ──► [Nano-Banana-2 t2i] ─► stadium plate ──────────►├─► [GPT-Image-2 i2i] ─► 6-panel storyboard ─► [Seedance 2.0 i2v] ─► highlight video
                                                                          │
game_scenario + broadcast_style ─────────────────────────────────────────┘
```

---

## Notes for the Executing Agent

- This recipe is LLM-orchestrated: read each phase, gather any missing inputs from the user, then call `muapi` CLI commands. Use `muapi auth configure` first if `MUAPI_API_KEY` is unset.
- **Phase D uses TWO reference images** (home team uniform sheet + stadium plate). Pass them as a list under `images_list` (or the model's documented multi-ref field) in that exact order — home team first.
- The away team uniform sheet (Phase B) is generated for presentation and user confirmation but is NOT passed as a reference image to Phase D; only the home team and stadium are used to anchor the storyboard. If the scenario features the away team as the focus (e.g., away team hits the decisive blow), swap the reference image order in Phase D.
- Substitute all `{{input_name}}` placeholders with the user's actual inputs before issuing each call.
- For model IDs without a CLI alias yet, fall back to the raw endpoint: `curl -X POST https://api.muapi.ai/api/v1/<endpoint> -H "x-api-key: $MUAPI_API_KEY" -H 'content-type: application/json' -d '{...}'` and poll with `muapi predict wait <request_id>`.
- **Extending the highlight reel**: For longer games (30s+), chain two storyboard runs — storyboard A covers the first half of `game_scenario`, storyboard B covers the final plays, using the last cell of A as a continuity anchor in B's first panel.
- **Draft pass**: Use `seedance-2.0-i2v-480p` for a cheaper preview before committing to the full `seedance-v2.0-i2v` run.
- Both English and Chinese prompts work across all four models.
