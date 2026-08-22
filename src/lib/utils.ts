import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getScoreColor(score: number) {
  if (score >= 75) {
    return {
      text: 'text-neutral-950 dark:text-white',
      bg: 'bg-neutral-100 dark:bg-neutral-800',
      border: 'border-neutral-900 dark:border-neutral-400',
      badge: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white',
      bar: 'bg-neutral-900 dark:bg-white',
      stroke: 'stroke-neutral-950 dark:stroke-white',
      ringBg: 'bg-neutral-50 dark:bg-neutral-900',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-neutral-800 dark:text-neutral-200',
      bg: 'bg-neutral-50 dark:bg-neutral-850',
      border: 'border-neutral-400 dark:border-neutral-600',
      badge: 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700',
      bar: 'bg-neutral-700 dark:bg-neutral-300',
      stroke: 'stroke-neutral-700 dark:stroke-neutral-300',
      ringBg: 'bg-neutral-50 dark:bg-neutral-900',
    };
  }
  return {
    text: 'text-neutral-600 dark:text-neutral-400',
    bg: 'bg-neutral-50/50 dark:bg-neutral-900/60',
    border: 'border-neutral-200 dark:border-neutral-800',
    badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700',
    bar: 'bg-neutral-400 dark:bg-neutral-500',
    stroke: 'stroke-neutral-400 dark:stroke-neutral-600',
    ringBg: 'bg-neutral-50 dark:bg-neutral-900',
  };
}

/**
 * Formats and normalizes resume text, reconstructing fragmented words and artificial line breaks
 * into clean paragraphs, distinct section headers, and formatted bullet points.
 *
 * @param raw - The raw resume text string
 * @returns Cleanly normalized, wrapped resume text
 */
export function formatResumeText(raw: string): string {
  if (!raw) return '';

  const tokens = raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return '';

  const isBulletSymbol = (t: string) =>
    /^[•●▪▫\*\u2022\u2023\u25E6\u2043\u2219]$/.test(t) ||
    /^\d{1,2}[\.\)]$/.test(t) ||
    /^\(\d{1,2}\)$/.test(t);

  const KNOWN_SECTIONS_SET = new Set([
    'PROFESSIONAL SUMMARY',
    'EXECUTIVE SUMMARY',
    'SUMMARY',
    'PROFILE',
    'TECHNICAL SKILLS',
    'SKILLS & ABILITIES',
    'SKILLS',
    'CORE COMPETENCIES',
    'PROFESSIONAL EXPERIENCE',
    'WORK EXPERIENCE',
    'EXPERIENCE',
    'EMPLOYMENT HISTORY',
    'CAREER HISTORY',
    'KEY PROJECTS',
    'PERSONAL PROJECTS',
    'PROJECTS',
    'EDUCATION',
    'ACADEMIC BACKGROUND',
    'QUALIFICATIONS',
    'CERTIFICATIONS & LICENSES',
    'CERTIFICATIONS',
    'ACHIEVEMENTS',
    'AWARDS',
    'PUBLICATIONS',
    'LANGUAGES',
    'INTERESTS',
    'VOLUNTEER EXPERIENCE',
    'VOLUNTEERING',
  ]);

  const lines: string[] = [];
  let currentLine: string[] = [];

  const flushLine = () => {
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
      currentLine = [];
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = i + 1 < tokens.length ? tokens[i + 1] : '';
    const next2Token = i + 2 < tokens.length ? tokens[i + 2] : '';

    const candidate3 = `${token} ${nextToken} ${next2Token}`.toUpperCase();
    const candidate2 = `${token} ${nextToken}`.toUpperCase();
    const candidate1 = token.toUpperCase();

    let matchedHeader: string | null = null;
    let headerTokensCount = 0;

    const isUpper = (t: string) => t === t.toUpperCase() && /[A-Z]/.test(t);
    const upperRun1 = isUpper(token);
    const upperRun2 = upperRun1 && isUpper(nextToken);
    const upperRun3 = upperRun2 && isUpper(next2Token);

    if (upperRun3 && KNOWN_SECTIONS_SET.has(candidate3)) {
      matchedHeader = candidate3;
      headerTokensCount = 3;
    } else if (upperRun2 && KNOWN_SECTIONS_SET.has(candidate2)) {
      matchedHeader = candidate2;
      headerTokensCount = 2;
    } else if (
      upperRun1 &&
      KNOWN_SECTIONS_SET.has(candidate1) &&
      nextToken !== '&' &&
      nextToken !== 'and' &&
      !nextToken.endsWith(':') &&
      !token.endsWith(':')
    ) {
      matchedHeader = candidate1;
      headerTokensCount = 1;
    }

    if (matchedHeader) {
      flushLine();
      lines.push('');
      lines.push(matchedHeader);
      lines.push('');
      i += headerTokensCount - 1;
      continue;
    }

    // If token is a bullet symbol (●, •, etc.)
    if (isBulletSymbol(token)) {
      flushLine();
      currentLine.push('●');
      continue;
    }

    // Role / Project title boundary checks:
    const isRoleStart =
      (token === 'Software' ||
        token === 'Senior' ||
        token === 'Lead' ||
        token === 'Product' ||
        token === 'Frontend' ||
        token === 'Backend' ||
        token === 'Full-Stack' ||
        token === 'Staff' ||
        token === 'Principal') &&
      (nextToken === 'Engineer' ||
        nextToken === 'Developer' ||
        nextToken === 'Architect' ||
        nextToken === 'Designer' ||
        nextToken === 'Manager' ||
        nextToken === 'Development');

    const isProjectOrEduStart =
      (token === 'Bachelor' && nextToken === 'of') ||
      (token === 'Master' && nextToken === 'of') ||
      (token === 'B.E.' || token === 'B.Tech' || token === 'B.S.' || token === 'M.S.');

    if ((isRoleStart || isProjectOrEduStart) && currentLine.length > 0 && currentLine.includes('●')) {
      flushLine();
      lines.push('');
    }

    currentLine.push(token);

    // If token is the end of a date range like "Present" or "2025" and next token is not part of date
    const isDateEnd =
      (token === 'Present' || token === 'Current' || /^(19|20)\d{2}$/.test(token)) &&
      nextToken !== '–' &&
      nextToken !== '-' &&
      nextToken !== 'to' &&
      nextToken !== 'Present' &&
      !/^(19|20)\d{2}$/.test(nextToken);

    if (
      isDateEnd &&
      currentLine.some((w) => ['—', '-', '–'].includes(w)) &&
      !currentLine.includes('●') &&
      currentLine.length >= 4
    ) {
      flushLine();
    }
  }

  flushLine();

  // Normalize blank lines
  const cleaned: string[] = [];
  let prevBlank = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!prevBlank && cleaned.length > 0) {
        cleaned.push('');
        prevBlank = true;
      }
    } else {
      cleaned.push(trimmed);
      prevBlank = false;
    }
  }

  return cleaned.join('\n');
}

/**
 * Formats a duration in seconds into a friendly estimated remaining time string.
 *
 * @param seconds - Number of seconds remaining
 * @returns Human-readable ETA string (e.g., "< 10s remaining", "45s remaining", "About 2 mins remaining", "1h 15m remaining")
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 0 || isNaN(seconds) || !isFinite(seconds)) return '';
  if (seconds < 10) return '< 10s remaining';
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;

  const minutes = Math.floor(seconds / 60);
  const remainingSecs = Math.round(seconds % 60);

  if (minutes < 60) {
    if (remainingSecs === 0) {
      return `About ${minutes} min${minutes > 1 ? 's' : ''} remaining`;
    }
    return `~${minutes}m ${remainingSecs}s remaining`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `~${hours}h ${remainingMins}m remaining`;
}


