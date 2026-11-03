# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- Updated Vite from 8.2.2 to 8.2.4 for published dev-server security fixes. A local, Git-excluded Compose override replaces both published bindings with 127.0.0.1 while preserving the fixed submission environment. Dependency installation with lifecycle scripts disabled and the TypeScript/production build passed. The effective Compose configuration has one loopback-only mapping per service; containers were not started because the Docker engine was stopped.
