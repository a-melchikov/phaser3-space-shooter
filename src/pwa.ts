import { registerSW } from "virtual:pwa-register";

export const updateServiceWorker = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    window.setInterval(() => {
      void registration.update();
    }, 60 * 60 * 1000);
  }
});
