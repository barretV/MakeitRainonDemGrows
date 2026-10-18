/** Lifecycle hooks the RUN shell calls when the tab pauses or closes. */
export const bridge = {
  onPause: (): void => {},
  onResume: (): void => {},
  onQuit: (): void => {},
};
