type Listener = () => void;

let count = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export const loadingStore = {
  start() {
    count++;
    notify();
  },
  stop() {
    count = Math.max(0, count - 1);
    notify();
  },
  getSnapshot() {
    return count;
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
