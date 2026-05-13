import confetti from "canvas-confetti";

// Teal + Orange brand palette
const TEAL = ["#14b8a6", "#0d9488", "#5eead4", "#2dd4bf"];
const ORANGE = ["#f97316", "#ea580c", "#fb923c", "#fdba74"];
const BRAND = [...TEAL, ...ORANGE];

// Create a persistent instance that survives component unmounting
const fire = confetti.create(undefined, {
  resize: true,
  useWorker: true,
});

const globalDefaults = {
  zIndex: 10000, // Higher than any Radix Dialog/Overlay
  colors: BRAND,
};

export const fireWelcomeConfetti = () => {
  fire({
    ...globalDefaults,
    particleCount: 60,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.7 },
  });
  fire({
    ...globalDefaults,
    particleCount: 60,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.7 },
  });
};

export const fireCompletionConfetti = () => {
  fire({
    ...globalDefaults,
    particleCount: 150,
    spread: 90,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.5 }, // Centered
  });
};

export const fireGraffitiConfetti = () => {
  const shoot = (originX: number) => {
    fire({
      ...globalDefaults,
      particleCount: 40,
      angle: 60 + Math.random() * 60,
      spread: 80,
      startVelocity: 35 + Math.random() * 20,
      origin: { x: originX, y: 0.8 },
      shapes: ["square", "circle"],
      scalar: 1.2,
    });
  };
  shoot(0.2);
  shoot(0.5);
  shoot(0.8);
};

export const fireFinaleConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  const interval: any = setInterval(() => {
    if (Date.now() > end) return clearInterval(interval);

    fire({
      ...globalDefaults,
      particleCount: 40,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.8 },
    });
    fire({
      ...globalDefaults,
      particleCount: 40,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.8 },
    });
  }, 250);
};

export const fireAppleHealthDataBurst = (origin: { x: number; y: number }) => {
  const burstDefaults = {
    ...globalDefaults,
    origin,
    gravity: 1.15,
    drift: 0,
    ticks: 180,
  };

  fire({
    ...burstDefaults,
    particleCount: 28,
    spread: 42,
    angle: 90,
    startVelocity: 32,
    scalar: 1.15,
    shapes: ["square"],
  });

  fire({
    ...burstDefaults,
    particleCount: 22,
    spread: 68,
    angle: 70,
    startVelocity: 24,
    decay: 0.92,
    scalar: 0.95,
    shapes: ["square"],
  });

  fire({
    ...burstDefaults,
    particleCount: 22,
    spread: 68,
    angle: 110,
    startVelocity: 24,
    decay: 0.92,
    scalar: 0.95,
    shapes: ["square"],
  });
};
