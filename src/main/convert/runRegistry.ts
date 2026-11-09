/**
 * One conversion at a time. Two runs would race on the same output paths and
 * each make its own library write, so a second is refused rather than queued.
 * The controller is registered before any pre-check, so a cancel sent while the
 * checks run is not lost; `end` only removes the run it was given.
 */
export class RunRegistry {
  private readonly runs = new Map<string, AbortController>();

  begin(operationId: string): AbortController {
    if (this.runs.has(operationId)) {
      throw new Error(`A conversion with id ${operationId} is already registered.`);
    }
    if (this.runs.size > 0) {
      throw new Error('A conversion is already running — wait for it to finish or cancel it first.');
    }
    const controller = new AbortController();
    this.runs.set(operationId, controller);
    return controller;
  }

  cancel(operationId: string): boolean {
    const controller = this.runs.get(operationId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  end(operationId: string, controller: AbortController): void {
    if (this.runs.get(operationId) === controller) this.runs.delete(operationId);
  }
}
