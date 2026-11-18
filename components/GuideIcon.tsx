const paths = {
  brand: <><path d="M3 12h18a9 9 0 0 1-18 0Z" /><path d="M9 8c0-2 2-2 2-4m3 4c0-2 2-2 2-4M9 21h6" /></>,
  ticket: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h6" /></>,
  list: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h1m-1 6h1m3-6h4m-4 6h4" /></>,
  cook: <><path d="M6 13a4 4 0 0 1 2-7.5 4.5 4.5 0 0 1 8 0 4 4 0 0 1 2 7.5v6H6v-6Z" /><path d="M6 16h12" /></>,
  truck: <><path d="M3 6h11v11H3zm11 4h4l3 3v4h-7" /><circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" /><circle cx="17" cy="18" r="2" fill="currentColor" stroke="none" /></>,
  chart: <><path d="M4 4v15h16M8 15v-3m4 3V9m4 6V6" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9m4-15.8-8 4.6" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5m0-8h.01" /></>,
  home: <><path d="m3 11 9-7 9 7m-2-1.5V20H5V9.5M10 20v-5h4v5" /></>,
  staff: <><circle cx="9" cy="8" r="3" /><path d="M3 19v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1m1-14a3 3 0 0 1 0 6m1 2a5 5 0 0 1 4 5v1" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  settings: <><path d="M5 7h14M5 12h14M5 17h14" /><path d="M9 5v4m6 1v4m-5 1v4" /></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  check: <path d="m5 12 4 4 10-10" />,
} as const;

export type GuideIconName = keyof typeof paths;

export default function GuideIcon({
  name,
  className = "h-5 w-5",
}: {
  name: GuideIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
