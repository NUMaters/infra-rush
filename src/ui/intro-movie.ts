import type { Sound } from "./audio";

const previewUrl =
  "https://drive.google.com/file/d/14miX34VEFc2IfsU7Cb0NvnIXvG2Z_Cj4/preview";

export function setupIntroMovie(sound: Sound, onOpen: () => void) {
  const trigger =
    document.querySelector<HTMLButtonElement>("#title-movie-open")!;
  const dialog = document.querySelector<HTMLDialogElement>("#intro-movie")!;
  const player = dialog.querySelector<HTMLElement>(".intro-movie-player")!;
  const close = dialog.querySelector<HTMLButtonElement>("#intro-movie-close")!;
  let restoreMusic: (() => void) | undefined;
  let closing = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let backdropPointer = false;

  const finishClose = () => {
    clearTimeout(closeTimer);
    if (!dialog.open) return;
    dialog.close();
    dialog.classList.remove("is-closing");
    closing = false;
    restoreMusic?.();
    restoreMusic = undefined;
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus({ preventScroll: true });
  };
  const requestClose = () => {
    if (!dialog.open || closing) return;
    closing = true;
    // Removing the browsing context stops video/audio immediately, even during
    // the closing animation. A fresh context is created on each subsequent open.
    player.replaceChildren();
    dialog.classList.add("is-closing");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finishClose();
    else closeTimer = setTimeout(finishClose, 180);
  };
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (dialog.open) return;
    onOpen();
    restoreMusic = sound.suspendMusic();
    const frame = document.createElement("iframe");
    frame.src = previewUrl;
    frame.title = "INFRA RUSH 紹介ムービー";
    frame.allow = "autoplay; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    player.replaceChildren(frame);
    dialog.showModal();
    trigger.setAttribute("aria-expanded", "true");
    close.focus({ preventScroll: true });
  });
  close.addEventListener("click", requestClose);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener("pointerdown", (event) => {
    backdropPointer = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === dialog && backdropPointer) requestClose();
    backdropPointer = false;
  });
  // Keep the close control reachable when tabbing out of the embedded player.
  dialog.addEventListener("keydown", (event) => {
    if (
      event.key === "Tab" &&
      event.shiftKey &&
      document.activeElement === close
    ) {
      event.preventDefault();
      player.querySelector("iframe")?.focus();
    }
    event.stopPropagation();
  });
}
