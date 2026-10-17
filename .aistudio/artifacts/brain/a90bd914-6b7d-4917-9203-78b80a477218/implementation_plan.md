# Lesson Player Enhancements Plan (Quality Switcher, Keyboard Shortcuts & Measurable Volume Control)

## 1. Overview
Enhance the custom DIU EduTech lesson player in `app/learn/[courseId]/page.tsx` and helper utilities in `lib/lms-logic.ts` with three core playback features while keeping all existing YouTube corner/top/bottom protective overlays intact:

1. **Video Quality Selector (`Auto`, `1080p`, `720p`, `480p`, `360p`, `240p`)** in the bottom control bar.
2. **Keyboard Shortcuts**:
   - `Space`: Toggle Play / Pause.
   - `ArrowRight`: Seek forward `+10s`.
   - `ArrowLeft`: Seek backward `-10s`.
3. **Manual Measurable Volume Control (`0%` – `100%`)**:
   - Interactive volume slider (`0` to `100`, step `1`) plus a direct numeric percentage input (`0`–`100%`) so students can set exact values like `33%` by dragging or typing.

---

## 2. Technical Design & Component Changes

### A. Pure Logic & Validation Helpers (`lib/lms-logic.ts` & `lib/lms-logic.test.ts`)
- **`YOUTUBE_QUALITY_OPTIONS`**:
  - Define structured quality tiers mapping user-facing labels to YouTube IFrame API quality codes:
    - `auto` → `'default'` (`Auto`)
    - `hd1080` → `'hd1080'` (`1080p HD`)
    - `hd720` → `'hd720'` (`720p HD`)
    - `large` → `'large'` (`480p`)
    - `medium` → `'medium'` (`360p`)
    - `small` → `'small'` (`240p`)
- **`clampVolume(value: number): number`**:
  - Clamps and rounds any numeric input to an integer in `[0, 100]`.
- **`computeSeekOffset(currentTime: number, deltaSeconds: number, duration: number): number`**:
  - Computes target seek position clamped safely between `0` and `duration` (or `5400` fallback when duration is not yet reported).
- **`buildYouTubeEmbedUrl` update**:
  - Support optional `vq` (video quality hint) and `start` (resume timestamp in seconds) parameters when needed.
- **Unit Tests (`lib/lms-logic.test.ts`)**:
  - Add unit tests verifying `clampVolume` (including `33%`, `0%`, `100%`, out-of-range inputs), `computeSeekOffset` (`+10s` and `-10s` boundary clamping), and quality option validation.

### B. Manual Measurable Volume Control (`app/learn/[courseId]/page.tsx`)
- **State**:
  - `volume`: number (`0`–`100`, default `100`).
  - `previousVolume`: number (stores last non-zero volume prior to muting, e.g. `33`, so unmuting restores `33%`).
- **UI Controls (Left Group of Bottom Bar)**:
  - Keep the **Mute / Unmute** icon button (`Volume2` / `Volume1` / `VolumeX`).
  - Add a compact, always-accessible **Volume Range Slider** (`min={0}`, `max={100}`, `step={1}`) paired with a **Direct Numeric Volume Input (`0–100` + `%` suffix)** so users can either slide or type any exact number such as `33` to set volume to `33%`.
- **YouTube IFrame API Integration**:
  - Changing volume calls `sendPlayerCommand('setVolume', [clampedVolume])`.
  - If `clampedVolume === 0`, automatically mute (`sendPlayerCommand('mute')`, `setIsMuted(true)`).
  - If `clampedVolume > 0` while muted, automatically unmute (`sendPlayerCommand('unMute')`, `setIsMuted(false)`).
  - Re-apply saved volume whenever the iframe finishes loading or starts playing so the chosen percentage persists across play states.

### C. Video Quality Selector (`app/learn/[courseId]/page.tsx`)
- **State**:
  - `videoQuality`: `'default' | 'hd1080' | 'hd720' | 'large' | 'medium' | 'small'` (default `'hd720'` or `'default'`).
  - `qualityMenuOpen`: boolean for toggling the upward quality popover menu in the bottom-right control group.
- **UI Controls (Right Group of Bottom Bar)**:
  - Add a **Quality Selector Button** (displaying current selection badge, e.g. `Auto`, `1080p`, `720p`, `480p`, `360p`, `240p`) next to the `Speed` button.
  - Clicking opens a clean dark upward popover menu above the bottom control bar listing all quality options with an active indicator.
- **YouTube IFrame API Integration**:
  - When a quality option is selected:
    1. Dispatch `sendPlayerCommand('setPlaybackQualityRange', [qualityCode, qualityCode])` and `sendPlayerCommand('setPlaybackQuality', [qualityCode])`.
    2. Close the popover menu and show a subtle confirmation toast/feedback badge (e.g., `Video quality set to 720p HD`).

### D. Keyboard Shortcuts (`Space`, `ArrowRight`, `ArrowLeft`) (`app/learn/[courseId]/page.tsx`)
- **Global `keydown` Listener on the Lesson Page**:
  - Ignore key events when `event.target` is an `<input>` (except when Space is pressed on non-text range sliders where appropriate, or guard text/number inputs), `<textarea>`, `<select>`, or `isContentEditable`, or when modifier keys (`Ctrl`, `Alt`, `Meta`) are held.
  - **`Space` (`event.code === 'Space'` or `event.key === ' '`)**:
    - Calls `event.preventDefault()` to prevent page scroll.
    - Toggles Play / Pause (`handleTogglePlayPause`). If the lesson is still on the cover screen, starts playback immediately.
  - **`ArrowRight` (`event.key === 'ArrowRight'`)**:
    - Calls `event.preventDefault()`.
    - When the lesson player is active, seeks forward 10 seconds (`computeSeekOffset(currentTime, 10, duration)`), updates `currentTime`, and dispatches `sendPlayerCommand('seekTo', [nextTime, true])`.
  - **`ArrowLeft` (`event.key === 'ArrowLeft'`)**:
    - Calls `event.preventDefault()`.
    - When the lesson player is active, seeks backward 10 seconds (`computeSeekOffset(currentTime, -10, duration)`), updates `currentTime`, and dispatches `sendPlayerCommand('seekTo', [nextTime, true])`.
  - **Visual Shortcut Feedback Indicator**:
    - Briefly display a non-intrusive on-screen badge in the center of the video viewport (`Play`, `Pause`, `+10s ⏩`, `-10s ⏪`) for `650ms` when triggered via keyboard so the user gets immediate visual confirmation.

---

## 3. Verification Plan
1. **Unit Tests**: Run `node --test lib/lms-logic.test.ts` to verify volume clamping (`33%`), `+10s`/`-10s` seek offset calculation, and quality code helpers.
2. **Type Check & Build**: Run `lint_applet` and `compile_applet` to confirm zero TypeScript or Next.js build issues.
3. **Interactive Browser Verification**:
   - Open a lesson in `/learn/[courseId]`, start playback, and test:
     - Setting volume manually to `33%` and verifying the input and slider reflect `33%`.
     - Opening the Quality menu and switching quality levels (e.g., `1080p`, `720p`, `480p`).
     - Pressing `Space` to pause/play, `ArrowRight` to advance `+10s`, and `ArrowLeft` to rewind `-10s`.
