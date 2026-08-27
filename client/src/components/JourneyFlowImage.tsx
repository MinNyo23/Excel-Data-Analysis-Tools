import { useState } from "react";

type JourneyFlowImageProps = {
  src: string;
  alt: string;
};

export function JourneyFlowImage({ src, alt }: JourneyFlowImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`journey-flow-media${isLoaded ? " is-loaded" : ""}${hasError ? " has-error" : ""}`}>
      {!isLoaded && !hasError && (
        <div className="journey-flow-skeleton" aria-hidden="true">
          <span className="journey-flow-skeleton-node node-one" />
          <span className="journey-flow-skeleton-node node-two" />
          <span className="journey-flow-skeleton-node node-three" />
        </div>
      )}
      {!isLoaded && !hasError && <span className="sr-only" role="status">Loading end-user journey flow…</span>}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
      {hasError && <p className="journey-flow-load-error" role="alert">The journey flow could not load. Use the link above to open it in a new tab.</p>}
    </div>
  );
}
