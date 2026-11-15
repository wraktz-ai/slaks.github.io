# WinTerm — Windows Terminal-style shell for iPhone

A Windows Terminal look-alike that runs in Safari on iPhone (built for iPhone 14 / iOS 26). It has tabs, a PowerShell profile and a Command Prompt profile, color schemes, and an extra-keys bar above the keyboard.

**Install:** open the GitHub Pages URL in Safari, then tap Share ▸ **Add to Home Screen**. It runs full-screen and works offline.

## Features
- Tabs (+ new tab, ⌄ menu for profiles/settings), PowerShell and Command Prompt prompts and error styles
- Virtual `C:` drive saved on the device: `dir/ls`, `cd`, `type/cat`, `mkdir`, `New-Item`, `del/rm -r`, `copy`, `move`, `ren`, `tree`
- `notepad <file>` built-in editor; `.bat`/`.ps1` scripts on the virtual drive can be run
- Pipes (`| findstr`, `| sort`, `| select -First N`, `| measure`, `| Out-File`), redirects (`>`, `>>`), `;` / `&&` chaining
- Variables: `$x = 2+2`, `$env:USERNAME`, `set X=1`, `%X%`
- `ping` (HTTPS timing), `curl`/`iwr` (CORS permitting), `systeminfo`, `winfetch`, `Get-Process`, `ipconfig` (simulated)
- `theme`, `color 0A`, `font 14`, `title`, `history`, Tab completion, ↑/↓ history, Ctrl+C

It is a simulation: iOS does not allow real Windows or native shells, so everything runs in the browser sandbox.
