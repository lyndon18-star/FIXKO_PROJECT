import * as React from "react";

export type Role = "user" | "admin";
export type AuthMode = "signin" | "signup" | "forgot" | "reset";
export type Status = "pending" | "review" | "progress" | "resolved";

export const statusLabel: Record<Status, string> = {
  pending: "Pending",
  review: "Under review",
  progress: "In progress",
  resolved: "Resolved",
};

export type IconName =
  | "spark"
  | "clipboard"
  | "activity"
  | "chart"
  | "alert"
  | "box"
  | "mail"
  | "hash"
  | "search"
  | "id"
  | "shield"
  | "arrow"
  | "check"
  | "bell"
  | "grid"
  | "layers"
  | "users"
  | "building"
  | "edit"
  | "logout"
  | "eye"
  | "eyeOff";

export function Icon({
  name,
  size = 18,
  stroke = 1.8,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    spark: (
      <>
        <path d="m12 3 1.1 5.9L19 10l-5.9 1.1L12 17l-1.1-5.9L5 10l5.9-1.1L12 3Z" />
        <path d="m19 16 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5V3h6v1.5M8 10h8M8 14h6M8 18h4" />
      </>
    ),
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
    chart: (
      <>
        <path d="M4 19V5M4 19h17" />
        <path d="m7 15 3-4 3 2 5-7" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 9 16H3L12 3Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
    box: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7M12 11v10" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    hash: (
      <>
        <path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    id: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8" cy="12" r="2" />
        <path d="M13 10h5M13 14h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 19 6v5c0 4.5-2.8 8.1-7 10-4.2-1.9-7-5.5-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    arrow: <><path d="M5 12h13M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.5-3.5 2.5-5 6-5s5.5 1.5 6 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2.5.3 3.8 1.8 4 4" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V5l8-3 8 3v16M2 21h20M8 9h2M14 9h2M8 13h2M14 13h2M8 17h2M14 17h2" />
      </>
    ),
    edit: (
      <>
        <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
        <path d="m14 7 3 3" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
        <path d="M9.9 5.4A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-4.7 6.2M7.1 7.1A16.6 16.6 0 0 0 2 12s3.5 7 10 7a10.3 10.3 0 0 0 5.4-1.6" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <img
      className="brand-mark-image"
      src="/logo/fixko-logo.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
    />
  );
}

export function CountUp({ value }: { value: number }) {
  const [count, setCount] = React.useState(0);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / 900);
          setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{count}</span>;
}

export function LiveProgress({ value, fill }: { value: number; fill: string }) {
  const [active, setActive] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="live-progress-track">
      <div
        className={`live-progress-fill ${fill} ${active ? "is-active" : ""}`}
        style={{ "--progress": `${value}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`gsap-reveal ${className}`}>{children}</div>;
}

export function Badge({
  value,
  type = "priority",
}: {
  value: string;
  type?: "priority" | "status";
}) {
  return (
    <span className={`badge badge-${value}`}>
      {type === "status" ? statusLabel[value as Status] : value}
    </span>
  );
}

export function ModernSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selectRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  React.useEffect(() => {
    const close = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div
      ref={selectRef}
      className={`modern-select ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
    >
      <button
        type="button"
        className="modern-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "" : "is-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <span className="modern-select-chevron" />
      </button>
      {open && (
        <div className="modern-select-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`modern-select-option ${option.value === value ? "is-selected" : ""}`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
