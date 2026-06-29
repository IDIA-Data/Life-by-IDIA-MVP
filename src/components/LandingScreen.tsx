import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import polishedLogo from "@/assets/IDIA_Life_Logo_Polished.png";

interface LandingScreenProps {
  onSignUp: () => void;
}

const LandingScreen = ({ onSignUp }: LandingScreenProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Lifecycle Observability
  useEffect(() => {
    console.log("[LANDING_SCREEN_INIT_START] Mounting LandingScreen component.");
    try {
      // Validation or init checks could be injected here
      console.log("[LANDING_SCREEN_INIT_END] LandingScreen mounted successfully. Operating at z-30.");
    } catch (err) {
      console.error("[LANDING_SCREEN_INIT_ERROR] Failed to mount LandingScreen:", err);
    }

    return () => {
      console.log("[LANDING_SCREEN_CLEANUP] Unmounting LandingScreen component.");
    };
  }, []);

  const slides = [
    {
      title: "Earn From Your Data",
      description:
        "Transform your digital footprint into passive income. Earn IDIA-USD by consensually sharing your anonymized data with trusted partners.",
      gradient: "from-teal-600 to-emerald-600",
    },
    {
      title: "Payments with a Purpose",
      description:
        "Every transaction creates positive impact. A portion of our revenue funds community programs and innovative tech ventures.",
      gradient: "from-emerald-600 to-green-600",
    },
    {
      title: "Fairer Credit",
      description:
        "Access capital based on your IDIA Trust Score™. Get rewarded for positive ecosystem participation, not just credit history.",
      gradient: "from-green-600 to-teal-600",
    },
  ];

  const nextSlide = () => {
    console.log(`[SLIDE_TRANSITION_NEXT_START] Attempting transition from slide index: ${currentSlide}`);
    try {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
      console.log("[SLIDE_TRANSITION_NEXT_END] Successfully advanced to next slide.");
    } catch (err) {
      console.error("[SLIDE_TRANSITION_NEXT_ERROR] Silent stalling caught during next slide transition:", err);
    }
  };

  const prevSlide = () => {
    console.log(`[SLIDE_TRANSITION_PREV_START] Attempting transition from slide index: ${currentSlide}`);
    try {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
      console.log("[SLIDE_TRANSITION_PREV_END] Successfully retreated to previous slide.");
    } catch (err) {
      console.error("[SLIDE_TRANSITION_PREV_ERROR] Silent stalling caught during previous slide transition:", err);
    }
  };

  const goToSlide = (index: number) => {
    console.log(`[SLIDE_TRANSITION_DIRECT_START] Attempting direct jump to slide index: ${index}`);
    try {
      setCurrentSlide(index);
      console.log(`[SLIDE_TRANSITION_DIRECT_END] Successfully jumped to slide index: ${index}`);
    } catch (err) {
      console.error(
        `[SLIDE_TRANSITION_DIRECT_ERROR] Silent stalling caught while jumping to slide index: ${index}`,
        err,
      );
    }
  };

  const handleSignUpClick = () => {
    console.log("[ACTION_SIGNUP_START] User initiated 'Get Started' action.");
    try {
      onSignUp();
      console.log("[ACTION_SIGNUP_END] Sign-up callback executed to parent successfully.");
    } catch (err) {
      console.error("[ACTION_SIGNUP_ERROR] Parent callback execution failed:", err);
    }
  };

  return (
    // CRITICAL FIX: Added 'z-30' to ensure this layer sits securely beneath the bottom navigation (z-40)
    <div className="fixed inset-0 z-30 flex flex-col bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden touch-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Logo */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20">
        <img src={polishedLogo} alt="IDIA Life Logo" className="w-16 h-16 rounded-2xl shadow-lg" />
      </div>

      {/* Carousel Container */}
      <div className="flex-1 relative overflow-hidden touch-none">
        <div
          className="flex transition-transform duration-500 ease-in-out h-full"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`min-w-full h-full flex flex-col justify-center items-center px-8 text-center bg-gradient-to-br ${slide.gradient} relative`}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-white/20 blur-xl"></div>
                <div className="absolute bottom-32 right-10 w-24 h-24 rounded-full bg-white/30 blur-lg"></div>
                <div className="absolute top-1/2 left-1/4 w-16 h-16 rounded-full bg-white/15 blur-md"></div>
              </div>

              <div className="relative z-10 max-w-sm mx-auto mt-32">
                <h1 className="text-4xl font-bold mb-6 leading-tight">{slide.title}</h1>
                <p className="text-lg text-white/90 leading-relaxed">{slide.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors z-20"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors z-20"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Slide Indicators */}
      <div className="flex justify-center space-x-3 mb-8 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentSlide ? "bg-white scale-125" : "bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="px-8 pb-8 z-20">
        <Button
          onClick={handleSignUpClick}
          className="w-full py-4 text-lg font-semibold bg-white text-teal-700 hover:bg-gray-100 rounded-xl shadow-lg"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default LandingScreen;
