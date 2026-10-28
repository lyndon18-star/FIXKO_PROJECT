import type { CSSProperties } from "react";

// This file provides StaggeredText: a component that makes text appear
// word-by-word with a small delay between words (a "staggered" fade-in).

// One piece of text with its own styling (a heading can mix differently styled parts).
type StaggeredTextSegment = {
  text: string;
  className?: string;
};

// Settings for StaggeredText: the text pieces, plus how long to wait before starting
// (delay) and the gap between each word (stagger).
type StaggeredTextProps = {
  segments: StaggeredTextSegment[];
  className?: string;
  delay?: number;
  stagger?: number;
};

/** Max extra wait so the last words don't lag seconds behind the first. */
const MAX_EXTRA_DELAY = 480;

// This component splits its text into words and gives each word a slightly longer
// delay, so the words appear one after another like a cascade. Screen readers still
// get the full sentence via aria-label.
export function StaggeredText({
  segments,
  className,
  delay = 0,
  stagger = 40,
}: StaggeredTextProps) {
  // The plain, unbroken text (used as the accessible label for screen readers).
  const accessibleText = segments.map((segment) => segment.text).join("");
  // Counts every real word so each one can get its own delay.
  let wordIndex = 0;

  return (
    <span className={`staggered-text ${className ?? ""}`} role="text" aria-label={accessibleText}>
      {/* The visible words (screen readers already read the aria-label above). */}
      <span aria-hidden="true">
        {segments.map((segment, segmentIndex) => {
          const words = segment.text.match(/\s+|\S+/g) ?? [];

          return (
            <span key={`${segment.text}-${segmentIndex}`}>
              {words.map((word) => {
                if (/^\s+$/.test(word)) {
                  return word;
                }

                const currentIndex = wordIndex;
                wordIndex += 1;
                const staggerDelay = Math.min(currentIndex * stagger, MAX_EXTRA_DELAY);

                return (
                  <span
                    className={`staggered-text-word ${segment.className ?? ""}`}
                    key={`word-${currentIndex}`}
                    style={
                      {
                        "--stagger-delay": `${delay + staggerDelay}ms`,
                      } as CSSProperties
                    }
                  >
                    {word}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </span>
  );
}
