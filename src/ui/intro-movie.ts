import type { Sound } from "./audio";

const movieUrl = `${import.meta.env.BASE_URL}media/intro-v1.mp4`;
const posterUrl = `${import.meta.env.BASE_URL}media/intro-v1-poster.jpg`;

export function setupIntroMovie(sound: Sound, onOpen: () => void) {
  const trigger =
    document.querySelector<HTMLButtonElement>("#title-movie-open")!;
  const dialog = document.querySelector<HTMLDialogElement>("#intro-movie")!;
  const player = dialog.querySelector<HTMLElement>(".intro-movie-player")!;
  const close = dialog.querySelector<HTMLButtonElement>("#intro-movie-close")!;
  let restoreMusic: (() => void) | undefined;
  let video: HTMLVideoElement | undefined;
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
    const previous = video;
    video = undefined;
    previous?.pause();
    previous?.removeAttribute("src");
    previous?.load();
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
    const movie = document.createElement("video");
    video = movie;
    movie.id = "intro-movie-video";
    movie.src = movieUrl;
    movie.poster = posterUrl;
    movie.controls = true;
    movie.playsInline = true;
    movie.preload = "metadata";
    movie.setAttribute("aria-label", "INFRA RUSH 紹介ムービー");
    movie.tabIndex = 0;
    const feedback = document.createElement("div");
    feedback.className = "intro-movie-feedback";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    feedback.hidden = true;
    const retry = document.createElement("button");
    retry.id = "intro-movie-play";
    retry.type = "button";
    retry.textContent = "動画を再生";
    retry.hidden = true;
    feedback.append(status, retry);
    player.replaceChildren(movie, feedback);

    const active = () => video === movie && !closing;
    const start = () => {
      if (!active()) return;
      feedback.hidden = true;
      retry.hidden = true;
      status.textContent = "";
      movie.setAttribute("aria-busy", "true");
      if (movie.error) movie.load();
      // Keep play() inside the original tap/key activation: no network await,
      // timer, or third-party iframe between the user's gesture and playback.
      void movie.play().catch(() => {
        if (!active()) return;
        movie.setAttribute("aria-busy", "false");
        status.textContent = movie.error
          ? "動画を読み込めませんでした。もう一度お試しください。"
          : "再生ボタンを押して動画をお楽しみください。";
        retry.textContent = movie.error ? "もう一度読み込む" : "動画を再生";
        retry.hidden = false;
        feedback.hidden = false;
      });
    };
    retry.addEventListener("click", start);
    movie.addEventListener("playing", () => {
      if (!active()) return;
      movie.setAttribute("aria-busy", "false");
      feedback.hidden = true;
    });
    movie.addEventListener("waiting", () => {
      if (!active()) return;
      movie.setAttribute("aria-busy", "true");
    });
    movie.addEventListener("error", () => {
      if (!active()) return;
      movie.setAttribute("aria-busy", "false");
      status.textContent =
        "動画を読み込めませんでした。もう一度お試しください。";
      retry.textContent = "もう一度読み込む";
      retry.hidden = false;
      feedback.hidden = false;
    });
    dialog.showModal();
    trigger.setAttribute("aria-expanded", "true");
    close.focus({ preventScroll: true });
    start();
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
  dialog.addEventListener("keydown", (event) => {
    // Handle Escape in our own document, including when the video has focus.
    if (event.key === "Escape" && !document.fullscreenElement) {
      event.preventDefault();
      requestClose();
    }
    if (
      event.key === "Tab" &&
      event.shiftKey &&
      document.activeElement === close
    ) {
      event.preventDefault();
      const retry = player.querySelector<HTMLButtonElement>(
        "button:not([hidden])",
      );
      (retry ?? video)?.focus();
    }
    event.stopPropagation();
  });
}
