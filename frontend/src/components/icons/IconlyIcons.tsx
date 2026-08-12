import React from 'react'

export interface IconlyProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  color?: string
  accentColor?: string
}

const DEFAULT_ACCENT = 'var(--brand-primary, #e11d48)'

/**
 * Iconly Style Dashboard (Grid with Accent Tile)
 */
export const IconlyDashboard: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Top-left tile */}
    <rect x="3.5" y="3.5" width="7" height="7" rx="2.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Top-right tile (accent color) */}
    <rect x="13.5" y="3.5" width="7" height="7" rx="2.5" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
    {/* Bottom-left tile */}
    <rect x="3.5" y="13.5" width="7" height="7" rx="2.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Bottom-right tile */}
    <rect x="13.5" y="13.5" width="7" height="7" rx="2.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Calendar (with Accent Rings & Date Mark)
 */
export const IconlyCalendar: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Main calendar body */}
    <rect x="3.5" y="5" width="17" height="15.5" rx="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Top header line */}
    <path d="M3.5 10H20.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* Left ring binder (accent) */}
    <path d="M8 3V6.5" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
    {/* Right ring binder (accent) */}
    <path d="M16 3V6.5" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
    {/* Active date dot / mark (accent) */}
    <circle cx="12" cy="15" r="1.5" fill={accentColor} />
    <circle cx="16" cy="15" r="1.2" fill={color} opacity="0.6" />
    <circle cx="8" cy="15" r="1.2" fill={color} opacity="0.6" />
  </svg>
)

/**
 * Iconly Style Graduation Cap / Students (Cap with Accent Tassel)
 */
export const IconlyGraduationCap: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Cap Diamond Top */}
    <path
      d="M12 3.5L21.5 8.5L12 13.5L2.5 8.5L12 3.5Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Skull Cap Base */}
    <path
      d="M6.5 11V16.5C6.5 18.5 9 20 12 20C15 20 17.5 18.5 17.5 16.5V11"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Accent Tassel */}
    <path
      d="M19.5 9.5V15.5C19.5 16.3 18.8 17 18 17"
      stroke={accentColor}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="19.5" cy="9" r="1" fill={accentColor} />
  </svg>
)

/**
 * Iconly Style Open Book / Classes (Book with Accent Ribbon/Spine)
 */
export const IconlyClasses: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Left Page */}
    <path
      d="M4 19.5C6.5 18 9.5 18 12 19.5V5.5C9.5 4 6.5 4 4 5.5V19.5Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Right Page */}
    <path
      d="M12 19.5C14.5 18 17.5 18 20 19.5V5.5C17.5 4 14.5 4 12 5.5V19.5Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Accent Bookmark Ribbon */}
    <path d="M12 5.5V14L14 12L16 14V5.5" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Iconly Style Parents / Family (Parent + Accent Child)
 */
export const IconlyParents: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Parent head */}
    <circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="2" />
    {/* Parent body */}
    <path d="M3 20C3 16.5 5.5 14 9 14C10.5 14 11.8 14.5 12.8 15.4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Child head (accent) */}
    <circle cx="16.5" cy="10" r="2.8" stroke={accentColor} strokeWidth="2" />
    {/* Child body (accent) */}
    <path d="M13 20C13 17.5 14.5 15.5 16.5 15.5C18.5 15.5 20 17.5 20 20" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Credit Card / Fees (Card with Accent Chip)
 */
export const IconlyFees: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Card Frame */}
    <rect x="3" y="5" width="18" height="14" rx="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Magnetic Stripe */}
    <path d="M3 9.5H21" stroke={color} strokeWidth="1.8" />
    {/* Accent Chip */}
    <rect x="6.5" y="13" width="4" height="3" rx="1" fill={accentColor} stroke={accentColor} strokeWidth="1" />
  </svg>
)

/**
 * Iconly Style Document with Ribbon / Fee Record
 */
export const IconlyFeeRecord: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Document Body */}
    <rect x="4" y="3.5" width="16" height="17" rx="3.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Content Lines */}
    <path d="M8 8.5H13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M8 12.5H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M8 16.5H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Accent Bookmark Ribbon (hanging bottom right) */}
    <path d="M15 3.5V8.5L16.5 7.2L18 8.5V3.5" fill={accentColor} stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Iconly Style Audit Trail (Document Search / History Clock)
 */
export const IconlyAudit: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* History Clock Circle */}
    <path d="M12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Clock Hands */}
    <path d="M12 7.5V12L15 14.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {/* Counter-clockwise History Arrow (accent) */}
    <path d="M17.5 4.5L20.5 7.5M20.5 7.5L17.5 10.5M20.5 7.5H14.5" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Iconly Style Settings (Sliders with Accent Knobs)
 */
export const IconlySettings: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Slider 1 track */}
    <path d="M4 7H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Slider 1 knob (accent) */}
    <circle cx="9" cy="7" r="2.8" fill="#ffffff" stroke={accentColor} strokeWidth="2.2" />

    {/* Slider 2 track */}
    <path d="M4 17H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Slider 2 knob (accent) */}
    <circle cx="15" cy="17" r="2.8" fill="#ffffff" stroke={accentColor} strokeWidth="2.2" />
  </svg>
)

/**
 * Iconly Style Home (House with Accent Roof Peak / Door)
 */
export const IconlyHome: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Roof */}
    <path d="M3 10.5L12 3.5L21 10.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {/* House Body */}
    <path d="M5.5 9.5V19.5C5.5 20.3 6.2 21 7 21H17C17.8 21 18.5 20.3 18.5 19.5V9.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Door (accent) */}
    <path d="M10 21V15C10 14 10.8 13.2 11.8 13.2H12.2C13.2 13.2 14 14 14 15V21" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style My Kids (Child Smile Face)
 */
export const IconlyMyKids: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Face Contour */}
    <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="2" />
    {/* Eyes */}
    <circle cx="9" cy="10.5" r="1.2" fill={color} />
    <circle cx="15" cy="10.5" r="1.2" fill={color} />
    {/* Smile */}
    <path d="M8.5 14.5C9.5 16.5 14.5 16.5 15.5 14.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Accent Hair Bow / Hair Tuft */}
    <path d="M12 3.5C10.5 1.5 13.5 1.5 12 3.5Z" stroke={accentColor} strokeWidth="2.2" fill={accentColor} />
    <circle cx="12" cy="3.5" r="1.5" fill={accentColor} />
  </svg>
)

/**
 * Iconly Style Profile / User Card (ID Card with Accent Badge)
 */
export const IconlyProfile: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* User Head */}
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
    {/* User Shoulders */}
    <path d="M5 19.5C5 16 8 14 12 14C16 14 19 16 19 19.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Accent Checkmark / Verified Badge Dot */}
    <circle cx="17.5" cy="6.5" r="2.5" fill={accentColor} />
  </svg>
)

/**
 * Iconly Style Overview (Open Book Detail)
 */
export const IconlyOverview: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Book Cover */}
    <rect x="4" y="3.5" width="16" height="17" rx="3.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Spine line */}
    <path d="M8 3.5V20.5" stroke={color} strokeWidth="2" />
    {/* Accent Page Lines */}
    <path d="M11.5 8H16.5" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
    <path d="M11.5 12H16.5" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
    <path d="M11.5 16H14.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Bell (Notification Bell with Accent Clapper)
 */
export const IconlyBell: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Bell Body */}
    <path
      d="M18 16.5H6C7.2 15.2 8 13.4 8 11.5V9.5C8 7.3 9.8 5.5 12 5.5C14.2 5.5 16 7.3 16 9.5V11.5C16 13.4 16.8 15.2 18 16.5Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Top Ring Loop */}
    <path d="M12 3V5.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Clapper (accent) */}
    <path d="M10 19.5C10.4 20.4 11.1 21 12 21C12.9 21 13.6 20.4 14 19.5" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Logout
 */
export const IconlyLogout: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Door frame */}
    <path d="M14 4H8C6.3 4 5 5.3 5 7V17C5 18.7 6.3 20 8 20H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Arrow line (accent) */}
    <path d="M10 12H20.5" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
    {/* Arrow head (accent) */}
    <path d="M17.5 8.5L21 12L17.5 15.5" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Iconly Style Staff / Employees (User with ID Badge)
 */
export const IconlyStaff: React.FC<IconlyProps> = ({
  size = 22,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    {/* Employee Head */}
    <circle cx="10" cy="7.5" r="3.5" stroke={color} strokeWidth="2" />
    {/* Employee Body */}
    <path d="M3.5 19.5C3.5 16 6.5 14 10 14C11.5 14 12.8 14.5 13.8 15.4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Staff Badge Card (accent) */}
    <rect x="15" y="9" width="6" height="8.5" rx="1.5" stroke={accentColor} strokeWidth="2" />
    <path d="M17 11.5H19" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17 14.5H18.5" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M18 6.5V9" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Phone
 */
export const IconlyPhone: React.FC<IconlyProps> = ({
  size = 20,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <path
      d="M5 4H9L11 9L8.5 10.5C9.7 13 11.7 15 14.2 16.2L15.7 13.7L20.7 15.7V19.7C20.7 20.8 19.8 21.7 18.7 21.7C10.6 21.7 4 15.1 4 7C4 5.9 4.9 5 6 5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M16 4C17.7 4.5 19 5.8 19.5 7.5" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
    <path d="M15 1.5C18.6 2.2 21.3 4.9 22 8.5" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Mail
 */
export const IconlyMail: React.FC<IconlyProps> = ({
  size = 20,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <rect x="3" y="5" width="18" height="14" rx="3" stroke={color} strokeWidth="2" />
    <path d="M3 7L10.9 12.3C11.6 12.8 12.4 12.8 13.1 12.3L21 7" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Iconly Style Users (Group)
 */
export const IconlyUsers: React.FC<IconlyProps> = ({
  size = 20,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" />
    <path d="M2 20C2 16.1 5.1 13 9 13C12.9 13 16 16.1 16 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M16 4C17.7 4.5 19 6.1 19 8C19 9.5 18.1 10.8 16.7 11.5" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
    <path d="M19 14.5C21.1 15.6 22.5 17.6 22.5 20" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style UserPlus
 */
export const IconlyUserPlus: React.FC<IconlyProps> = ({
  size = 20,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <circle cx="8.5" cy="7" r="4" stroke={color} strokeWidth="2" />
    <path d="M2 20C2 16.1 4.9 13 8.5 13C10.4 13 12.1 13.8 13.3 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M18 10V16" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M15 13H21" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Search
 */
export const IconlySearch: React.FC<IconlyProps> = ({
  size = 20,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <circle cx="11" cy="11" r="7.5" stroke={color} strokeWidth="2" />
    <path d="M16.5 16.5L21 21" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

/**
 * Iconly Style Layers
 */
export const IconlyLayers: React.FC<IconlyProps> = ({
  size = 20,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 17L12 22L22 17" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Iconly Style Check
 */
export const IconlyCheck: React.FC<IconlyProps> = ({
  size = 20,
  color = 'currentColor',
  accentColor = DEFAULT_ACCENT,
  style,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    {...props}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <path d="M8 12L11 15L16 9" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
