interface DefocusApp {
  hide: () => void;
  show: () => void;
  onceHide: (listener: () => void) => void;
}

export interface DefocusExternalOpenOptions {
  app: DefocusApp;
  platform: NodeJS.Platform;
  fallbackMs?: number;
}

let defocusInFlight = false;

export function defocusExternalOpen({
  app,
  platform,
  fallbackMs = 250,
}: DefocusExternalOpenOptions): void {
  if (platform !== 'darwin' || defocusInFlight) return;

  defocusInFlight = true;
  let completed = false;
  let fallbackTimer: NodeJS.Timeout;

  const finish = (): void => {
    if (completed) return;
    completed = true;
    clearTimeout(fallbackTimer);
    defocusInFlight = false;
    app.show();
  };

  app.onceHide(finish);
  fallbackTimer = setTimeout(finish, fallbackMs);
  app.hide();
}

export function resetDefocusExternalOpenForTests(): void {
  defocusInFlight = false;
}
