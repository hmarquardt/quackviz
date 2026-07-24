import { INTERACTION_MAX_PROPAGATION_DEPTH } from "./constants.js";
import { interactionSignature, validateInteractionEvent } from "./interaction-events.js";

export function createInteractionBus({ maxHistory = 100 } = {}) {
  const subscribers = new Set();
  const seen = new Set();
  const history = [];
  const trace = [];
  return {
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    publish(input) {
      const validation = validateInteractionEvent(input);
      if (!validation.valid) return { ok: false, errors: validation.errors, delivered: 0 };
      const event = validation.event;
      if (event.lineage.length > INTERACTION_MAX_PROPAGATION_DEPTH) return { ok: false, errors: [{ path: "lineage", message: "Maximum propagation depth exceeded." }], delivered: 0, loopPrevented: true };
      const signature = interactionSignature(event);
      if (seen.has(signature)) return { ok: true, event, delivered: 0, duplicate: true };
      seen.add(signature);
      history.unshift(event);
      history.length = Math.min(history.length, maxHistory);
      let delivered = 0;
      for (const listener of subscribers) {
        listener(event);
        delivered += 1;
      }
      trace.unshift({ interactionId: event.id, signature, delivered, timestamp: event.timestamp });
      trace.length = Math.min(trace.length, maxHistory);
      return { ok: true, event, delivered };
    },
    clearSeen() { seen.clear(); },
    history() { return history.slice(); },
    trace() { return trace.slice(); },
    subscriptionCount() { return subscribers.size; },
  };
}
